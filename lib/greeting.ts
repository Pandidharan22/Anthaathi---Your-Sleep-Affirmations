/**
 * The Library's "Good evening, Maya." line. The time of day decides the greeting; the
 * name is the one given at sign-up (`user_metadata.display_name`). Accounts made before
 * the Name field have none, so they just get the greeting.
 */
export function greeting(now: Date, name?: string | null): string {
  const hour = now.getHours();
  const part =
    hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : 'evening';
  const trimmed = name?.trim();
  return trimmed ? `Good ${part}, ${trimmed}.` : `Good ${part}.`;
}
