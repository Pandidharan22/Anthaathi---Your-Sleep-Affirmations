import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, glows, gradients, radii, spacing, typography } from '@/constants/theme';

/**
 * TEMPORARY (redesign step R.1, __DEV__ only): proves on a real Android device that the
 * fonts load and that React Native's `boxShadow` glows and `experimental_backgroundImage`
 * gradients render, before R.2's components rely on them. The web preview can't prove
 * the Android renderer. Removed in R.2.
 */
export default function DevDesignCheckScreen() {
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[typography.wordmark, { color: colors.accent }]}>Anthaathi</Text>
      <Text style={[typography.display, { color: colors.textPrimary }]}>Display · Fraunces 700</Text>
      <Text style={[typography.title, { color: colors.textPrimary }]}>Title · Fraunces 600</Text>
      <Text style={[typography.subtitle, { color: colors.textPrimary }]}>Subtitle · Fraunces 600</Text>
      <Text style={[typography.quote, { color: colors.textSecondary }]}>
        &ldquo;Where old patterns end, new ones begin.&rdquo;
      </Text>
      <Text style={[typography.body, { color: colors.textPrimary }]}>Body · Nunito 400</Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>Caption · Nunito 400</Text>
      <Text style={[typography.label, { color: colors.textSecondary }]}>Field label · Nunito 600</Text>

      <View style={[styles.pill, { experimental_backgroundImage: gradients.actionFill }]}>
        <Text style={[typography.button, { color: colors.background }]}>Gradient button</Text>
      </View>

      <View style={styles.row}>
        <View style={[styles.round, { backgroundColor: colors.action, boxShadow: glows.control }]} />
        <View style={[styles.round, { backgroundColor: colors.action, boxShadow: glows.hero }]} />
        <View style={[styles.handle, { backgroundColor: colors.selected, boxShadow: glows.handle }]} />
      </View>
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        control glow · hero glow · trim handle glow
      </Text>

      <View
        style={[
          styles.hero,
          {
            experimental_backgroundImage: [
              'radial-gradient(circle at 25% 30%, rgba(169, 143, 196, 0.45) 0%, rgba(169, 143, 196, 0) 60%)',
              'radial-gradient(circle at 80% 75%, rgba(227, 148, 110, 0.35) 0%, rgba(227, 148, 110, 0) 55%)',
              gradients.velvetDusk,
            ].join(', '),
          },
        ]}
      >
        <Text style={[typography.subtitle, { color: colors.textPrimary }]}>Velvet Dusk mesh</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  pill: {
    borderRadius: radii.full,
    paddingVertical: 14,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.xl,
  },
  round: { width: 72, height: 72, borderRadius: 36 },
  handle: { width: 12, height: 72, borderRadius: 6 },
  hero: {
    height: 220,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
