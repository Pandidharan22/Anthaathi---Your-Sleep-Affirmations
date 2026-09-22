import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, useColorScheme, View } from 'react-native';

import { darkColors, lightColors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { useSyncQueue } from '@/hooks/useSyncQueue';
import { installDebugTools } from '@/lib/devTools';

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

function NavigationStack() {
  const { session, loading, user } = useAuth();
  const colors = useColorScheme() === 'dark' ? darkColors : lightColors;

  useSyncQueue(!!session);

  useEffect(() => {
    if (__DEV__) installDebugTools(user?.id ?? null);
  }, [user?.id]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="record"
          options={{ title: 'New Recording', presentation: 'modal', headerBackVisible: false }}
        />
        <Stack.Screen
          name="affirmation/[id]/trim"
          options={{ title: 'Recording', presentation: 'modal' }}
        />
        <Stack.Screen name="folders" options={{ title: 'Folders' }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="auth" options={{ title: 'Sign in', headerBackVisible: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();

  return (
    <ThemeProvider value={scheme === 'dark' ? darkNavigationTheme : lightNavigationTheme}>
      <AuthProvider>
        <NavigationStack />
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
