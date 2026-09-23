/**
 * Static rotating journal prompts (FR-603). No AI/backend involved — Phase 2
 * is explicitly scoped to work "without AI involvement yet" (see
 * EXECUTION_PLAN.md's Phase 2 exit criteria); goal-to-affirmation AI drafting
 * is a separate, later Phase 3 feature and doesn't extend to this.
 */
const PROMPTS = [
  'What went well today, even if it was small?',
  'What are you grateful for right now?',
  "What's one step you took today toward a goal that matters to you?",
  'What would you tell a friend who was having the day you had?',
  'What is one thing you want to let go of before you sleep?',
  'Where did you feel most like yourself today?',
  'What is something you are looking forward to?',
  "What's a challenge you faced today, and what did it teach you?",
  'What does "success" look like for you this week?',
  'What is one kind thing you did — for yourself or someone else — today?',
  'What thought keeps coming back to you tonight?',
  'If tomorrow went perfectly, what would that look like?',
] as const;

/** Local calendar-day-based index — same day, same prompt, changes daily. */
function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diffMs = date.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function getDailyPrompt(now: Date = new Date()): string {
  return PROMPTS[dayOfYear(now) % PROMPTS.length];
}
