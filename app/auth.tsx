import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { ThemedLink } from '@/components/ThemedLink';

export default function AuthScreen() {
  return (
    <PlaceholderScreen
      title="Auth"
      description="Sign in / sign up placeholder — implemented in Phase 1 (FR-101–FR-103)."
    >
      <ThemedLink href="/(tabs)">Continue to app</ThemedLink>
    </PlaceholderScreen>
  );
}
