import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { BrandSplash, SPLASH_MIN_MS } from './BrandSplash';

let reduceMotion = true;

beforeEach(() => {
  jest.useFakeTimers();
  reduceMotion = true;
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockImplementation(() => Promise.resolve(reduceMotion));
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

describe('BrandSplash', () => {
  it('stays for the minimum time even when loading finished at once', async () => {
    await render(<BrandSplash loading={false} />);

    await advance(SPLASH_MIN_MS - 100);
    expect(screen.getByTestId('brand-splash')).toBeTruthy();

    await advance(100);
    expect(screen.queryByTestId('brand-splash')).toBeNull();
  });

  it('waits for loading to finish after the minimum time', async () => {
    const { rerender } = await render(<BrandSplash loading />);

    await advance(SPLASH_MIN_MS * 3);
    expect(screen.getByTestId('brand-splash')).toBeTruthy();

    await rerender(<BrandSplash loading={false} />);
    await advance(0);
    expect(screen.queryByTestId('brand-splash')).toBeNull();
  });

  it('fades out and unmounts when reduce motion is off', async () => {
    reduceMotion = false;
    await render(<BrandSplash loading={false} />);

    await advance(SPLASH_MIN_MS);
    expect(screen.getByTestId('brand-splash')).toBeTruthy(); // fading, still mounted

    await advance(1000);
    expect(screen.queryByTestId('brand-splash')).toBeNull();
  });

  it('announces the brand and tagline once, as a single element', async () => {
    await render(<BrandSplash loading />);

    expect(
      screen.getByLabelText('Anthaathi. Where old patterns end, new ones begin.'),
    ).toBeTruthy();
  });
});
