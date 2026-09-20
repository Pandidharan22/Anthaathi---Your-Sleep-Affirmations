# ADR-0003: AI provider strategy for affirmation drafting

**Status:** Accepted
**Date:** 2026-09-19
**Deciders:** Pandidharan

## Context

FR-501/502 require drafting affirmation text from a stated goal, without ever auto-narrating it — the user always records the final text themselves. The product's non-negotiable constraint is $0 spend (NFR-601), and no vendor API key may ever ship in the client (NFR-203, FR-504). "Build the AI from scratch" was an initial ask; training a model is not realistic on a free-tier budget (see discussion in project chat history) — this ADR documents the realistic alternative: free-tier hosted models, called server-side.

## Decision

Call a **free-tier hosted LLM (Google Gemini or Groq)** from a **Supabase Edge Function**, never from the client directly. Provider choice between Gemini and Groq is left as an implementation-time decision (both satisfy the constraints below); pick whichever has the more favorable free-tier rate limits at implementation time.

## Options Considered

### Option A: Free-tier hosted LLM via server-side Edge Function (chosen)
| Dimension | Assessment |
|---|---|
| Complexity | Low — one HTTP call from an Edge Function |
| Cost | $0 within free-tier rate limits |
| Scalability | Bounded by provider's free-tier RPM/TPM; acceptable for personal + early-portfolio use (see [SYSTEM_DESIGN.md §8](../SYSTEM_DESIGN.md#8-free-tier-limits--scaling-path)) |
| Team familiarity | N/A; standard REST call |

**Pros:** zero cost, zero training/hosting burden, high-quality output from day one, key never leaves the server.
**Cons:** subject to provider rate limits and free-tier policy changes — mitigated by FR-503 (graceful degradation) since this feature is optional to the core loop.

### Option B: Self-trained/fine-tuned model
| Dimension | Assessment |
|---|---|
| Complexity | Very high |
| Cost | Effectively $0 in licensing but requires compute for training that free tiers don't realistically provide at usable quality |
| Scalability | N/A — not viable to reach parity with hosted frontier/open models on this budget |
| Team familiarity | N/A |

**Pros:** full control, no external dependency.
**Cons:** not achievable at the quality bar needed, within budget, by a solo developer — rejected outright rather than attempted and abandoned mid-project.

### Option C: Client-side call directly to the LLM provider
| Dimension | Assessment |
|---|---|
| Complexity | Lowest |
| Cost | $0 |
| Scalability | Same as Option A |
| Team familiarity | N/A |

**Pros:** simplest possible implementation.
**Cons:** violates NFR-203/FR-504 directly — any API key shipped in a mobile client bundle is extractable and abusable by anyone who decompiles the app. Rejected on security grounds, not cost or complexity.

## Trade-off Analysis

Option A and Option C are functionally similar except for where the API key lives — Option C is rejected purely on the hardcoded security constraint, not a close call. Option B is rejected on feasibility, not preference: it simply doesn't fit a $0, solo-developer, ship-soon project. The real trade-off within Option A is provider lock-in risk (free-tier terms can change), mitigated by keeping the Edge Function's provider-specific code isolated behind a small internal interface so switching providers later is a contained change, not a rewrite.

## Consequences

- Becomes easier: AI-assist ships without any billing setup or model-hosting infrastructure.
- Becomes harder: feature availability is subject to a third party's free-tier terms — accepted, because FR-503 makes this a non-blocking degradation rather than a core-loop risk.
- Revisit if: free-tier limits prove too restrictive for even personal daily use (unlikely at projected volume — one drafting request per new goal, not per night).

## Action Items

1. [ ] Implement `generate-affirmation` Edge Function per [SYSTEM_DESIGN.md §5](../SYSTEM_DESIGN.md#5-api-design) (Phase 3)
2. [ ] Store the LLM API key in Supabase Edge Function secrets, never in `.env` shipped to the client, never in git
3. [ ] Isolate provider-specific request/response mapping behind a small internal function so swapping Gemini ↔ Groq is a contained change
