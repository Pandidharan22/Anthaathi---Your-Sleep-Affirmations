import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, gradients, radii, typography } from '@/constants/theme';

import { gradientBackground } from './gradient';
import { GradientText } from './GradientText';
import { Icon, type IconName } from './Icon';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = {
  label: string;
  onPress: () => void;
  /**
   * primary: gradient pill with dark text (the main action on a screen).
   * secondary: gradient outline with gradient text.
   * ghost: plain cream text, for low-emphasis actions like "Cancel".
   */
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  /** Shows a spinner in place of the label and blocks presses. */
  loading?: boolean;
  /** Overrides the label as the screen-reader name. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

/** The board's `.btn-primary` / `.btn-secondary` / `.btn-ghost`. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ButtonProps) {
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && [styles.primary, gradientBackground(gradients.actionFill)],
        variant === 'secondary' && [styles.secondaryRing, gradientBackground(gradients.actionFill)],
        { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {variant === 'secondary' ? (
        // The gradient ring is the 2px of the outer pill left showing around this one.
        <View style={[styles.base, styles.secondaryInner]}>
          <Content label={label} variant={variant} icon={icon} loading={loading} />
        </View>
      ) : (
        <Content label={label} variant={variant} icon={icon} loading={loading} />
      )}
    </Pressable>
  );
}

function Content({
  label,
  variant,
  icon,
  loading,
}: {
  label: string;
  variant: ButtonVariant;
  icon?: IconName;
  loading: boolean;
}) {
  const color =
    variant === 'primary'
      ? colors.background
      : variant === 'secondary'
        ? colors.accent
        : colors.textPrimary;

  if (loading) return <ActivityIndicator color={color} />;

  return (
    <>
      {icon ? <Icon name={icon} color={color} size={18} /> : null}
      {variant === 'secondary' ? (
        <GradientText style={typography.button}>{label}</GradientText>
      ) : (
        <Text style={[typography.button, variant === 'ghost' && styles.ghostText, { color }]}>
          {label}
        </Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.full,
    minHeight: 44,
  },
  primary: {
    paddingVertical: 16,
    paddingHorizontal: 28,
  },
  secondaryRing: {
    padding: 2,
  },
  secondaryInner: {
    flexGrow: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.background,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  ghostText: {
    fontFamily: fonts.sansSemiBold,
  },
});
