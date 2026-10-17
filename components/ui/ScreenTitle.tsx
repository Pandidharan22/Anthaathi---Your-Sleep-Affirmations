import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/theme';

import { GradientText } from './GradientText';

type ScreenTitleProps = {
  title: string;
  /** The italic line under the title, e.g. "Good evening, Maya." */
  subtitle?: string;
  /** Usually an IconButton, e.g. Library's "+". */
  action?: ReactNode;
};

/**
 * The large gradient title at the top of each tab screen (the board's `.h1 .mesh-text`).
 * Marked as a header so screen readers can jump between screens' titles (deferred from
 * step 2.6).
 */
export function ScreenTitle({ title, subtitle, action }: ScreenTitleProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <GradientText accessibilityRole="header" style={styles.title}>
          {title}
        </GradientText>
        {action}
      </View>
      {subtitle ? <Text style={[typography.quote, styles.subtitle]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.display,
    letterSpacing: -0.3,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: -4,
  },
});
