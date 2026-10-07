import { splitIntoSentences } from '@/lib/voiceStyle';

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
