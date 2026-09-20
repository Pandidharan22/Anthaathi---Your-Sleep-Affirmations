/**
 * Design tokens. Night-leaning palette (deep, warm neutrals) with a gold accent —
 * ties to the brand's end-of-night/dawn framing rather than a generic "sleep app blue."
 * Full WCAG contrast audit is deferred to Execution Plan step 5.3
 * (design:accessibility-review); values below were chosen for generous perceptual
 * contrast as a working baseline, not yet formally verified.
 */

const palette = {
  gold: '#D9A441',
  violet: '#6B5CA5',
  success: '#4CAF7D',
  error: '#E5654D',
  info: '#5B8DEF',
} as const;

export type ThemeColors = {
  background: string;
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  primary: string;
  secondary: string;
  success: string;
  error: string;
  info: string;
};

export const lightColors: ThemeColors = {
  background: '#FBFAF8',
  surface: '#F4F2EF',
  border: '#E4E1DB',
  textPrimary: '#1A1A1A',
  textSecondary: '#5C5A56',
  primary: palette.gold,
  secondary: palette.violet,
  success: palette.success,
  error: palette.error,
  info: palette.info,
};

export const darkColors: ThemeColors = {
  background: '#0F1115',
  surface: '#1A1D24',
  border: '#2A2E37',
  textPrimary: '#F5F3EF',
  textSecondary: '#A8A6A0',
  primary: palette.gold,
  secondary: palette.violet,
  success: palette.success,
  error: palette.error,
  info: palette.info,
};

export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '700' },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '600' },
  subtitle: { fontSize: 18, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 6,
  md: 12,
  lg: 20,
  full: 999,
} as const;
