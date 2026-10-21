import type { Animated } from 'react-native';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MoonSky } from '@/components/MoonSky';
import { Waveform } from '@/components/Waveform';
import { DuskBackground } from '@/components/ui/DuskBackground';
import { Icon, type IconName } from '@/components/ui/Icon';
import { GlowButton } from '@/components/ui/GlowButton';
import { NavHeader } from '@/components/ui/NavHeader';
import { colors, fonts, radii, typography } from '@/constants/theme';
import type { LocalAffirmation } from '@/lib/affirmations.local';

type NowPlayingProps = {
  track: LocalAffirmation;
  levels: number[] | null;
  /** 0–1 over the track's full length, gliding between position reports. */
  progress: Animated.Value;
  paused: boolean;
  /** Which pass through the selection this is, from 1. */
  loopNumber: number;
  loopOn: boolean;
  /** Seconds left on the sleep timer, or null without one. */
  remainingSeconds: number | null;
  timerMinutes: number | null;
  ambienceOn: boolean;
  onTogglePause: () => void;
  onEnd: () => void;
  onBack: () => void;
  onToggleLoop: () => void;
  onOpenTimer: () => void;
  onOpenAmbience: () => void;
};

/**
 * The Player's now-playing screen (mockup #10, simplified on the user's phone check in R.7a):
 * "Now looping" over the dusk mesh, a moon in a soft glow with twinkling stars instead of the
 * affirmation's details (what plays doesn't need reading at night), the play/pause control (tap to pause or resume, hold
 * to end), the track's waveform with the loop count and sleep timer, and loop / timer /
 * End session / ambience. One fixed layout that fits the screen, never scrolling; the
 * Player hides its header and the tab bar while this shows.
 */
export function NowPlaying(props: NowPlayingProps) {
  const { track, paused } = props;
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // Sized from the screen so everything fits on short phones too.
  const glowSize = Math.round(Math.min(280, height * 0.34));

  const trimStart = track.trim_start_ms ?? 0;
  const trimEnd = track.trim_end_ms ?? track.duration_ms;
  const fraction = (ms: number) => (track.duration_ms > 0 ? ms / track.duration_ms : 0);
  const timerText =
    props.remainingSeconds === null
      ? 'No sleep timer'
      : `Sleep timer: ${Math.max(1, Math.ceil(props.remainingSeconds / 60))}m`;

  return (
    <View style={styles.root}>
      <DuskBackground />
      <NavHeader
        title="Now looping"
        titleStyle="quiet"
        leading="back"
        onLeadingPress={props.onBack}
      />

      <MoonSky glowSize={glowSize} animate={!paused} />

      <View style={styles.control}>
        {/* No glow of its own: the moon carries it (user, R.7a). */}
        <GlowButton
          icon={paused ? 'play' : 'pause'}
          iconFilled
          size={72}
          glow="none"
          accessibilityLabel={paused ? 'Resume' : 'Pause'}
          accessibilityHint="Hold to end tonight's session"
          onPress={props.onTogglePause}
          onLongPress={props.onEnd}
        />
        <Text style={styles.hint}>Tap to pause · hold to end</Text>
      </View>

      <View style={styles.wave}>
        <Waveform
          levels={props.levels}
          bars={32}
          height={40}
          progress={props.progress}
          keepFrom={fraction(trimStart)}
          keepTo={fraction(trimEnd)}
        />
        <View style={styles.statusRow}>
          <Text style={styles.loopText}>Loop {props.loopNumber}</Text>
          <Text style={styles.caption}>{timerText}</Text>
        </View>
      </View>

      <View style={[styles.bottomRow, { paddingBottom: insets.bottom + 20 }]}>
        <RoundToggle icon="loop" label="Loop" on={props.loopOn} onPress={props.onToggleLoop} />
        <View style={styles.pills}>
          <Pill
            label={`⏱ ${props.timerMinutes ? `${props.timerMinutes}m` : 'Off'}`}
            accessibilityLabel={
              props.timerMinutes
                ? `Sleep timer, ${props.timerMinutes} minutes. Change`
                : 'No sleep timer. Set one'
            }
            onPress={props.onOpenTimer}
          />
          <Pill label="End session" onPress={props.onEnd} />
        </View>
        <RoundToggle
          icon="music"
          label="Ambience"
          on={props.ambienceOn}
          onPress={props.onOpenAmbience}
          opensSheet
        />
      </View>
    </View>
  );
}

/** A small scrim pill for the bottom row: the timer and End session. */
function Pill({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [styles.pill, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={styles.pillText}>{label}</Text>
    </Pressable>
  );
}

/**
 * The mockup's round scrim buttons. "On" (loop repeating, an ambience playing) fills the
 * circle in the selected light mauve with a dark icon; the fill and the role carry it, not
 * the hue alone.
 */
function RoundToggle({
  icon,
  label,
  on,
  onPress,
  opensSheet = false,
}: {
  icon: IconName;
  label: string;
  on: boolean;
  onPress: () => void;
  opensSheet?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={opensSheet ? 'button' : 'switch'}
      accessibilityLabel={opensSheet ? `${label}${on ? ', on' : ', off'}` : label}
      accessibilityState={opensSheet ? undefined : { checked: on }}
      style={({ pressed }) => [styles.round, on && styles.roundOn, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Icon name={icon} color={on ? colors.background : colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  control: {
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  wave: {
    paddingHorizontal: 24,
    marginTop: 20,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  loopText: {
    ...typography.caption,
    fontFamily: fonts.sansBold,
    color: colors.accent,
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  pills: {
    flexDirection: 'row',
    gap: 10,
  },
  pill: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(29, 22, 34, 0.6)',
  },
  pillText: {
    ...typography.caption,
    fontFamily: fonts.sansBold,
    color: colors.textPrimary,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(29, 22, 34, 0.6)',
  },
  roundOn: {
    backgroundColor: colors.selected,
  },
});
