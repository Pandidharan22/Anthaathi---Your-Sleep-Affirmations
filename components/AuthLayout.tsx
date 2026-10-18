import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DuskBackground } from '@/components/ui/DuskBackground';
import { NavHeader } from '@/components/ui/NavHeader';
import { colors, typography } from '@/constants/theme';

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  /** Sign In's subtitle is the italic serif line; Sign Up's is plain body text. */
  subtitleItalic?: boolean;
  /** Sign Up sits on the dusk mesh; Sign In is the plain background (as in the mockups). */
  mesh?: boolean;
  /** Runs before going back, e.g. to leave a half-finished password reset cleanly. */
  onBack?: () => void;
  children: ReactNode;
};

/** Back to wherever the user came from, or Welcome when there is nothing to go back to. */
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/welcome');
}

/**
 * The shared frame of the Sign Up and Sign In mockups: a back button, a large serif
 * title with a subtitle, then the form, scrolling above the keyboard.
 */
export function AuthLayout({
  title,
  subtitle,
  subtitleItalic,
  mesh,
  onBack,
  children,
}: AuthLayoutProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      {mesh ? <DuskBackground /> : null}
      <NavHeader
        leading="back"
        onLeadingPress={() => {
          onBack?.();
          goBack();
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        >
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={subtitleItalic ? styles.subtitleItalic : styles.subtitle}>{subtitle}</Text>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 28,
    // The mockups place the title 130pt from the top, about 27pt below the nav row.
    paddingTop: 27,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 10,
  },
  subtitleItalic: {
    ...typography.quote,
    color: colors.textSecondary,
    marginTop: 10,
  },
});
