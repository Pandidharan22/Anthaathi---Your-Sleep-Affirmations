import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography } from '@/constants/theme';
import { useNeuralVoiceStatus } from '@/hooks/useNeuralVoiceStatus';
import { useThemeColors } from '@/hooks/useThemeColors';
import {
  getVoiceOption,
  NATURAL_VOICE_OPTIONS,
  SYSTEM_VOICE_OPTIONS,
  type VoiceOption,
} from '@/lib/aiVoice';

type Props = {
  value: string;
  onChange: (voiceId: string) => void;
};

/**
 * Voice choice for AI Guided affirmations (create and regenerate). Natural voices are offered
 * only once downloaded; until then they're shown disabled with a way to get them, and the
 * basic voices always work.
 */
export function VoicePicker({ value, onChange }: Props) {
  const colors = useThemeColors();
  const naturalInstalled = useNeuralVoiceStatus().state === 'installed';
  const selected = getVoiceOption(value);
  // E.g. regenerating an affirmation made with Nicole after the voices were removed.
  const selectedUnavailable = selected?.engine === 'natural' && !naturalInstalled;

  const chip = (voice: VoiceOption, enabled: boolean) => {
    const isSelected = voice.id === value;
    return (
      <Pressable
        key={voice.id}
        onPress={() => onChange(voice.id)}
        disabled={!enabled}
        accessibilityRole="button"
        accessibilityLabel={`${voice.label}, ${voice.gender} voice`}
        accessibilityState={{ selected: isSelected, disabled: !enabled }}
        style={[
          styles.chip,
          {
            borderColor: isSelected ? colors.primary : colors.border,
            backgroundColor: isSelected ? colors.primary : 'transparent',
            opacity: enabled ? 1 : 0.5,
          },
        ]}
      >
        <Text style={{ color: isSelected ? colors.background : colors.textPrimary }}>
          {voice.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Natural voices</Text>
      <View style={styles.row}>{NATURAL_VOICE_OPTIONS.map((v) => chip(v, naturalInstalled))}</View>
      {!naturalInstalled ? (
        <Pressable
          onPress={() => router.navigate('/settings')}
          accessibilityRole="link"
          hitSlop={8}
        >
          <Text
            style={[styles.hint, { color: selectedUnavailable ? colors.error : colors.primary }]}
          >
            {selectedUnavailable
              ? 'This voice needs the natural voices. Download them in Settings, or pick a basic voice.'
              : 'Download the natural voices in Settings to use them.'}
          </Text>
        </Pressable>
      ) : null}

      <Text style={[styles.label, { color: colors.textSecondary }]}>Basic voices</Text>
      <View style={styles.row}>{SYSTEM_VOICE_OPTIONS.map((v) => chip(v, true))}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.caption.fontSize,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 36,
    justifyContent: 'center',
  },
  hint: {
    fontSize: typography.caption.fontSize,
  },
});
