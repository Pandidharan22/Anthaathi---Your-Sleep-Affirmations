import { Tabs } from 'expo-router';

import { TabBar } from '@/components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />}>
      {/* Redesigned tabs draw their own title (ScreenTitle); the rest keep the native header until their step. */}
      <Tabs.Screen name="index" options={{ title: 'Library', headerShown: false }} />
      <Tabs.Screen name="player" options={{ title: 'Player', headerShown: false }} />
      <Tabs.Screen name="goals" options={{ title: 'Goals' }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
