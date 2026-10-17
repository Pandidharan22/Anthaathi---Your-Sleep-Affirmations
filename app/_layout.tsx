import { Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces/400Regular_Italic';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { PlayfairDisplay_800ExtraBold } from '@expo-google-fonts/playfair-display/800ExtraBold';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { useSyncQueue } from '@/hooks/useSyncQueue';
import { installDebugTools } from '@/lib/devTools';

// Only the weights the type scale uses, each from its own subpath: the packages' root
// index requires every weight, which would bundle ~50 font files.
const FONT_FILES = {
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  PlayfairDisplay_800ExtraBold,
};

// Header titles and back labels come from here. `primary` tints header buttons
// (back), which DESIGN.md keeps out of the terracotta accent, so it is light mauve;
// the tab bar sets its own terracotta active tint.
const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.accent,
  },
  fonts: {
    regular: { fontFamily: fonts.sans, fontWeight: 'normal' },
    medium: { fontFamily: fonts.sansSemiBold, fontWeight: 'normal' },
    bold: { fontFamily: fonts.serifSemiBold, fontWeight: 'normal' },
    heavy: { fontFamily: fonts.serifBold, fontWeight: 'normal' },
  },
} satisfies typeof DarkTheme;

function NavigationStack() {
  const { session, loading, user } = useAuth();
  useSyncQueue(!!session);

  useEffect(() => {
    if (__DEV__) installDebugTools(user?.id ?? null);
  }, [user?.id]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.action} />
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
        <Stack.Screen name="goal/new" options={{ title: 'New Goal', presentation: 'modal' }} />
        <Stack.Screen name="goal/[id]" options={{ title: 'Goal' }} />
        <Stack.Screen name="journal/new" options={{ title: 'New Journal Entry', presentation: 'modal' }} />
        <Stack.Screen name="journal/[id]" options={{ title: 'Journal Entry' }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="auth" options={{ title: 'Sign in', headerBackVisible: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // A font that fails to load falls back to the system font rather than blocking the
  // app, so only wait while loading is still in progress.
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="light" />
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
