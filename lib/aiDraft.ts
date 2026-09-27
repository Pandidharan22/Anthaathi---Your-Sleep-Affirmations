import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type DraftErrorKind = 'rate_limited' | 'provider_unavailable' | 'invalid_request' | 'unknown';

export type DraftAffirmationResult = { ok: true; draftText: string } | { ok: false; kind: DraftErrorKind };

/** FR-501/FR-504: requests AI-drafted affirmation text for a goal via the generate-affirmation Edge Function. */
export async function requestAffirmationDraft(
  goalId: string,
  goalText: string,
): Promise<DraftAffirmationResult> {
  const { data, error } = await supabase.functions.invoke<{ draftText: string }>('generate-affirmation', {
    body: { goalId, goalText },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const status = error.context.status as number;
      if (status === 429) return { ok: false, kind: 'rate_limited' };
      if (status === 502) return { ok: false, kind: 'provider_unavailable' };
      if (status === 400) return { ok: false, kind: 'invalid_request' };
    }
    return { ok: false, kind: 'unknown' };
  }

  if (!data || typeof data.draftText !== 'string' || data.draftText.trim().length === 0) {
    return { ok: false, kind: 'unknown' };
  }

  return { ok: true, draftText: data.draftText };
}
