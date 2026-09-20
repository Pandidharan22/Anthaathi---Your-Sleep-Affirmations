# ADR-0004: Audio storage & sync strategy

**Status:** Accepted
**Date:** 2026-09-19
**Deciders:** Pandidharan

## Context

Affirmation recordings are the app's core artifact and are sensitive personal data (a user's own voice, often stating private goals). NFR-301 requires the core loop to work fully offline; NFR-601 caps infrastructure spend at $0; Supabase's free Storage tier is a shared 1GB ceiling across every future user if audio is uploaded by default.

## Decision

**Local-first storage**: recordings are written to and played from on-device filesystem storage always. Cloud backup to Supabase Storage is **opt-in**, off by default.

## Options Considered

### Option A: Local-first, cloud backup opt-in (chosen)
| Dimension | Assessment |
|---|---|
| Complexity | Low–Medium — needs a local DB + background sync queue for metadata, but no mandatory upload path |
| Cost | $0 — Storage quota only consumed by users who opt in |
| Scalability | Free-tier Storage ceiling scales with opt-in rate, not total user count |
| Privacy | Strongest — most sensitive data (audio) stays off any server unless the user explicitly asks |

**Pros:** satisfies NFR-301 directly (zero network dependency for core use); minimizes the free-tier resource most at risk of exhaustion (Storage); defaults to the more private option, consistent with the product's privacy stance ([PRD.md §8](../PRD.md#8-constraints--assumptions)).
**Cons:** no cross-device access unless the user opts in; requires building (lightweight) local-to-cloud metadata sync rather than treating Supabase as the single source of truth.

### Option B: Cloud-first (upload every recording by default)
| Dimension | Assessment |
|---|---|
| Complexity | Low — Supabase Storage as sole source of truth, no local sync logic |
| Cost | Consumes free-tier Storage quota per user from day one; risks hitting the 1GB ceiling quickly even with a handful of users given audio file sizes |
| Scalability | Poor fit for the free-tier constraint specifically |
| Privacy | Weaker default — every recording leaves the device whether or not the user cares to sync it |

**Pros:** simpler mental model, cross-device by default, no offline-sync edge cases.
**Cons:** directly conflicts with NFR-301 (offline-capable core loop) and burns the scarcest free-tier resource (Storage) fastest; makes the private-by-default privacy stance harder to justify.

### Option C: Local-only, no cloud sync at all in v1
| Dimension | Assessment |
|---|---|
| Complexity | Lowest |
| Cost | $0, no Storage usage ever |
| Scalability | N/A |
| Privacy | Strongest possible |

**Pros:** simplest to build, maximally private.
**Cons:** no backup path means a lost/wiped phone loses every recording permanently — an unacceptable data-loss risk for content users may have spent real effort creating; also blocks any future cross-device use case outright rather than deferring it.

## Trade-off Analysis

Option A and Option C both default to local storage; the difference is whether backup exists at all. Option A's added complexity (a sync queue, per [SYSTEM_DESIGN.md §6](../SYSTEM_DESIGN.md#6-key-sequence-flows)) is justified by removing a real data-loss risk that Option C accepts unnecessarily. Option B is rejected outright — it fails a hard requirement (NFR-301) rather than being merely a worse trade-off.

## Consequences

- Becomes easier: core recording/playback ships with zero network dependency; free-tier Storage usage grows only with actual opt-in demand.
- Becomes harder: metadata must reconcile between local DB and Postgres (last-write-wins is sufficient for v1's single-device assumption — see [SYSTEM_DESIGN.md §10](../SYSTEM_DESIGN.md#10-failure-modes--edge-cases)); multi-device conflict resolution is explicitly deferred, not solved.
- Revisit if: multi-device usage becomes a real requirement — would need a proper conflict-resolution strategy, not just last-write-wins.

## Action Items

1. [ ] Choose and implement local DB (SQLite via an Expo-compatible library) for recording metadata (Phase 1)
2. [ ] Build the background sync queue (local → Postgres) as part of Phase 1, not deferred to later
3. [ ] Implement opt-in cloud backup toggle and the corresponding Storage upload path (Phase 2 or later — not MVP-blocking)
