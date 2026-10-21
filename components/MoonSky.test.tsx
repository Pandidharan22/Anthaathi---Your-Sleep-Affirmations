import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { MoonSky, STARS } from './MoonSky';

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

describe('MoonSky', () => {
  it('is decoration only: nothing in it reaches a screen reader', async () => {
    await render(<MoonSky glowSize={240} animate />);
    expect(screen.toJSON()).toBeTruthy();
    expect(screen.queryAllByRole('image')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('draws the moon and every star as a star shape, playing or paused', async () => {
    const { rerender, toJSON } = await render(<MoonSky glowSize={240} animate />);
    const svgCount = () => JSON.stringify(toJSON()).match(/RNSVGSvgView/g)?.length ?? 0;
    expect(svgCount()).toBe(1 + STARS.length);
    await rerender(<MoonSky glowSize={240} animate={false} />);
    expect(svgCount()).toBe(1 + STARS.length);
  });

  it('scatters plenty of stars over the sky, clear of the moon', () => {
    expect(STARS.length).toBeGreaterThanOrEqual(25);
    for (const { x, y } of STARS) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(((x - 50) / 26) ** 2 + ((y - 50) / 30) ** 2).toBeGreaterThanOrEqual(1);
    }
    // Spread over every side of the moon, not bunched on one.
    expect(STARS.some((s) => s.x < 25)).toBe(true);
    expect(STARS.some((s) => s.x > 75)).toBe(true);
    expect(STARS.some((s) => s.y < 25)).toBe(true);
    expect(STARS.some((s) => s.y > 75)).toBe(true);
  });
});
