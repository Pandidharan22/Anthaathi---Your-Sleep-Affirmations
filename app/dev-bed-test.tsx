import { setAudioModeAsync } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { startBedLoop, type BedLoop } from '@/lib/bedLoop';
import { DEFAULT_BED_BALANCE, getBedPreference, setBedPreference } from '@/lib/bedPrefs';
import { BEDS, getBed } from '@/lib/beds';

/**
 * Temporary, __DEV__-only screen for Execution Plan step 4.2's bed engine. Sets the saved bed +
 * balance the Player uses, and previews a bed on its own so the loop seam can be judged by ear
 * across several cycles (including with the screen locked). Remove once step 4.3 builds the
 * real bed picker and balance slider into the Player.
 */
const BALANCES = [0.15, 0.35, 0.6, 1] as const;

export default function DevBedTestScreen() {
  const colors = useThemeColors();
  const [bedId, setBedId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(DEFAULT_BED_BALANCE);
  const [previewing, setPreviewing] = useState(false);
  const loopRef = useRef<BedLoop | null>(null);

  useEffect(() => {
    getBedPreference().then((pref) => {
      setBedId(pref.bedId);
      setBalance(pref.balance);
    });
    return () => loopRef.current?.stop();
  }, []);

  function save(nextBedId: string | null, nextBalance: number) {
    setBedId(nextBedId);
    setBalance(nextBalance);
    setBedPreference({ bedId: nextBedId, balance: nextBalance });
    loopRef.current?.setBalance(nextBalance);
  }

  async function togglePreview() {
    if (previewing) {
      loopRef.current?.stop();
      loopRef.current = null;
      setPreviewing(false);
      return;
    }
    const bed = getBed(bedId);
    if (!bed) return;
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
    loopRef.current = startBedLoop(bed, balance);
    setPreviewing(true);
  }

  const chip = (selected: boolean) => [
    styles.chip,
    {
      borderColor: selected ? colors.primary : colors.border,
      backgroundColor: selected ? colors.primary : 'transparent',
    },
  ];
  const chipText = (selected: boolean) => ({
    color: selected ? colors.background : colors.textPrimary,
  });

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>Bed test (dev)</Text>
      <Text style={{ color: colors.textSecondary }}>
        Saved bed and balance are what the Player tab uses next time you press Play.
      </Text>

      <Text style={[styles.label, { color: colors.textSecondary }]}>Bed</Text>
      <View style={styles.row}>
        {[...BEDS, null].map((bed) => {
          const selected = bedId === (bed?.id ?? null);
          return (
            <Pressable
              key={bed?.id ?? 'none'}
              onPress={() => save(bed?.id ?? null, balance)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={chip(selected)}
            >
              <Text style={chipText(selected)}>{bed?.label ?? 'None'}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>Balance</Text>
      <View style={styles.row}>
        {BALANCES.map((value) => {
          const selected = balance === value;
          return (
            <Pressable
              key={value}
              onPress={() => save(bedId, value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={chip(selected)}
            >
              <Text style={chipText(selected)}>{Math.round(value * 100)}%</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={togglePreview}
        disabled={!bedId}
        accessibilityRole="button"
        style={[
          styles.button,
          { backgroundColor: colors.primary, opacity: bedId ? 1 : 0.5 },
        ]}
      >
        <Text style={{ color: colors.background, fontWeight: '600' }}>
          {previewing ? 'Stop preview' : 'Preview bed alone'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  title: {
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontWeight: typography.title.fontWeight,
  },
  label: { fontSize: typography.caption.fontSize },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  button: {
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
});
