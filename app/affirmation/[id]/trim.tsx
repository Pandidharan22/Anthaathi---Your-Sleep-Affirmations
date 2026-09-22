import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { TrimEditor } from '@/components/TrimEditor';
import { spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { getLocalAffirmation, updateLocalAffirmationTrim, type LocalAffirmation } from '@/lib/affirmations.local';

export default function AffirmationTrimScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [affirmation, setAffirmation] = useState<LocalAffirmation | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    getLocalAffirmation(id).then(setAffirmation);
  }, [id]);

  if (affirmation === undefined) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (affirmation === null) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Recording not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{affirmation.title}</Text>
      <TrimEditor
        uri={affirmation.local_uri}
        durationMs={affirmation.duration_ms}
        initialTrimStartMs={affirmation.trim_start_ms}
        initialTrimEndMs={affirmation.trim_end_ms}
        onSave={async (trimStartMs, trimEndMs) => {
          await updateLocalAffirmationTrim(affirmation.id, trimStartMs, trimEndMs);
          router.back();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontWeight: typography.title.fontWeight,
    textAlign: 'center',
  },
});
