import Slider from '@react-native-community/slider';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { mixGains } from '@/lib/bedPrefs';
import { BEDS } from '@/lib/beds';

type Props = {
  bedId: string | null;
  mix: number;
  onBedChange: (bedId: string | null) => void;
  /** Every slider movement, for applying the mix live. */
  onMixChange: (mix: number) => void;
  /** When the slider is released, for saving. */
  onMixCommit: (mix: number) => void;
};

/**
 * The audio studio controls (FR-304): which ambience bed plays under the affirmations, and one
 * slider balancing the voice against it. Used on the Player both before Play and while playing.
 */
export function BedPicker({ bedId, mix, onBedChange, onMixChange, onMixCommit }: Props) {
  const colors = useThemeColors();
  const hasBed = bedId !== null;
  const gains = mixGains(mix, hasBed);
  const percent = (gain: number) => Math.round(gain * 100);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Ambience</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {[null, ...BEDS].map((bed) => {
          const id = bed?.id ?? null;
          const selected = bedId === id;
          return (
            <Pressable
              key={id ?? 'none'}
              onPress={() => onBedChange(id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.chip,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primary : 'transparent',
                },
              ]}
            >
              <Text style={{ color: selected ? colors.background : colors.textPrimary }}>
                {bed?.label ?? 'None'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.mix, { opacity: hasBed ? 1 : 0.5 }]}>
        <View style={styles.mixLabels}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            More ambience · {percent(gains.bed)}%
          </Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            More voice · {percent(gains.voice)}%
          </Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          step={0.025}
          value={mix}
          disabled={!hasBed}
          onValueChange={onMixChange}
          onSlidingComplete={onMixCommit}
          minimumTrackTintColor={colors.border}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
          accessibilityLabel="Voice and ambience balance"
          accessibilityValue={{
            text: `Voice ${percent(gains.voice)} percent, ambience ${percent(gains.bed)} percent`,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch', gap: spacing.sm },
  label: { fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight },
  chipScroll: { flexGrow: 0 },
  chipRow: { gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  mix: { gap: spacing.xs },
  mixLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  slider: { alignSelf: 'stretch', height: 40 },
});
