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
 * The slider only appears with a bed chosen: without one there is nothing to balance, and the
 * voice plays at full.
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
              accessibilityLabel={bed ? `${bed.label} ambience` : 'No ambience'}
              accessibilityState={{ selected }}
              hitSlop={CHIP_HIT_SLOP}
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

      {hasBed ? (
        <View style={styles.mix}>
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
            onValueChange={onMixChange}
            onSlidingComplete={onMixCommit}
            minimumTrackTintColor={colors.textSecondary}
            maximumTrackTintColor={colors.textSecondary}
            thumbTintColor={colors.controlAccent}
            accessibilityLabel="Voice and ambience balance"
            accessibilityValue={{
              text: `Voice ${percent(gains.voice)} percent, ambience ${percent(gains.bed)} percent`,
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

// The chips are ~30 pt tall; this makes their touch area 46 pt (NFR-401) without making them
// look bulkier. Android ignores hit slop outside the parent, so chip rows pad by the same amount
// (CHIP_ROW_PADDING) to keep it inside their ScrollView.
export const CHIP_HIT_SLOP = { top: 8, bottom: 8 };
export const CHIP_ROW_PADDING = { paddingVertical: 8 };

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch', gap: spacing.xs },
  label: { fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight },
  chipScroll: { flexGrow: 0 },
  chipRow: { gap: spacing.sm, ...CHIP_ROW_PADDING },
  chip: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  mix: { gap: spacing.xs },
  mixLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  slider: { alignSelf: 'stretch', height: 44 },
});
