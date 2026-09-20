import { Link } from 'expo-router';

import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function AuthScreen() {
  return (
    <PlaceholderScreen
      title="Auth"
      description="Sign in / sign up placeholder — implemented in Phase 1 (FR-101–FR-103)."
    >
      <Link href="/(tabs)">Continue to app</Link>
    </PlaceholderScreen>
  );
}
