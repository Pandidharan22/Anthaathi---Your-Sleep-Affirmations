// The draft screens' shared copy and goal text, kept apart from lib/aiDraft.ts so screens and
// their tests can use them without loading the Supabase client.
import type { DraftErrorKind } from '@/lib/aiDraft';
import type { LocalGoal } from '@/lib/goals.local';

// invalid_request and unknown intentionally share copy: neither is something the
// user did wrong or can act on differently, so there's no reason to distinguish
// them on screen (kept distinct in DraftErrorKind for future debugging/telemetry).
export const DRAFT_ERROR_MESSAGES: Record<DraftErrorKind, string> = {
  rate_limited: "You've reached the limit for AI drafts for now — try again in a little while.",
  provider_unavailable: "Drafting isn't working right now. Please try again shortly.",
  invalid_request: 'Something went wrong. Please try again.',
  unknown: 'Something went wrong. Please try again.',
};

/** What a goal's draft is written from: its title, plus its description when it has one. */
export function goalDraftText(goal: Pick<LocalGoal, 'title' | 'description'>): string {
  return goal.description.trim() ? `${goal.title}: ${goal.description}` : goal.title;
}
