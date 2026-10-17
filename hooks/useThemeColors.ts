import { colors, type ThemeColors } from '@/constants/theme';

/**
 * The one way screens read colors. The app is dark-only for now (see
 * constants/theme.ts), so this returns the single set; a light theme (NFR-403)
 * would switch here on `useColorScheme()`.
 */
export function useThemeColors(): ThemeColors {
  return colors;
}
