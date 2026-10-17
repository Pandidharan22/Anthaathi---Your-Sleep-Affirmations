import { Pressable, StyleSheet } from 'react-native';

import { colors, radii } from '@/constants/theme';

import { Icon, type IconName } from './Icon';

type IconButtonProps = {
  icon: IconName;
  /** Required: an icon alone has no name for a screen reader. */
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
};

/** The board's `.icon-btn`: a 44pt round surface button for back, close, more, add. */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled = false,
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.button, { opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}
    >
      <Icon name={icon} color={colors.textPrimary} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
