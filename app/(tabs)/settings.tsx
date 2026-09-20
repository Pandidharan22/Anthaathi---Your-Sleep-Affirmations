import { Link } from 'expo-router';

import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function SettingsScreen() {
  return (
    <PlaceholderScreen
      title="Settings"
      description="Account, reminders, and app preferences will live here."
    >
      <Link href="/auth">View auth screen (placeholder)</Link>
    </PlaceholderScreen>
  );
}
