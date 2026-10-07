// Minimal PCM WAV helpers. Android's TextToSpeech.synthesizeToFile writes plain PCM WAV, and
// the only thing we need is to join several of those with silence between them (the TTS
// engine has no way to pause between sentences by itself), so this deliberately supports
// nothing but uncompressed PCM.

type WavFormat = { channels: number; sampleRate: number; bitsPerSample: number };
type ParsedWav = { format: WavFormat; pcm: Uint8Array };

const HEADER_BYTES = 44;

function readTag(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
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
      if (view.getUint16(body, true) !== 1) throw new Error('Only uncompressed PCM WAV is supported');
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

/**
 * Joins PCM WAV files end to end with `silenceMs` of silence between each pair (none before the
 * first or after the last). All inputs must share the same format, which holds for one voice
 * synthesized by one engine in one session; a mismatch throws instead of producing garbage.
 */
export function joinWavWithSilence(parts: Uint8Array[], silenceMs: number): Uint8Array {
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
  const silenceFrames = Math.round((silenceMs / 1000) * format.sampleRate);
  const silence = new Uint8Array(silenceFrames * bytesPerFrame); // zeros = silence in signed PCM16
  const gaps = parsed.length - 1;
  const dataBytes = parsed.reduce((sum, p) => sum + p.pcm.length, 0) + gaps * silence.length;

  const out = new Uint8Array(HEADER_BYTES + dataBytes);
  out.set(buildHeader(format, dataBytes), 0);
  let cursor = HEADER_BYTES;
  parsed.forEach((p, i) => {
    out.set(p.pcm, cursor);
    cursor += p.pcm.length;
    if (i < gaps) {
      out.set(silence, cursor);
      cursor += silence.length;
    }
  });
  return out;
}
