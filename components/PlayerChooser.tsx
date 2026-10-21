import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { GlowButton } from '@/components/ui/GlowButton';
import { gradientBackground } from '@/components/ui/gradient';
import { Icon } from '@/components/ui/Icon';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { colors, fonts, glows, gradients, radii, typography } from '@/constants/theme';
import type { LocalAffirmation } from '@/lib/affirmations.local';
import { describeFolderStats, summarizeByFolder } from '@/lib/folderStats';
import type { LocalFolder } from '@/lib/folders.local';
import { formatDuration, formatLength, getEffectiveDurationMs } from '@/lib/format';

export const SLEEP_TIMER_OPTIONS = [15, 30, 45, 60] as const;

type PlayerChooserProps = {
  affirmations: LocalAffirmation[];
  folders: LocalFolder[];
  selectedIds: ReadonlySet<string>;
  /** Selects (or, with `on` false, deselects) all of these recordings. */
  onSelect: (ids: string[], on: boolean) => void;
  sleepTimerMinutes: number | null;
  onTimerChange: (minutes: number | null) => void;
  /** The ambience picker, which the Player owns (it previews and plays the beds). */
  ambience: ReactNode;
  /** While a session plays: what the Now playing card says ("Loop 2 · 30m left"). */
  nowPlaying: string | null;
  onOpenNowPlaying: () => void;
  onPlay: () => void;
  onGoToLibrary: () => void;
};

/**
 * The Player's chooser (R.7b; no mockup, so it follows the Library): a "Now playing" card
 * while a session runs, folders to tick as a whole, single recordings, the sleep timer,
 * the ambience, and a glowing Play with what's chosen. Selection is one set of recordings:
 * a folder shows as chosen when all of its recordings are, and partly when some are.
 */
