// Minimal PCM WAV helpers. Android's TextToSpeech.synthesizeToFile writes plain PCM WAV, and
// the only thing we need is to join several of those with silence between them (the TTS
// engine has no way to pause between sentences by itself), so this deliberately supports
// nothing but uncompressed PCM.

type WavFormat = { channels: number; sampleRate: number; bitsPerSample: number };
type ParsedWav = { format: WavFormat; pcm: Uint8Array };

const HEADER_BYTES = 44;

function readTag(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3],
  );
}

export function parseWav(bytes: Uint8Array): ParsedWav {
  if (bytes.length < 12 || readTag(bytes, 0) !== 'RIFF' || readTag(bytes, 8) !== 'WAVE') {
    throw new Error('Not a RIFF/WAVE file');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let format: WavFormat | null = null;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const tag = readTag(bytes, offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (tag === 'fmt ') {
      if (view.getUint16(body, true) !== 1)
        throw new Error('Only uncompressed PCM WAV is supported');
      format = {
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bitsPerSample: view.getUint16(body + 14, true),
      };
    } else if (tag === 'data') {
      if (!format) throw new Error('WAV data chunk before fmt chunk');
      // Clamp: a streamed/truncated file can claim more data than it holds.
      const end = Math.min(body + size, bytes.length);
      return { format, pcm: bytes.subarray(body, end) };
    }
    offset = body + size + (size % 2); // chunks are word-aligned
  }
  throw new Error('WAV file has no data chunk');
}

function buildHeader(format: WavFormat, dataBytes: number): Uint8Array {
  const out = new Uint8Array(HEADER_BYTES);
  const view = new DataView(out.buffer);
  const blockAlign = (format.channels * format.bitsPerSample) / 8;
  const writeTag = (offset: number, tag: string) => {
    for (let i = 0; i < 4; i++) out[offset + i] = tag.charCodeAt(i);
  };
  writeTag(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeTag(8, 'WAVE');
  writeTag(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, format.channels, true);
  view.setUint32(24, format.sampleRate, true);
  view.setUint32(28, format.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, format.bitsPerSample, true);
  writeTag(36, 'data');
  view.setUint32(40, dataBytes, true);
  return out;
}

/** Edge silence below this level is trimmed when `trimEdges` is set (about -45 dBFS). */
const TRIM_THRESHOLD = 0.0056;
/** Audio kept either side of the first/last audible sample, so word onsets aren't clipped. */
const TRIM_MARGIN_MS = 30;

/**
 * Drops leading/trailing near-silence from 16-bit PCM. The TTS engine pads each utterance with
 * its own silence, which would otherwise make every inserted pause longer than intended.
 */
function trimEdgeSilence(pcm: Uint8Array, format: WavFormat): Uint8Array {
  if (format.bitsPerSample !== 16) return pcm; // only the format our engines produce
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const frameBytes = 2 * format.channels;
  const frames = Math.floor(pcm.length / frameBytes);
  const threshold = TRIM_THRESHOLD * 32768;
  const loud = (frame: number) => {
    for (let c = 0; c < format.channels; c++) {
      if (Math.abs(view.getInt16(frame * frameBytes + c * 2, true)) > threshold) return true;
    }
    return false;
  };
  let first = 0;
  while (first < frames && !loud(first)) first++;
  if (first === frames) return pcm.subarray(0, 0); // all silence
  let last = frames - 1;
  while (last > first && !loud(last)) last--;
  const margin = Math.round((TRIM_MARGIN_MS / 1000) * format.sampleRate);
  const start = Math.max(0, first - margin);
  const end = Math.min(frames, last + 1 + margin);
  return pcm.subarray(start * frameBytes, end * frameBytes);
}

/**
 * Joins PCM WAV files end to end, inserting `gapsAfterMs[i]` of silence after part `i` (the
 * last part's gap is ignored). With `trimEdges`, each part's own leading/trailing silence is
 * removed first so the gaps are exact. All inputs must share the same format, which holds for
 * one voice synthesized by one engine in one session; a mismatch throws instead of producing
 * garbage.
 */
export function joinWavSegments(
  parts: Uint8Array[],
  gapsAfterMs: number[],
  { trimEdges = false }: { trimEdges?: boolean } = {},
): Uint8Array {
  if (parts.length === 0) throw new Error('No WAV parts to join');
  const parsed = parts.map(parseWav);
  const { format } = parsed[0];
  for (const p of parsed) {
    if (
      p.format.channels !== format.channels ||
      p.format.sampleRate !== format.sampleRate ||
      p.format.bitsPerSample !== format.bitsPerSample
    ) {
      throw new Error('Cannot join WAV files with different formats');
    }
  }

  const bytesPerFrame = (format.channels * format.bitsPerSample) / 8;
  const pcms = parsed.map((p) => (trimEdges ? trimEdgeSilence(p.pcm, format) : p.pcm));
  // Zero bytes are silence in signed PCM16.
  const silences = pcms.map((_, i) =>
    i < pcms.length - 1
      ? new Uint8Array(
          Math.round(((gapsAfterMs[i] ?? 0) / 1000) * format.sampleRate) * bytesPerFrame,
        )
      : new Uint8Array(0),
  );
  const dataBytes = pcms.reduce((sum, pcm, i) => sum + pcm.length + silences[i].length, 0);

  const out = new Uint8Array(HEADER_BYTES + dataBytes);
  out.set(buildHeader(format, dataBytes), 0);
  let cursor = HEADER_BYTES;
  pcms.forEach((pcm, i) => {
    out.set(pcm, cursor);
    cursor += pcm.length;
    out.set(silences[i], cursor);
    cursor += silences[i].length;
  });
  return out;
}

/**
 * Joins PCM WAV files end to end with `silenceMs` of silence between each pair (none before the
 * first or after the last), untrimmed.
 */
export function joinWavWithSilence(parts: Uint8Array[], silenceMs: number): Uint8Array {
  return joinWavSegments(
    parts,
    parts.map(() => silenceMs),
  );
}
