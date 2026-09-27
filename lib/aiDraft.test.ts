import { FunctionsHttpError } from '@supabase/supabase-js';

const mockInvoke = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

import { requestAffirmationDraft } from './aiDraft';

function httpError(status: number) {
  return new FunctionsHttpError({ status } as Response);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('requestAffirmationDraft', () => {
  it('returns the draft text on success', async () => {
    mockInvoke.mockResolvedValue({ data: { draftText: 'I am strong.' }, error: null });

    const result = await requestAffirmationDraft('goal-1', 'Run a marathon');

    expect(mockInvoke).toHaveBeenCalledWith('generate-affirmation', {
      body: { goalId: 'goal-1', goalText: 'Run a marathon' },
    });
    expect(result).toEqual({ ok: true, draftText: 'I am strong.' });
  });

  it('classifies a 429 as rate_limited', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: httpError(429) });

    expect(await requestAffirmationDraft('goal-1', 'x')).toEqual({ ok: false, kind: 'rate_limited' });
  });

  it('classifies a 502 as provider_unavailable', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: httpError(502) });

    expect(await requestAffirmationDraft('goal-1', 'x')).toEqual({ ok: false, kind: 'provider_unavailable' });
  });

  it('classifies a 400 as invalid_request', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: httpError(400) });

    expect(await requestAffirmationDraft('goal-1', 'x')).toEqual({ ok: false, kind: 'invalid_request' });
  });

  it('classifies an unexpected HTTP status as unknown', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: httpError(500) });

    expect(await requestAffirmationDraft('goal-1', 'x')).toEqual({ ok: false, kind: 'unknown' });
  });

  it('classifies a network error (no HTTP response at all) as unknown', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('network down') });

    expect(await requestAffirmationDraft('goal-1', 'x')).toEqual({ ok: false, kind: 'unknown' });
  });

  it('classifies an empty/malformed success body as unknown', async () => {
    mockInvoke.mockResolvedValue({ data: { draftText: '' }, error: null });

    expect(await requestAffirmationDraft('goal-1', 'x')).toEqual({ ok: false, kind: 'unknown' });
  });
});
