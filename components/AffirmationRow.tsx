import { Pressable, StyleSheet, Text } from 'react-native';

import { radii, spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { LocalAffirmation } from '@/lib/affirmations.local';
import { formatDuration, getEffectiveDurationMs } from '@/lib/format';

type AffirmationRowProps = {
  affirmation: LocalAffirmation;
  folderName?: string | null;
  onPress: () => void;
};

export function AffirmationRow({ affirmation, folderName, onPress }: AffirmationRowProps) {
  const colors = useThemeColors();

  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.row, { borderColor: colors.border }]}>
      <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{affirmation.title}</Text>
      <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>
        {folderName ? `${folderName} · ` : ''}
        {formatDuration(getEffectiveDurationMs(affirmation))}
        {affirmation.trim_start_ms !== null ? ' · trimmed' : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTitle: {
    fontSize: typography.body.fontSize,
    flexShrink: 1,
  },
  rowMeta: {
    fontSize: typography.caption.fontSize,
  },
});
