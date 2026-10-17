import { Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces/400Regular_Italic';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { Fraunces_700Bold_Italic } from '@expo-google-fonts/fraunces/700Bold_Italic';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { PlayfairDisplay_800ExtraBold } from '@expo-google-fonts/playfair-display/800ExtraBold';
import { useFonts } from 'expo-font';
import { DarkTheme, router, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { BrandSplash } from '@/components/BrandSplash';
import { colors, fonts } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { useSignOutReplay } from '@/hooks/useSignOutReplay';
import { useSyncQueue } from '@/hooks/useSyncQueue';
import { installDebugTools } from '@/lib/devTools';

// Only the weights the type scale uses, each from its own subpath: the packages' root
// index requires every weight, which would bundle ~50 font files.
const FONT_FILES = {
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
  Fraunces_700Bold_Italic,
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

  // Signing out plays the splash again (keyed remount) and lands on Welcome, the
  // signed-out start screen — the same way a cold start does.
  const signOutReplay = useSignOutReplay(user?.id ?? null);
  useEffect(() => {
    if (signOutReplay > 0) router.replace('/welcome');
  }, [signOutReplay]);

  // One splash instance for the whole cold start (its minimum-time timer must not
  // restart when loading ends). Until the session is known nothing renders under it:
  // mounting the stack early would briefly route a signed-in user to Welcome.
  return (
    <>
      {loading ? null : (
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
            <Stack.Screen
              name="journal/new"
              options={{ title: 'New Journal Entry', presentation: 'modal' }}
            />
            <Stack.Screen name="journal/[id]" options={{ title: 'Journal Entry' }} />
          </Stack.Protected>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="welcome" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ title: '' }} />
          </Stack.Protected>
          {/* Dev-only component gallery (R.2): needs no account or data, so it sits outside
              both guards. It must stay last: a blocked route redirects to the first
              available screen in this list, which has to be Welcome, not the gallery. */}
          <Stack.Screen name="dev-components" options={{ headerShown: false }} />
        </Stack>
      )}
      <BrandSplash key={signOutReplay} loading={loading} />
    </>
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
