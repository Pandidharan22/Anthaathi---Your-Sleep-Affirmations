import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts } from '@/constants/theme';

import { IconButton } from './IconButton';

type NavHeaderProps = {
  title?: string;
  /** `back` for pushed screens, `close` for modals. */
  leading?: 'back' | 'close';
  onLeadingPress?: () => void;
  /** A text button in place of the icon, like Trim's "Cancel". */
  leadingContent?: ReactNode;
  /** Usually an IconButton (e.g. "more") or a text Button. */
  trailing?: ReactNode;
  /**
   * `quiet` is the board's smaller sans title in secondary color, used on hero
   * screens like Record ("Sleep & calm") and Player ("Now looping").
   */
  titleStyle?: 'serif' | 'quiet';
};

/**
 * The board's `.nav`: a 56pt row under the status bar with round icon buttons at the
 * ends and a centered title. Screens render it themselves instead of the native stack
 * header, so it can sit on top of a DuskBackground.
 */
export function NavHeader({
  title,
  leading,
  onLeadingPress,
  leadingContent,
  trailing,
  titleStyle = 'serif',
}: NavHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { marginTop: insets.top }]}>
      <View style={styles.side}>
        {leading && onLeadingPress ? (
          <IconButton
            icon={leading}
            accessibilityLabel={leading === 'back' ? 'Back' : 'Close'}
            onPress={onLeadingPress}
          />
        ) : (
          leadingContent
        )}
      </View>
      {title ? (
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={titleStyle === 'serif' ? styles.serifTitle : styles.quietTitle}
        >
          {title}
        </Text>
      ) : null}
      <View style={[styles.side, styles.trailing]}>{trailing}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  side: {
    minWidth: 44,
  },
  trailing: {
    alignItems: 'flex-end',
  },
  serifTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.serifSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  quietTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.textSecondary,
  },
});
