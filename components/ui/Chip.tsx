import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, radii } from '@/constants/theme';

import { Icon, type IconName } from './Icon';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  accessibilityLabel?: string;
};

/**
 * The board's `.chip`: a small pill on `elevated`; selected is a solid light mauve fill
 * with dark text. The fill change (dark → bright) is the non-color cue DESIGN.md asks
 * for, since the selected light mauve is also the accent color.
 *
 * Drawn about 24pt tall, so the hit slop brings it to the 44pt minimum (NFR-401). Hit
 * slop can't reach past the parent's bounds on Android, so rows of chips need enough
 * vertical padding to hold it (step 4.4).
 */
export function Chip({ label, selected = false, onPress, icon, accessibilityLabel }: ChipProps) {
  const color = selected ? colors.background : colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.selected : colors.elevated,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {icon ? <Icon name={icon} color={color} size={14} /> : null}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.full,
  },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    lineHeight: 16,
  },
});
