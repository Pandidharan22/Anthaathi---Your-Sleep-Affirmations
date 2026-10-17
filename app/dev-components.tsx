import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { DuskBackground } from '@/components/ui/DuskBackground';
import { GlowButton } from '@/components/ui/GlowButton';
import { Icon, type IconName } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { NavHeader } from '@/components/ui/NavHeader';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { TextField } from '@/components/ui/TextField';
import { colors, spacing, typography } from '@/constants/theme';

const GALLERY_ICONS: IconName[] = [
  'moon',
  'play',
  'pause',
  'goal',
  'journal',
  'settings',
  'mic',
  'voice',
  'folder',
  'heart',
  'plus',
  'back',
  'close',
  'more',
  'check',
  'loop',
  'clock',
  'bell',
  'lock',
  'trash',
];

/**
 * TEMPORARY (redesign step R.2, __DEV__ only): every shared component in one place, to
 * check them against the Velvet Dusk board on the phone and in the web preview before
 * the screen steps (R.3–R.10) adopt them. Removed once those steps are done.
 */
export default function DevComponentsScreen() {
  const [selected, setSelected] = useState('15 min');
  const [title, setTitle] = useState('');

  return (
    <View style={styles.root}>
      <NavHeader title="Components" leading="back" onLeadingPress={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle
          title="Library"
          subtitle="Good evening, Maya."
          action={<IconButton icon="plus" accessibilityLabel="New folder" onPress={() => {}} />}
        />

        <Text style={styles.section}>Buttons</Text>
        <Button label="Save recording" onPress={() => {}} />
        <Button label="Record this" variant="secondary" icon="mic" onPress={() => {}} />
        <Button label="Cancel" variant="ghost" onPress={() => {}} />
        <Button label="Saving" loading onPress={() => {}} />
        <Button label="Disabled" disabled onPress={() => {}} />

        <Text style={styles.section}>Chips</Text>
        <View style={styles.row}>
          {['15 min', '30 min', '45 min', 'No timer'].map((label) => (
            <Chip
              key={label}
              label={label}
              selected={selected === label}
              onPress={() => setSelected(label)}
            />
          ))}
        </View>

        <Text style={styles.section}>Cards</Text>
        <Card mesh onPress={() => {}} accessibilityLabel="Sleep and calm, 12 recordings">
          <Text style={[typography.subtitle, { color: colors.textPrimary }]}>Sleep &amp; calm</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            12 recordings · 6m 24s
          </Text>
        </Card>
        <Card tone="elevated">
          <Text style={[typography.body, { color: colors.textPrimary }]}>Elevated card</Text>
        </Card>

        <Text style={styles.section}>Text fields</Text>
        <TextField
          label="Title"
          placeholder="Name this affirmation"
          value={title}
          onChangeText={setTitle}
        />
        <TextField label="Password" secureTextEntry error="Password doesn't match our records." />
        <TextField label="Why it matters" multiline helper="Short and present-tense works best." />

        <Text style={styles.section}>Voice controls</Text>
        <View style={styles.hero}>
          <DuskBackground />
          <GlowButton
            icon="mic"
            accessibilityLabel="Record"
            size={90}
            haloSize={220}
            onPress={() => {}}
          />
        </View>
        <View style={[styles.row, styles.glowRow]}>
          <GlowButton icon="mic" accessibilityLabel="Record" size={64} onPress={() => {}} />
          <GlowButton
            icon="pause"
            iconFilled
            glow="hero"
            accessibilityLabel="Pause"
            onPress={() => {}}
          />
        </View>

        <Text style={styles.section}>Icons</Text>
        <View style={styles.row}>
          {GALLERY_ICONS.map((name) => (
            <Icon key={name} name={name} color={colors.textPrimary} size={24} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  section: { ...typography.label, color: colors.textMuted, marginTop: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 10 },
  glowRow: { justifyContent: 'space-around', paddingVertical: spacing.xl },
  hero: {
    height: 320,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
