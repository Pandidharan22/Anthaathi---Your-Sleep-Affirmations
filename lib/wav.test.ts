import { joinWavWithSilence, parseWav } from '@/lib/wav';

function makeWav(samples: number[], sampleRate = 1000): Uint8Array {
  const data = new Uint8Array(samples.length * 2);
  const dv = new DataView(data.buffer);
  samples.forEach((s, i) => dv.setInt16(i * 2, s, true));
  const out = new Uint8Array(44 + data.length);
  const v = new DataView(out.buffer);
  const tag = (o: number, t: string) => [...t].forEach((c, i) => (out[o + i] = c.charCodeAt(0)));
  tag(0, 'RIFF');
  v.setUint32(4, 36 + data.length, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  tag(36, 'data');
  v.setUint32(40, data.length, true);
  out.set(data, 44);
  return out;
}

function samplesOf(wav: Uint8Array): number[] {
  const { pcm } = parseWav(wav);
  const dv = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  return Array.from({ length: pcm.length / 2 }, (_, i) => dv.getInt16(i * 2, true));
}

describe('joinWavWithSilence', () => {
  it('puts silence between parts only, and writes a valid header', () => {
    const joined = joinWavWithSilence([makeWav([1, 2, 3]), makeWav([4, 5]), makeWav([6])], 2);
    // 1 kHz mono: 2 ms of silence = 2 frames of zeros between each pair.
    expect(samplesOf(joined)).toEqual([1, 2, 3, 0, 0, 4, 5, 0, 0, 6]);
    const parsed = parseWav(joined);
    expect(parsed.format).toEqual({ channels: 1, sampleRate: 1000, bitsPerSample: 16 });
    const dv = new DataView(joined.buffer);
    expect(dv.getUint32(4, true)).toBe(joined.length - 8);
    expect(dv.getUint32(40, true)).toBe(joined.length - 44);
  });

  it('returns a single part unchanged in content', () => {
    expect(samplesOf(joinWavWithSilence([makeWav([7, 8])], 500))).toEqual([7, 8]);
  });

  it('rejects mismatched formats rather than producing garbage', () => {
    expect(() => joinWavWithSilence([makeWav([1], 1000), makeWav([1], 2000)], 1)).toThrow(
      /different formats/,
    );
  });

  it('rejects non-WAV input and an empty list', () => {
    expect(() => joinWavWithSilence([new Uint8Array(20)], 1)).toThrow(/RIFF/);
    expect(() => joinWavWithSilence([], 1)).toThrow(/No WAV parts/);
  });

  it('tolerates extra chunks before data and a data size larger than the file', () => {
    const base = makeWav([9, 9, 9, 9]);
    // Insert a 4-byte LIST chunk between fmt and data.
    const extra = new Uint8Array([76, 73, 83, 84, 4, 0, 0, 0, 1, 2, 3, 4]);
    const withList = new Uint8Array([...base.subarray(0, 36), ...extra, ...base.subarray(36)]);
    expect(samplesOf(withList)).toEqual([9, 9, 9, 9]);
    // Truncate the last sample; the header still claims 8 data bytes.
    const truncated = base.subarray(0, base.length - 2);
    expect(samplesOf(truncated)).toEqual([9, 9, 9]);
  });
});
