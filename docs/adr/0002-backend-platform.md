# ADR-0002: Backend platform

**Status:** Accepted
**Date:** 2026-09-19
**Deciders:** Pandidharan

## Context

Anthaathi needs auth, a relational store for structured data (folders, goals, journal entries, playback sessions — see [SYSTEM_DESIGN.md §4](../SYSTEM_DESIGN.md#4-data-model)), and object storage for optionally-synced audio/images, all under NFR-601 ($0/month through MVP) and NFR-202 (per-user data isolation enforced at the data layer, not just in application code).

## Decision

Use **Supabase** (Postgres + Auth + Storage + Edge Functions) on its free tier.

## Options Considered

### Option A: Supabase
| Dimension | Assessment |
|---|---|
| Complexity | Low — one platform for auth, DB, storage, and server functions |
| Cost | $0 on free tier (500MB DB, 1GB storage, 50k MAU auth) |
| Scalability | Real Postgres underneath — standard scaling path if it's ever outgrown |
| Team familiarity | N/A; SQL + Postgres is a transferable, well-documented skillset |

**Pros:** Postgres gives real relational integrity and row-level security (directly satisfies NFR-202) rather than a NoSQL document model bolted onto ad-hoc rules; Edge Functions cover the one server-side-secret requirement (FR-504) without standing up separate infrastructure; generous free tier; open-source (no hard vendor lock-in — it's Postgres).

**Cons:** smaller ecosystem/tutorial base than Firebase; Edge Functions (Deno-based) are a less common runtime than Node.

### Option B: Firebase
| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Cost | $0 on Spark plan, but with lower effective ceilings on some quotas |
| Scalability | Strong, Google-operated |
| Team familiarity | N/A; very large tutorial ecosystem |

**Pros:** mature, huge community, tight RN integration.
**Cons:** Firestore's document model and security-rules language are weaker fits for this app's genuinely relational data (a goal has many journal entries, playback sessions reference affirmations, etc.) — would mean either denormalizing awkwardly or fighting the data model; RLS-equivalent (Firestore security rules) is less expressive than Postgres RLS for the per-user isolation guarantee in NFR-202.

### Option C: Custom backend (Node/Express + Postgres, self-hosted)
| Dimension | Assessment |
|---|---|
| Complexity | High — build and operate auth, API, and hosting yourself |
| Cost | $0 achievable (e.g. Render/Fly free tier) but with real operational burden |
| Scalability | Fully controlled, but that control isn't needed at this stage |
| Team familiarity | N/A |

**Pros:** total control, no vendor dependency.
**Cons:** reinvents auth, RLS-equivalent authorization, and storage from scratch — pure effort cost with no functional benefit at this scale; directly works against the "push for a portfolio-ready release soon" timeline.

## Trade-off Analysis

The deciding factor is the data model: Anthaathi's entities are genuinely relational (§4 of System Design), and Postgres + RLS satisfies the hard data-isolation requirement (NFR-202) more directly than Firestore's rules language. Firebase remains a credible second choice and isn't rejected on cost or maturity — it's rejected on data-model fit. Option C is rejected purely on effort: it solves a problem (needing full backend control) that doesn't exist yet at this scale.

## Consequences

- Becomes easier: relational queries (e.g. streak derivation joins, folder/affirmation relationships) map directly to SQL; RLS gives auditable per-user isolation as a database-level guarantee, not just application logic.
- Becomes harder: Edge Functions' Deno runtime has a smaller library ecosystem than Node — acceptable, since the one Edge Function needed (§5 of System Design) is a thin HTTP-call wrapper.
- Revisit if: DB or egress free-tier ceilings are approached (tracked in [SYSTEM_DESIGN.md §8](../SYSTEM_DESIGN.md#8-free-tier-limits--scaling-path)) — upgrade path is Supabase Pro, not a platform migration.

## Action Items

1. [ ] Create Supabase project (Phase 0)
2. [ ] Define initial schema + RLS policies matching [SYSTEM_DESIGN.md §4](../SYSTEM_DESIGN.md#4-data-model) (Phase 1)
3. [ ] Store Supabase URL/anon key in `.env`, never committed (per [SRS.md NFR-203](../SRS.md#52-security--privacy))
