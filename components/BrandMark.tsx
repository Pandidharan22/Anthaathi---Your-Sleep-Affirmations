import { Image, View } from 'react-native';
import Svg, { Defs, Image as SvgImage, LinearGradient, Mask, Rect, Stop } from 'react-native-svg';

import { colors } from '@/constants/theme';

const MARK = require('@/assets/brand/anthaathi-mark-cradle.png');
// Pre-blurred mauve glow, built from the cutout by scripts/make-brand-glow.js.
const GLOW = require('@/assets/brand/anthaathi-mark-cradle-glow.png');
// Source sizes: the cutout is 638 × 328, the glow adds GLOW_PAD on every side.
const MARK_W = 638;
const MARK_H = 328;
const GLOW_PAD = 200; // must match PAD in scripts/make-brand-glow.js

type BrandMarkProps = {
  width: number;
};

/**
 * The "Cradle" logo (crescent + அ) with its mauve glow, as on the Splash mockup.
 *
 * The PNG is white + alpha (docs/DESIGN.md "Logo"), so it is drawn as an SVG mask over
 * the board's light mauve → mauve gradient. The glow is a pre-baked image of the
 * mockup's `drop-shadow(0 0 20px ...)` (now in the glow mauve), drawn at the same scale and
 * position as the mark, so it follows the mark's shape exactly.
 *
 * Earlier attempts failed on Android: masked-view with an Image mask and a CSS
 * `drop-shadow` filter drew nothing, and a runtime `blurRadius` copy couldn't spread
 * past its own edges (so it had to be enlarged, and looked like a second, bigger logo).
 */
export function BrandMark({ width }: BrandMarkProps) {
  const scale = width / MARK_W;
  const height = Math.round(MARK_H * scale);
  const pad = GLOW_PAD * scale;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Anthaathi"
      style={{ width, height }}
    >
      <Image
        source={GLOW}
        style={{
          position: 'absolute',
          top: -pad,
          left: -pad,
          width: width + pad * 2,
          height: height + pad * 2,
        }}
      />
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="markFill" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.accent} />
            <Stop offset="1" stopColor={colors.action} />
          </LinearGradient>
          <Mask id="markShape" maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
            <SvgImage
              href={MARK}
              x="0"
              y="0"
              width={width}
              height={height}
              preserveAspectRatio="xMidYMid meet"
            />
          </Mask>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={width}
          height={height}
          fill="url(#markFill)"
          mask="url(#markShape)"
        />
      </Svg>
    </View>
  );
}
