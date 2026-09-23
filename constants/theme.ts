/**
 * Design tokens. Night-leaning palette (deep, warm neutrals) with a gold accent —
 * ties to the brand's end-of-night/dawn framing rather than a generic "sleep app blue."
 * Full WCAG contrast audit is deferred to Execution Plan step 5.3
 * (design:accessibility-review); values below were chosen for generous perceptual
 * contrast as a working baseline, not yet formally verified.
 *
 * `primary`/`secondary`/`success`/`error`/`info` were originally flat (identical
 * value in both color schemes), unlike the neutrals above them — fine for a fill
 * or border, but a single hex can't hit AA contrast as *text* against both a
 * near-black and a near-white background at once. `success` is now mode-aware
 * (Execution Plan step 2.6's design pass — its only current uses, the goal
 * "Achieved" badge/toggle, are text) and `accentText` is a dedicated
 * text-safe variant of the violet accent (used for journal prompts), so the
 * `secondary` fill color itself (e.g. TrimEditor's save button) stays untouched.
 * `primary`/`error` as text/fill-partner still fail AA in light mode (primary as
 * text ~2.2:1, error as caption-size text ~3.2:1) but are used pervasively across
 * every phase's buttons — left for the full step 5.3 audit rather than changed
 * here as a side effect of a Phase-2-scoped pass.
 */

const palette = {
  gold: '#D9A441',
  violet: '#6B5CA5',
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
  /** Text-safe variant of the violet accent — use for violet text, not `secondary`'s fills/borders. */
  accentText: string;
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
  accentText: palette.violet, // 5.44:1 on this mode's background — already AA-safe as-is
  success: '#357A58', // darkened from the flat #4CAF7D — 4.94:1 on this mode's background (was 2.60:1)
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
  accentText: '#897DB7', // lightened from the flat #6B5CA5 — 5.11:1 on this mode's background (was 3.33:1)
  success: '#4CAF7D',
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
