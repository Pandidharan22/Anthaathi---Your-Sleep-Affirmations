import { splitIntoPhrases, splitIntoSentences } from '@/lib/voiceStyle';

describe('splitIntoSentences', () => {
  it('splits on sentence punctuation and keeps it', () => {
    expect(splitIntoSentences('I am calm. I am safe! Am I loved? Yes.')).toEqual([
      'I am calm.',
      'I am safe!',
      'Am I loved?',
      'Yes.',
    ]);
  });

  it('treats each line as its own affirmation and drops blanks', () => {
    expect(splitIntoSentences('I am calm\n\n  I am safe  \n')).toEqual(['I am calm', 'I am safe']);
  });

  it('returns a single piece for a single sentence, and nothing for empty input', () => {
    expect(splitIntoSentences('My strength is permanent')).toEqual(['My strength is permanent']);
    expect(splitIntoSentences('  \n ')).toEqual([]);
  });

  it('does not split decimals or abbreviations without a following space', () => {
    expect(splitIntoSentences('I save 3.5 percent daily.')).toEqual(['I save 3.5 percent daily.']);
  });
});

describe('splitIntoSentences with pause marks', () => {
  it('turns "/" into a comma so a system voice never says "slash"', () => {
    expect(splitIntoSentences('My strength / is permanent. Calm /.')).toEqual([
      'My strength, is permanent.',
      'Calm.',
    ]);
  });
});

describe('splitIntoPhrases', () => {
  const pauses = { sentencePauseMs: 1800, phrasePauseMs: 500 };

  it("matches the user's therapeutic pacing example", () => {
    expect(
      splitIntoPhrases(
        'I am deserving. My strength / is permanent. I am calm, safe / and at peace.',
        pauses,
      ),
    ).toEqual([
      { text: 'I am deserving.', pauseAfterMs: 1800 },
      { text: 'My strength,', pauseAfterMs: 500 },
      { text: 'is permanent.', pauseAfterMs: 1800 },
      { text: 'I am calm,', pauseAfterMs: 500 },
      { text: 'safe,', pauseAfterMs: 500 },
      { text: 'and at peace.', pauseAfterMs: 0 },
    ]);
  });

  it('treats lines as sentences and gives the last phrase no pause', () => {
    expect(splitIntoPhrases('I am calm\nI am safe', pauses)).toEqual([
      { text: 'I am calm', pauseAfterMs: 1800 },
      { text: 'I am safe', pauseAfterMs: 0 },
    ]);
  });

  it('does not split a number like 1,000 or leave empty phrases from stray marks', () => {
    expect(splitIntoPhrases('I save 1,000 coins / daily. / ', pauses)).toEqual([
      { text: 'I save 1,000 coins,', pauseAfterMs: 500 },
      { text: 'daily.', pauseAfterMs: 0 },
    ]);
  });

  it('returns nothing for an empty script', () => {
    expect(splitIntoPhrases('  ', pauses)).toEqual([]);
  });
});
