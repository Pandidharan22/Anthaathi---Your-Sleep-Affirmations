import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { ThemedLink } from '@/components/ThemedLink';

export default function SettingsScreen() {
  return (
    <PlaceholderScreen
      title="Settings"
      description="Account, reminders, and app preferences will live here."
    >
      <ThemedLink href="/auth">View auth screen (placeholder)</ThemedLink>
    </PlaceholderScreen>
  );
}
