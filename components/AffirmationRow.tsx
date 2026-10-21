import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { colors, fonts, radii, typography } from '@/constants/theme';
import type { LocalAffirmation } from '@/lib/affirmations.local';
import {
  formatDuration,
  formatLength,
  formatNightsAgo,
  getEffectiveDurationMs,
} from '@/lib/format';

type AffirmationRowProps = {
  affirmation: LocalAffirmation;
  /** The AI Guided voice's display name, e.g. "Nicole". */
  voiceLabel?: string;
  playing: boolean;
  onTogglePlay: () => void;
  onPress: () => void;
};

/**
 * The Folder Detail mockup's recording row: a round play button (an in-place preview),
 * then the title with a mic or speaker glyph for its source, "Self-Recorded · 32s ·
 * 2 nights ago" (or "AI Guided · Nicole · …"), and its length. Tapping the rest of the
 * row opens the recording's detail screen; the two are separate buttons.
 */
export function AffirmationRow({
  affirmation,
  voiceLabel,
  playing,
  onTogglePlay,
  onPress,
}: AffirmationRowProps) {
  const aiGuided = affirmation.source === 'ai_generated';
  const durationMs = getEffectiveDurationMs(affirmation);
  const meta = [
    aiGuided ? 'AI Guided' : 'Self-Recorded',
    aiGuided ? voiceLabel : null,
    formatLength(durationMs),
    formatNightsAgo(affirmation.created_at),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onTogglePlay}
        accessibilityRole="button"
        accessibilityLabel={`${playing ? 'Stop' : 'Play'} ${affirmation.title}`}
        hitSlop={4}
        style={({ pressed }) => [
          styles.play,
          playing && styles.playActive,
          { opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Icon
          name={playing ? 'pause' : 'play'}
          filled
          size={14}
          color={playing ? colors.background : colors.accent}
        />
      </Pressable>

      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${affirmation.title}, ${meta}`}
        style={({ pressed }) => [styles.body, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={styles.text}>
          <View style={styles.titleRow}>
            <Icon
              name={aiGuided ? 'voice' : 'micSmall'}
              size={12}
              color={aiGuided ? colors.accent : colors.textMuted}
            />
            <Text style={styles.title} numberOfLines={1}>
              {affirmation.title}
            </Text>
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <Text style={styles.duration}>{formatDuration(durationMs)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  play: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // While previewing, the button fills in the selected color: "this is on" (DESIGN.md).
  playActive: {
    backgroundColor: colors.selected,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 40,
  },
  text: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    flexShrink: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  duration: {
    ...typography.caption,
    fontFamily: fonts.sansSemiBold,
    color: colors.accent,
  },
});
