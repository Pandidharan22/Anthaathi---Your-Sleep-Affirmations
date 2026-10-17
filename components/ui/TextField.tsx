import { useState, type Ref } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, radii, typography } from '@/constants/theme';

type TextFieldProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  /** Shown above the field and used as its screen-reader name. */
  label: string;
  /** Replaces the helper text and turns the border rose. */
  error?: string | null;
  helper?: string;
  /** Lets a form move focus to the next field (React 19 passes `ref` as a prop). */
  ref?: Ref<TextInput>;
};

/**
 * The board's `.input`: uppercase label, a `surface` field with 12pt corners, a soft
 * mauve ring while focused and a rose border on error. The label doubles as the
 * field's accessibilityLabel — no field in the app had one before (deferred from 2.6).
 */
export function TextField({
  label,
  error,
  helper,
  onFocus,
  onBlur,
  multiline,
  ...inputProps
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const note = error || helper;

  return (
    <View style={styles.container}>
      <Text style={[typography.label, styles.label]}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        accessibilityLabel={label}
        accessibilityHint={error ?? helper}
        placeholderTextColor={colors.textMuted}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          multiline && styles.multiline,
          focused && styles.focused,
          error ? styles.errored : null,
        ]}
      />
      {note ? (
        <Text
          accessibilityLiveRegion={error ? 'polite' : 'none'}
          style={[typography.caption, { color: error ? colors.error : colors.textMuted }]}
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.textPrimary,
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  focused: {
    borderColor: 'rgba(195, 174, 218, 0.4)',
    boxShadow:
      '0px 0px 0px 4px rgba(169, 143, 196, 0.12), 0px 0px 24px -4px rgba(169, 143, 196, 0.35)',
  },
  errored: {
    borderColor: colors.error,
  },
});
