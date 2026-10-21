import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { colors, fonts } from '@/constants/theme';

// Route name → icon, from the Velvet Dusk board's tab bar. Play is drawn solid when
// active, as on the board; the others stay stroked.
const TAB_ICONS: Record<string, { icon: IconName; filledWhenActive?: boolean }> = {
  index: { icon: 'moon' },
  player: { icon: 'play', filledWhenActive: true },
  goals: { icon: 'goal' },
  journal: { icon: 'journal' },
  settings: { icon: 'settings' },
};

/**
 * The board's tab bar: icon + label per tab, with the active tab's icon in a light mauve
 * pill ("this is chosen"). The pill and the label turning from muted to cream are the
 * non-color cues; color alone never marks the active tab.
 */
export function TabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  // A screen can hide the bar with tabBarStyle display 'none' (the Player while a session
  // plays, R.7a); a custom tab bar has to honor that itself.
  const focusedOptions = descriptors[state.routes[state.index].key].options;
  const barStyle = StyleSheet.flatten(focusedOptions.tabBarStyle) as ViewStyle | undefined;
  if (barStyle?.display === 'none') return null;

  return (
    <View accessibilityRole="tablist" style={[styles.bar, { paddingBottom: insets.bottom + 10 }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const label = descriptors[route.key].options.title ?? route.name;
        const tab = TAB_ICONS[route.name] ?? { icon: 'moon' };

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            style={styles.tab}
          >
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Icon
                name={tab.icon}
                size={22}
                color={focused ? colors.background : colors.textMuted}
                filled={focused && tab.filledWhenActive}
              />
            </View>
            <Text
              style={[styles.label, { color: focused ? colors.textPrimary : colors.textMuted }]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.elevated,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  iconWrap: {
    width: 44,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.selected,
  },
  label: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 0.2,
  },
});
