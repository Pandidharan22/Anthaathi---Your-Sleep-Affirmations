import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { DuskBackground } from '@/components/ui/DuskBackground';
import { gradientBackground } from '@/components/ui/gradient';
import { GradientText } from '@/components/ui/GradientText';
import { Icon, type IconName } from '@/components/ui/Icon';
import { NavHeader } from '@/components/ui/NavHeader';
import { colors, fonts, glows, gradients, radii, typography } from '@/constants/theme';
import { UNFILED_FOLDER_ID } from '@/lib/folderStats';

type Mode = 'recorded' | 'ai';

const MODES: { mode: Mode; title: string; caption: string; icon: IconName }[] = [
  { mode: 'recorded', title: 'Self-Recorded', caption: 'Speak it in your own voice', icon: 'mic' },
  { mode: 'ai', title: 'AI Guided', caption: 'Hear it narrated back to you', icon: 'voice' },
];

/**
 * The Mode Choice mockup: the one entry point for a new affirmation. Continue replaces
 * this screen with the matching record screen, passing on the folder it was started
 * from, so Back from there returns to wherever the user began.
 */
export default function NewAffirmationScreen() {
  const insets = useSafeAreaInsets();
  const { folderId } = useLocalSearchParams<{ folderId?: string }>();
  const [mode, setMode] = useState<Mode>('recorded');

  function handleContinue() {
    const params = folderId && folderId !== UNFILED_FOLDER_ID ? { folderId } : {};
    router.replace({
      pathname: mode === 'recorded' ? '/record' : '/ai-guided/script',
      params,
    });
  }

  return (
    <View style={styles.root}>
      <DuskBackground opacity={0.55} />
      <NavHeader title="New affirmation" leading="back" onLeadingPress={() => router.back()} />

      <View style={styles.intro}>
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel="How would you like it spoken?"
        >
          <Text style={styles.headline}>How would you like </Text>
          <View style={styles.headlineRow}>
            <GradientText style={[styles.headline, styles.headlineAccent]}>it spoken</GradientText>
            <Text style={styles.headline}>?</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>You can change your mind later.</Text>
      </View>

      <View accessibilityRole="radiogroup" style={styles.cards}>
        {MODES.map((option) => (
          <ModeCard
            key={option.mode}
            {...option}
            selected={mode === option.mode}
            onPress={() => setMode(option.mode)}
          />
        ))}
        <Text style={styles.privacy}>Voice never leaves your device.</Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 40 }]}>
        <Button label="Continue" onPress={handleContinue} />
      </View>
    </View>
  );
}

function ModeCard({
  title,
  caption,
  icon,
  selected,
  onPress,
}: {
  title: string;
  caption: string;
  icon: IconName;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={`${title}. ${caption}`}
      accessibilityState={{ checked: selected }}
      // react-native-web only exposes the checked state through aria-checked.
      aria-checked={selected}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View
        style={[
          styles.tile,
          selected ? [gradientBackground(gradients.actionFill), styles.tileGlow] : styles.tileIdle,
        ]}
      >
        <Icon name={icon} color={selected ? colors.background : colors.accent} size={26} />
      </View>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardCaption}>{caption}</Text>
      </View>
      {/* The filled check vs. an empty ring is the non-color cue for the chosen card. */}
      {selected ? (
        <View style={styles.check}>
          <Icon name="check" color={colors.background} size={12} />
        </View>
      ) : (
        <View style={styles.ring} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  intro: {
    paddingHorizontal: 28,
    paddingTop: 27,
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  headline: {
    ...typography.display,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  headlineAccent: {
    fontFamily: fonts.serifBoldItalic,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 10,
  },
  cards: {
    paddingHorizontal: 24,
    marginTop: 40,
    gap: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
  },
  cardSelected: {
    borderColor: colors.selected,
    boxShadow: glows.card,
  },
  tile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIdle: {
    backgroundColor: colors.elevated,
  },
  tileGlow: {
    boxShadow: glows.control,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    ...typography.subtitle,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  cardCaption: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: radii.full,
    backgroundColor: colors.selected,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 22,
    height: 22,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  privacy: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 0,
  },
});
