import { VOICE_OPTIONS } from './aiVoice';

describe('VOICE_OPTIONS', () => {
  it('FR-512: offers at least one male and one female voice', () => {
    expect(VOICE_OPTIONS.some((v) => v.gender === 'male')).toBe(true);
    expect(VOICE_OPTIONS.some((v) => v.gender === 'female')).toBe(true);
  });

  it('every option has a non-empty id and label', () => {
    for (const voice of VOICE_OPTIONS) {
      expect(voice.id.trim().length).toBeGreaterThan(0);
      expect(voice.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate ids', () => {
    const ids = VOICE_OPTIONS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
