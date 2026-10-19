import type { ReactElement } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * The design's icon set, copied path-for-path from the Velvet Dusk board (24×24,
 * 2px round strokes) so screens match the mockups exactly. `filled` draws the shape
 * solid instead of stroked, as the board does for active play/pause glyphs.
 */
const ICONS = {
  plus: <Path d="M12 5v14M5 12h14" />,
  back: <Path d="M15 18l-6-6 6-6" />,
  chevronRight: <Path d="M9 18l6-6-6-6" />,
  close: <Path d="M6 6l12 12M6 18L18 6" />,
  more: (
    <>
      <Circle cx="5" cy="12" r="1.5" />
      <Circle cx="12" cy="12" r="1.5" />
      <Circle cx="19" cy="12" r="1.5" />
    </>
  ),
  check: <Path d="M4 12l6 6L20 6" />,
  checkSmall: <Path d="M4 12l4 4L20 4" />,
  moon: <Path d="M20 14c-1 6-6 8-10 8s-10-3-10-11a10 10 0 0 1 12-9c-3 3-4 8-2 12s6 5 10 0z" />,
  play: <Path d="M6 4l14 8-14 8V4z" />,
  pause: (
    <>
      <Rect x="6" y="4" width="4" height="16" rx="1.5" />
      <Rect x="14" y="4" width="4" height="16" rx="1.5" />
    </>
  ),
  rewind: <Path d="M11 5L4 12l7 7M20 5l-7 7 7 7" />,
  forward: <Path d="M13 5l7 7-7 7M4 5l7 7-7 7" />,
  goal: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Circle cx="12" cy="12" r="5" />
    </>
  ),
  target: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Circle cx="12" cy="12" r="5" />
      <Circle cx="12" cy="12" r="1.5" />
    </>
  ),
  journal: <Path d="M4 4h7v16H6a2 2 0 0 1-2-2V4zm16 0h-7v16h5a2 2 0 0 0 2-2V4z" />,
  settings: <Path d="M3 6h10m4 0h4M3 12h4m4 0h10M3 18h13m4 0h1" />,
  folder: <Path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />,
  heart: (
    <Path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
  ),
  mic: (
    <Path d="M12 2v11m0 0a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm-7-3a7 7 0 0 0 14 0M12 19v3" />
  ),
  micSmall: (
    <Path d="M12 2v11m0 0a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm-7-3a7 7 0 0 0 14 0" />
  ),
  voice: (
    <>
      <Path d="M4 9v6h4l5 4V5L8 9H4z" />
      <Path d="M16 8a5 5 0 0 1 0 8" />
      <Path d="M19 5a9 9 0 0 1 0 14" />
    </>
  ),
  voiceMuted: (
    <>
      <Path d="M4 9v6h4l5 4V5L8 9H4z" />
      <Path d="M18 8l4 8M22 8l-4 8" />
    </>
  ),
  loop: <Path d="M17 2l4 4-4 4M3 12v-2a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 12v2a4 4 0 0 1-4 4H3" />,
  music: (
    <Path d="M9 18V5l12-2v13M9 9l12-2M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm12-3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
  ),
  flame: (
    <>
      <Path d="M12 2s-4 4-4 8a4 4 0 0 0 8 0c0-2-1-3-2-4 0 2-1 3-2 3s-1-2 0-4 0-3 0-3z" />
      <Path d="M8 14a4 4 0 0 0 8 0c0 4-2 8-4 8s-4-4-4-8z" />
    </>
  ),
  bell: <Path d="M15 17h5l-2-2v-5a6 6 0 0 0-12 0v5l-2 2h5m6 0v1a3 3 0 1 1-6 0v-1" />,
  clock: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v5l3 2" />
    </>
  ),
  lock: (
    <>
      <Rect x="4" y="10" width="16" height="10" rx="2" />
      <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  message: <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  trash: (
    <Path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  ),
  info: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 8v4M12 16h.01" />
    </>
  ),
  scissors: (
    <>
      <Circle cx="6" cy="6" r="3" />
      <Circle cx="6" cy="18" r="3" />
      <Path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
    </>
  ),
  warning: <Path d="M12 3v10m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />,
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  color: string;
  size?: number;
  filled?: boolean;
};

/** Decorative by default: label the control that contains it, not the icon. */
export function Icon({ name, color, size = 20, filled = false }: IconProps) {
  // aria-hidden on a plain View keeps the icon out of the accessibility tree on both
  // Android and web (a11y props set on the Svg itself leak into the web DOM).
  return (
    <View aria-hidden>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={filled ? color : 'none'}
        stroke={filled ? 'none' : color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICONS[name]}
      </Svg>
    </View>
  );
}
