import { formatDuration } from './format';

describe('formatDuration', () => {
  it('formats whole minutes and seconds as m:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5000)).toBe('0:05');
    expect(formatDuration(65000)).toBe('1:05');
    expect(formatDuration(600000)).toBe('10:00');
  });

  it('floors partial seconds', () => {
    expect(formatDuration(5999)).toBe('0:05');
  });

  it('clamps negative input to 0:00 instead of rendering a broken string', () => {
    expect(formatDuration(-1000)).toBe('0:00');
  });
});
