import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { DuskBackground } from '@/components/ui/DuskBackground';
import { gradientBackground } from '@/components/ui/gradient';
import { GradientText } from '@/components/ui/GradientText';
import { Icon } from '@/components/ui/Icon';
import { colors, fonts, glows, gradients, typography } from '@/constants/theme';

/**
 * Onboarding / Welcome mockup: the first screen a signed-out user sees. One page by
 * decision (2026-10-17) — the mockup's page dots are left out, since only this page is
 * designed and dots would promise more.
 */
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <DuskBackground />

      <View style={[styles.top, { paddingTop: insets.top + 43 }]}>
        <RingsIllustration />
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel="Fall asleep to your own voice"
          style={styles.headline}
        >
          <Text style={styles.headlineText}>Fall asleep to your</Text>
          <GradientText style={[styles.headlineText, styles.headlineAccent]}>
            own voice
          </GradientText>
        </View>
        <Text style={styles.body}>
          Record affirmations, loop them softly all night, and let new patterns take root.
        </Text>
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 40 }]}>
        <Button
          label="Get started"
          onPress={() => router.push('/sign-up')}
          style={styles.fullWidth}
        />
        <Button
          label="I already have an account"
          variant="ghost"
          onPress={() => router.push('/sign-in')}
        />
      </View>
    </View>
  );
}

/** The mockup's layered rings around a glowing mic. Decorative only, not a button. */
function RingsIllustration() {
  return (
    <View style={styles.rings} aria-hidden>
      <View
        style={[
          styles.ring,
          styles.ringHalo,
          gradientBackground(
            'radial-gradient(closest-side, rgba(169, 143, 196, 0.35) 0%, rgba(169, 143, 196, 0) 70%)',
          ),
        ]}
      />
      <View style={[styles.ring, styles.ringOuter]} />
      <View style={[styles.ring, styles.ringInner]} />
      <View style={[styles.ring, styles.core, gradientBackground(gradients.actionFill)]}>
        <Icon name="mic" color={colors.background} size={34} />
      </View>
    </View>
  );
}

const RINGS = 260;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  top: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  rings: {
    width: RINGS,
    height: RINGS,
    marginBottom: 40,
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
  },
  ringHalo: {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  ringOuter: {
    top: 30,
    left: 30,
    right: 30,
    bottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(195, 174, 218, 0.35)',
  },
  ringInner: {
    top: 60,
    left: 60,
    right: 60,
    bottom: 60,
    borderWidth: 1,
    borderColor: 'rgba(169, 143, 196, 0.4)',
  },
  core: {
    top: 92,
    left: 92,
    right: 92,
    bottom: 92,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: glows.control,
  },
  headline: {
    alignItems: 'center',
    maxWidth: 300,
  },
  headlineText: {
    ...typography.display,
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  headlineAccent: {
    fontFamily: fonts.serifBoldItalic,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    maxWidth: 300,
  },
  actions: {
    position: 'absolute',
    left: 32,
    right: 32,
    bottom: 0,
    alignItems: 'center',
    gap: 12,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
});
