import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/constants/theme';

type StepDotsProps = {
  /** 1-based. */
  step: number;
  total: number;
};

/**
 * The AI Guided flow's step indicator: the current step is a light mauve pill, steps
 * already done are border-colored pills, steps to come are small dots, then "Step 1 of 3".
 * The shape change (pill vs dot) is the non-color cue for done vs to come.
 */
export function StepDots({ step, total }: StepDotsProps) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i + 1 <= step && styles.pill,
            { backgroundColor: i + 1 === step ? colors.selected : colors.border },
          ]}
        />
      ))}
      <Text style={styles.label}>
        Step {step} of {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pill: {
    width: 22,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    marginLeft: 6,
  },
});
