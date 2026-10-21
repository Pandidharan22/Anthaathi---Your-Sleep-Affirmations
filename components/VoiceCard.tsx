import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { gradientBackground } from '@/components/ui/gradient';
import { Icon } from '@/components/ui/Icon';
import { colors, fonts, glows, gradients, radii, typography } from '@/constants/theme';
import type { VoiceOption } from '@/lib/aiVoice';

export type VoicePreviewState = 'idle' | 'loading' | 'playing';

type VoiceCardProps = {
  voice: VoiceOption;
  selected: boolean;
  /** Natural voices before they're downloaded. */
  disabled?: boolean;
  preview: VoicePreviewState;
  onSelect: () => void;
  onPreview: () => void;
};

const MINI_WAVE = [0.4, 0.8, 0.55, 0.95, 0.6, 0.4];

/**
 * One voice on the Choose a voice step (mockup #22): a preview button, the name with a
 * gender chip and a few words on how it sounds, and a radio on the right. The chosen card
 * gets a light mauve border and a soft glow; while its preview plays, a small waveform
 * replaces the radio.
 */
export function VoiceCard({
  voice,
  selected,
  disabled = false,
  preview,
  onSelect,
  onPreview,
}: VoiceCardProps) {
  const gender = voice.gender === 'female' ? 'Female' : 'Male';

  return (
    // Two controls side by side rather than nested, so a screen reader reaches both: the
    // preview button, and the rest of the card as the radio.
    <View style={[styles.card, selected && styles.selected, disabled && styles.disabled]}>
      <Pressable
        onPress={onPreview}
        disabled={disabled || preview === 'loading'}
        accessibilityRole="button"
        accessibilityLabel={preview === 'playing' ? 'Stop preview' : `Preview ${voice.label}`}
        accessibilityState={{ busy: preview === 'loading', disabled }}
        style={[
          styles.previewButton,
          selected ? gradientBackground(gradients.actionFill) : styles.previewIdle,
        ]}
      >
        {preview === 'loading' ? (
          <ActivityIndicator color={selected ? colors.background : colors.accent} />
        ) : (
          <Icon
            name={preview === 'playing' ? 'pause' : 'play'}
            color={selected ? colors.background : colors.accent}
            size={18}
            filled
          />
        )}
      </Pressable>

      <Pressable
        onPress={onSelect}
        disabled={disabled}
        accessibilityRole="radio"
        accessibilityLabel={`${voice.label}, ${gender}, ${voice.description}`}
        accessibilityState={{ checked: selected, disabled }}
        style={({ pressed }) => [styles.choose, { opacity: pressed ? 0.85 : 1 }]}
      >
        <View style={styles.text}>
          <Text style={styles.name}>{voice.label}</Text>
          <View style={styles.meta}>
            <View style={styles.genderChip}>
              <Text style={styles.genderText}>{gender}</Text>
            </View>
            <Text style={styles.description} numberOfLines={1}>
              {voice.description}
            </Text>
          </View>
        </View>

        {preview === 'playing' ? (
          <View style={styles.miniWave} aria-hidden>
            {MINI_WAVE.map((h, i) => (
              <View
                key={i}
                style={[
                  styles.miniBar,
                  { height: `${h * 100}%` },
                  gradientBackground(gradients.actionFill),
                ]}
              />
            ))}
          </View>
        ) : (
          <View style={[styles.radio, selected && styles.radioOn]} aria-hidden>
            {selected ? <View style={styles.radioDot} /> : null}
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
  },
  disabled: {
    opacity: 0.5,
  },
  choose: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    // The whole rest of the card is the touch target, at least 44 pt tall.
    minHeight: 44,
  },
  selected: {
    borderColor: colors.selected,
    boxShadow: glows.card,
  },
  previewButton: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewIdle: {
    backgroundColor: colors.elevated,
  },
  text: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 16,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  genderChip: {
    backgroundColor: colors.elevated,
    borderRadius: radii.full,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  genderText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.textSecondary,
  },
  description: {
    ...typography.caption,
    flexShrink: 1,
    color: colors.textMuted,
  },
  miniWave: {
    width: 30,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  miniBar: {
    flex: 1,
    borderRadius: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: colors.selected,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    backgroundColor: colors.selected,
  },
});
