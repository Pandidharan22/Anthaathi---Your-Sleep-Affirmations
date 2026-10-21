import Slider from '@react-native-community/slider';
import { StyleSheet, Text, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { colors, fonts, typography } from '@/constants/theme';
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
  /** Hidden in the Player's Ambience sheet, whose title already says it. */
  showTitle?: boolean;
};

/**
 * The audio studio controls (FR-304): which ambience bed plays under the affirmations, and one
 * slider balancing the voice against it. In the Velvet Dusk style since R.7a: the app's chips
 * (filled light mauve when chosen), an uppercase label and a mauve slider. The slider only appears
 * with a bed chosen: without one there is nothing to balance, and the voice plays at full.
 */
export function BedPicker({
  bedId,
  mix,
  onBedChange,
  onMixChange,
  onMixCommit,
  showTitle = true,
}: Props) {
  const hasBed = bedId !== null;
  const gains = mixGains(mix, hasBed);
  const percent = (gain: number) => Math.round(gain * 100);

  return (
    <View style={styles.container}>
      {showTitle ? <Text style={[typography.label, styles.label]}>Ambience</Text> : null}
      <View style={styles.chips}>
        {[null, ...BEDS].map((bed) => {
          const id = bed?.id ?? null;
          return (
            <Chip
              key={id ?? 'none'}
              icon={bed ? 'music' : undefined}
              label={bed?.label ?? 'None'}
              selected={bedId === id}
              accessibilityLabel={bed ? `${bed.label} ambience` : 'No ambience'}
              onPress={() => onBedChange(id)}
            />
          );
        })}
      </View>

      {hasBed ? (
        <View style={styles.mix}>
          <Text style={[typography.label, styles.label]}>Balance</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            step={0.025}
            value={mix}
            onValueChange={onMixChange}
            onSlidingComplete={onMixCommit}
            // A balance, not a fill: both sides the same, the thumb in the accent.
            minimumTrackTintColor={colors.action}
            maximumTrackTintColor={colors.action}
            thumbTintColor={colors.accent}
            accessibilityLabel="Voice and ambience balance"
            accessibilityValue={{
              text: `Voice ${percent(gains.voice)} percent, ambience ${percent(gains.bed)} percent`,
            }}
          />
          <View style={styles.mixLabels}>
            <Text style={styles.mixText}>More ambience · {percent(gains.bed)}%</Text>
            <Text style={styles.mixText}>More voice · {percent(gains.voice)}%</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.note}>Choose a sound to play softly under your affirmations.</Text>
      )}
    </View>
  );
}

// The chips are about 24 pt tall; Chip's own hit slop brings them to the 44 pt minimum
// (NFR-401). Android ignores hit slop outside the parent, so chip rows pad by this much.
export const CHIP_HIT_SLOP = { top: 8, bottom: 8 };
export const CHIP_ROW_PADDING = { paddingVertical: 8 };

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    gap: 14,
  },
  label: {
    color: colors.textSecondary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    // Room for the chips' extended touch area (hit slop can't reach past the parent).
    paddingVertical: 10,
    marginVertical: -10,
  },
  mix: {
    gap: 4,
    marginTop: 6,
  },
  slider: {
    alignSelf: 'stretch',
    height: 44,
  },
  mixLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mixText: {
    ...typography.caption,
    fontFamily: fonts.sansSemiBold,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  note: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
