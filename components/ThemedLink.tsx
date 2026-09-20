import { Link, type LinkProps } from 'expo-router';

import { useThemeColors } from '@/hooks/useThemeColors';

/**
 * expo-router's Link renders with a plain black default text color, which
 * disappears against a dark background — this wraps it so every link picks
 * up the current theme's primary color without each call site having to
 * remember to style it.
 */
export function ThemedLink({ style, ...props }: LinkProps) {
  const colors = useThemeColors();

  return <Link {...props} style={[{ color: colors.primary }, style]} />;
}
