import { StyleSheet, Text } from 'react-native';

import { typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';

/**
 * Explains the "/" pause mark (lib/voiceStyle.ts PAUSE_MARK) under script fields. Natural voices
 * pause briefly at it, basic voices read it as a comma, and when recording in your own voice it
 * works as a reading cue.
 */
export function PauseMarkHint() {
  const colors = useThemeColors();
  return (
    <Text style={[styles.hint, { color: colors.textSecondary }]}>
      Tip: add / where you&apos;d like a short pause, like &ldquo;My strength / is permanent.&rdquo;
    </Text>
  );
}

const styles = StyleSheet.create({
  hint: {
    alignSelf: 'stretch',
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
  },
});
