import { greeting } from './greeting';

const at = (hour: number) => new Date(2026, 9, 18, hour, 30);

describe('greeting', () => {
  it.each([
    [4, 'Good evening, Maya.'],
    [5, 'Good morning, Maya.'],
    [11, 'Good morning, Maya.'],
    [12, 'Good afternoon, Maya.'],
    [16, 'Good afternoon, Maya.'],
    [17, 'Good evening, Maya.'],
    [23, 'Good evening, Maya.'],
  ])('at %i:30 says "%s"', (hour, expected) => {
    expect(greeting(at(hour), 'Maya')).toBe(expected);
  });

  it('leaves the name out when there is none', () => {
    expect(greeting(at(21), undefined)).toBe('Good evening.');
    expect(greeting(at(21), '   ')).toBe('Good evening.');
  });
});
