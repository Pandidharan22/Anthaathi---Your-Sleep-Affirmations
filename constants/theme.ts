/**
 * Design tokens — the "Velvet Dusk" direction in docs/DESIGN.md, which is the
 * reference for every value here (and for the contrast ratios `theme.test.ts` checks).
 *
 * Dark-only for now: the design is dark-first and DESIGN.md defers a light theme
 * (NFR-403), so there is a single color set. `useThemeColors()` stays the one way
 * screens read colors, so a light set can slot back in behind it later.
 *
 * Color roles:
 * - `action` (mauve) means "do something": filled buttons, links' light variant.
 * - `selected` (terracotta) means "this is chosen or on": selected chips, active tab,
 *   toggles, and the warm glow around the round voice controls (`glows`). It is never
 *   used for text buttons or small utility icons. Terracotta and mauve are only 1.18:1
 *   apart, so every selected state must also have a non-color cue (fill, border,
 *   checkmark) — never rely on hue alone.
 * - Text and icons drawn on an `action`/`selected` fill use `background` (dark):
 *   cream on mauve is 2.47:1, a WCAG fail.
 */

export const colors = {
  /** Screen background; also the text/icon color on `action` and `selected` fills. */
  background: '#1D1622',
  /** Cards, inputs, small icon buttons. */
  surface: '#271E2E',
  /** Chips, sheets — one step above `surface`. */
  elevated: '#362A3F',
  /** Unselected outlines, inactive step dots, unplayed waveform. */
  border: '#4A3B54',
  /** Warm cream, kept on purpose for a little warmth. */
  textPrimary: '#F7EEE3',
  textSecondary: '#C9BDB0',
  /** Timestamps, inactive tab labels. */
  textMuted: '#8B8090',
  /** Mauve: actions (filled buttons, spinners). */
  action: '#A98FC4',
  /** Light mauve: accent text, links and icons; light end of filled controls. */
  accent: '#C3AEDA',
  /** Terracotta: selected/on states only — see the role notes above. */
  selected: '#E3946E',
  success: '#8FBF9F',
  /** Cool rose for errors and destructive actions. */
  error: '#E07A8A',
  info: '#8FA3D9',
} as const;

export type ThemeColors = typeof colors;

/**
 * CSS gradient strings for React Native's `experimental_backgroundImage`.
 * `actionFill` is the filled-control gradient (primary button, play, record,
 * progress); `velvetDusk` is the full-screen hero ramp.
 */
export const gradients = {
  actionFill: `linear-gradient(135deg, ${colors.action} 0%, ${colors.accent} 100%)`,
  velvetDusk: `linear-gradient(180deg, ${colors.background} 0%, ${colors.elevated} 65%, ${colors.action} 100%)`,
} as const;

/**
 * Terracotta glows (`boxShadow` strings) around the big round voice controls, at the
 * levels settled in DESIGN.md: one layer, ~60–65% opacity, ~40px reach.
 * rgba(227,148,110) is `colors.selected`.
 */
export const glows = {
  /** Mic and play buttons, Mode Choice tile. */
  control: '0px 0px 36px 4px rgba(227, 148, 110, 0.62)',
  /** Player pause, Generating orb. */
  hero: '0px 0px 40px 4px rgba(227, 148, 110, 0.65)',
  /** Trim handles. */
  handle: '0px 0px 14px 2px rgba(227, 148, 110, 0.62)',
} as const;

/** Font family names, as registered by `useFonts` in `app/_layout.tsx`. */
export const fonts = {
  wordmark: 'PlayfairDisplay_800ExtraBold',
  serifBold: 'Fraunces_700Bold',
  serifSemiBold: 'Fraunces_600SemiBold',
  serifItalic: 'Fraunces_400Regular_Italic',
  /** Italic accents inside bold headings, e.g. Welcome's "own voice". */
  serifBoldItalic: 'Fraunces_700Bold_Italic',
  sans: 'Nunito_400Regular',
  sansSemiBold: 'Nunito_600SemiBold',
  sansBold: 'Nunito_700Bold',
} as const;

/**
 * Type scale. Each weight is its own font file, so styles set `fontFamily` and no
 * `fontWeight` — on Android, a `fontWeight` on a custom family can fall back to the
 * system font or a synthetic bold.
 */
export const typography = {
  /** "Anthaathi" on the splash only. */
  wordmark: { fontFamily: fonts.wordmark, fontSize: 56, lineHeight: 68 },
  display: { fontFamily: fonts.serifBold, fontSize: 32, lineHeight: 40 },
  title: { fontFamily: fonts.serifSemiBold, fontSize: 24, lineHeight: 32 },
  /** Subtitles and card titles. */
  subtitle: { fontFamily: fonts.serifSemiBold, fontSize: 18, lineHeight: 26 },
  /** Taglines, quoted affirmations, journal prompts. */
  quote: { fontFamily: fonts.serifItalic, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
  button: { fontFamily: fonts.sansBold, fontSize: 15, lineHeight: 20 },
  /** Field labels — uppercase. */
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
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
  /** Inputs. */
  md: 12,
  /** Cards. */
  lg: 20,
  /** Pills: buttons and chips. */
  full: 999,
} as const;
