import {
  countSentences,
  estimateGenerationMs,
  estimateReadMs,
  firstSentence,
  titleFromScript,
} from './scriptStats';

describe('scriptStats', () => {
  const script =
    'I am calm and ready for rest. My body knows how to let go, and it is safe to be here, softly, until morning.';

  it('counts the sentences that will be read', () => {
    expect(countSentences(script)).toBe(2);
    expect(countSentences('   ')).toBe(0);
  });

  it('estimates reading time from words and the pauses the voices add', () => {
    // 24 words at 450 ms, plus one 1.8 s pause between the sentences.
    expect(estimateReadMs(script)).toBe(24 * 450 + 1800);
    // A "/" adds a short pause and isn't a word.
    expect(estimateReadMs('My strength / is permanent.')).toBe(4 * 450 + 500);
    expect(estimateReadMs('')).toBe(0);
  });

  it('takes the first sentence as written', () => {
    expect(firstSentence(script)).toBe('I am calm and ready for rest.');
    expect(firstSentence('')).toBe('');
  });

  it('makes a title from the first sentence', () => {
    expect(titleFromScript(script)).toBe('I am calm and ready for rest');
    expect(titleFromScript('My strength / is permanent.')).toBe('My strength is permanent');
    expect(
      titleFromScript('Every night my body remembers how to soften, slow down and rest deeply.'),
    ).toBe('Every night my body remembers how to…');
  });

  it('estimates generation time from reading time and the engine', () => {
    const script = 'I am calm.'; // 3 words: 1350 ms to read
    expect(estimateGenerationMs(script, 'natural')).toBe(2000 + 0.6 * 1350);
    expect(estimateGenerationMs(script, 'system')).toBe(1000 + 0.35 * 1350);
  });
});
