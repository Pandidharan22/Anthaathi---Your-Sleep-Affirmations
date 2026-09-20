import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors } from '@/constants/theme';

const lightNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: lightColors.background,
    card: lightColors.surface,
    text: lightColors.textPrimary,
    border: lightColors.border,
    primary: lightColors.primary,
  },
};

const darkNavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: darkColors.background,
    card: darkColors.surface,
    text: darkColors.textPrimary,
    border: darkColors.border,
    primary: darkColors.primary,
  },
};

export default function RootLayout() {
  const scheme = useColorScheme();

  return (
    <ThemeProvider value={scheme === 'dark' ? darkNavigationTheme : lightNavigationTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ title: 'Sign in' }} />
      </Stack>
    </ThemeProvider>
  );
}
