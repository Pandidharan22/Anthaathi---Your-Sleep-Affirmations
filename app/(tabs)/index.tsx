import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FolderNameSheet } from '@/components/FolderNameSheet';
import { StreakBadge } from '@/components/StreakBadge';
import { Card } from '@/components/ui/Card';
import { GlowButton } from '@/components/ui/GlowButton';
import { gradientBackground } from '@/components/ui/gradient';
import { Icon, type IconName } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { colors, fonts, gradients, radii, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { listLocalAffirmations } from '@/lib/affirmations.local';
import {
  describeFolderStats,
  summarizeByFolder,
  UNFILED_FOLDER_ID,
  type FolderStats,
} from '@/lib/folderStats';
import { createLocalFolder, listLocalFolders, type LocalFolder } from '@/lib/folders.local';
import { greeting } from '@/lib/greeting';
import { listLocalPlaybackSessions } from '@/lib/playbackSessions.local';
import { computeStreak } from '@/lib/streak';

/**
 * The Library mockup: a gradient title with a greeting, one card per folder (count and
 * total length), an "Unfiled" card when some recordings have no folder, and a dashed
 * card to create a folder. The glowing mic starts a new affirmation (Mode Choice).
 */
export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [folders, setFolders] = useState<LocalFolder[]>([]);
  const [stats, setStats] = useState<Map<string | null, FolderStats>>(new Map());
  const [streak, setStreak] = useState(0);
  const [creatingFolder, setCreatingFolder] = useState(false);

  const refresh = useCallback(() => {
    if (!user) return;
    listLocalFolders(user.id).then(setFolders);
    listLocalAffirmations(user.id).then((all) => setStats(summarizeByFolder(all)));
    listLocalPlaybackSessions(user.id).then((sessions) =>
      setStreak(computeStreak(sessions.map((s) => s.played_at))),
    );
  }, [user]);

  useFocusEffect(refresh);

  async function handleCreateFolder(name: string) {
    if (!user) return;
    await createLocalFolder(user.id, name);
    setCreatingFolder(false);
    refresh();
  }

  const unfiled = stats.get(null);
  const name = user?.user_metadata?.display_name as string | undefined;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle
          title="Library"
          subtitle={greeting(new Date(), name)}
          action={
            <IconButton
              icon="plus"
              accessibilityLabel="New folder"
              onPress={() => setCreatingFolder(true)}
            />
          }
        />

        <View style={styles.streak}>
          <StreakBadge streak={streak} />
        </View>

        <View style={styles.cards}>
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              name={folder.name}
              meta={describeFolderStats(stats.get(folder.id))}
              onPress={() => router.push(`/folder/${folder.id}`)}
            />
          ))}
          {unfiled ? (
            <FolderCard
              name="Unfiled"
              meta={describeFolderStats(unfiled)}
              onPress={() => router.push(`/folder/${UNFILED_FOLDER_ID}`)}
            />
          ) : null}

          <Pressable
            onPress={() => setCreatingFolder(true)}
            accessibilityRole="button"
            accessibilityLabel="Create a new folder"
            style={({ pressed }) => [styles.createCard, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={styles.createIcon}>
              <Icon name="plus" color={colors.accent} size={20} />
            </View>
            <Text style={styles.createText}>Create a new folder</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.fab}>
        <GlowButton
          icon="mic"
          size={64}
          accessibilityLabel="New affirmation"
          onPress={() => router.push('/new-affirmation')}
        />
      </View>

      <FolderNameSheet
        visible={creatingFolder}
        title="New folder"
        confirmLabel="Create"
        onSubmit={handleCreateFolder}
        onClose={() => setCreatingFolder(false)}
      />
    </View>
  );
}

function FolderCard({
  name,
  meta,
  icon = 'folder',
  onPress,
}: {
  name: string;
  meta: string;
  icon?: IconName;
  onPress: () => void;
}) {
  return (
    <Card mesh onPress={onPress} accessibilityLabel={`${name}, ${meta}`} style={styles.folderCard}>
      <View style={[styles.folderIcon, gradientBackground(gradients.actionFill)]}>
        <Icon name={icon} color={colors.background} size={22} />
      </View>
      <View style={styles.folderText}>
        <Text style={styles.folderName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.folderMeta}>{meta}</Text>
      </View>
      <Icon name="chevronRight" color={colors.textSecondary} size={20} />
    </Card>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 24,
    // Room for the floating mic so the last card can scroll clear of it.
    paddingBottom: 120,
  },
  streak: {
    marginTop: 12,
  },
  cards: {
    marginTop: 28,
    gap: 12,
  },
  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  folderIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderText: {
    flex: 1,
  },
  folderName: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 16,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  folderMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 3,
  },
  createCard: {
    marginTop: 6,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 10,
  },
  createIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createText: {
    ...typography.quote,
    fontSize: 14,
    color: colors.textSecondary,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
  },
});