export function PlayerChooser(props: PlayerChooserProps) {
  const insets = useSafeAreaInsets();
  const { affirmations, folders, selectedIds } = props;
  const stats = summarizeByFolder(affirmations);
  const folderName = new Map(folders.map((f) => [f.id, f.name]));

  const groups: { key: string; name: string; ids: string[] }[] = [
    ...folders
      .filter((f) => stats.has(f.id))
      .map((f) => ({
        key: f.id,
        name: f.name,
        ids: affirmations.filter((a) => a.folder_id === f.id).map((a) => a.id),
      })),
    ...(stats.has(null)
      ? [
          {
            key: 'unfiled',
            name: 'Unfiled',
            ids: affirmations.filter((a) => !a.folder_id).map((a) => a.id),
          },
        ]
      : []),
  ];

  const chosen = affirmations.filter((a) => selectedIds.has(a.id));
  const chosenMs = chosen.reduce((sum, a) => sum + getEffectiveDurationMs(a), 0);
  const playLabel =
    chosen.length === 0
      ? 'Choose something to play'
      : `Play ${chosen.length} ${chosen.length === 1 ? 'affirmation' : 'affirmations'}`;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title="Player" subtitle="Choose what to fall asleep to." />

        {props.nowPlaying ? (
          <Pressable
            onPress={props.onOpenNowPlaying}
            accessibilityRole="button"
            accessibilityLabel={`Now playing. ${props.nowPlaying}. Open`}
            style={({ pressed }) => [styles.nowPlaying, { opacity: pressed ? 0.85 : 1 }]}
          >
            <View style={[styles.nowIcon, gradientBackground(gradients.actionFill)]}>
              <Icon name="moon" color={colors.background} size={22} filled />
            </View>
            <View style={styles.flex}>
              <Text style={styles.nowLabel}>Now playing</Text>
              <Text style={styles.nowMeta}>{props.nowPlaying}</Text>
            </View>
            <Icon name="chevronRight" color={colors.accent} size={20} />
          </Pressable>
        ) : null}

        {affirmations.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Nothing to play yet. Record an affirmation in the Library first.
            </Text>
            <Button label="Go to Library" variant="secondary" onPress={props.onGoToLibrary} />
          </View>
        ) : (
          <>
            <Section title="Folders">
              {groups.map((group) => {
                const count = group.ids.filter((id) => selectedIds.has(id)).length;
                const all = count === group.ids.length;
                const meta =
                  count > 0 && !all
                    ? `${count} of ${group.ids.length} chosen`
                    : describeFolderStats(stats.get(group.key === 'unfiled' ? null : group.key));
                return (
                  <Pressable
                    key={group.key}
                    onPress={() => props.onSelect(group.ids, !all)}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${group.name}, ${meta}`}
                    accessibilityState={{ checked: all ? true : count > 0 ? 'mixed' : false }}
                    style={({ pressed }) => [
                      styles.folder,
                      all && styles.folderOn,
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <View style={[styles.folderIcon, gradientBackground(gradients.actionFill)]}>
                      <Icon name="folder" color={colors.background} size={20} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.folderName} numberOfLines={1}>
                        {group.name}
                      </Text>
                      <Text style={styles.meta}>{meta}</Text>
                    </View>
                    <Check state={all ? 'on' : count > 0 ? 'some' : 'off'} />
                  </Pressable>
                );
              })}
            </Section>

            <Section title="Recordings">
              {affirmations.map((a) => {
                const on = selectedIds.has(a.id);
                const where = a.folder_id ? (folderName.get(a.folder_id) ?? 'Folder') : 'Unfiled';
                const meta = `${where} · ${formatDuration(getEffectiveDurationMs(a))}`;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => props.onSelect([a.id], !on)}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${a.title}, ${meta}`}
                    accessibilityState={{ checked: on }}
                    style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {a.title}
                      </Text>
                      <Text style={styles.meta}>{meta}</Text>
                    </View>
                    <Check state={on ? 'on' : 'off'} />
                  </Pressable>
                );
              })}
            </Section>

            <Section title="Sleep timer">
              <View style={styles.chips}>
                {[...SLEEP_TIMER_OPTIONS, null].map((minutes) => (
                  <Chip
                    key={minutes ?? 'off'}
                    label={minutes ? `${minutes} min` : 'No timer'}
                    selected={props.sleepTimerMinutes === minutes}
                    onPress={() => props.onTimerChange(minutes)}
                  />
                ))}
              </View>
            </Section>

            <View style={styles.section}>{props.ambience}</View>
          </>
        )}
      </ScrollView>

      {affirmations.length > 0 ? (
        <View style={styles.playBar}>
          <View style={styles.flex}>
            <Text style={styles.playTitle}>{playLabel}</Text>
            <Text style={styles.meta}>
              {chosen.length > 0
                ? `${formatLength(chosenMs)} · ${props.sleepTimerMinutes ? `stops after ${props.sleepTimerMinutes} min` : 'no sleep timer'}`
                : 'Tick a folder or a recording.'}
            </Text>
          </View>
          <GlowButton
            icon="play"
            iconFilled
            size={64}
            disabled={chosen.length === 0}
            accessibilityLabel={playLabel}
            onPress={props.onPlay}
          />
        </View>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[typography.label, styles.sectionTitle]}>
        {title}
      </Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/**
 * A round check: filled light mauve with a dark tick when chosen, a dash when part of a
 * folder is, an empty ring when not. The fill and mark carry it, not the color alone.
 */
function Check({ state }: { state: 'on' | 'some' | 'off' }) {
  return (
    <View aria-hidden style={[styles.check, state !== 'off' && styles.checkOn]}>
      {state === 'on' ? <Icon name="check" color={colors.background} size={14} /> : null}
      {state === 'some' ? <View style={styles.dash} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  flex: {
    flex: 1,
  },
  nowPlaying: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.selected,
    backgroundColor: colors.surface,
    boxShadow: glows.card,
  },
  nowIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowLabel: {
    ...typography.caption,
    fontFamily: fonts.sansBold,
    color: colors.accent,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  nowMeta: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 16,
    lineHeight: 20,
    color: colors.textPrimary,
    marginTop: 3,
  },
  empty: {
    marginTop: 40,
    gap: 20,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginTop: 28,
  },
  sectionTitle: {
    color: colors.textSecondary,
  },
  sectionBody: {
    marginTop: 12,
    gap: 10,
  },
  folder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
  },
  folderOn: {
    borderColor: colors.selected,
    boxShadow: glows.card,
  },
  folderIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderName: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 16,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  rowTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    borderColor: colors.selected,
    backgroundColor: colors.selected,
  },
  dash: {
    width: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.background,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    // Room for the chips' extended touch area (hit slop can't reach past the parent).
    paddingVertical: 10,
    marginVertical: -10,
  },
  playBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  playTitle: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 16,
    lineHeight: 20,
    color: colors.textPrimary,
  },
});
