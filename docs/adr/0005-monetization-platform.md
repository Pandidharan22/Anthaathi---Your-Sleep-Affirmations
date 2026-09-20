# ADR-0005: Monetization / billing platform

**Status:** Proposed — deferred to Phase 6, not implemented in v1
**Date:** 2026-09-19
**Deciders:** Pandidharan

## Context

PRD goal G5 and the broader project motivation include an eventual paid release. Both app stores require in-app purchase mechanisms for digital subscriptions (a third-party payment processor like Stripe cannot legally be used for this on iOS/Android — store policy, not a technical constraint). This ADR is recorded now, ahead of implementation, so the v1 data model and app structure don't foreclose the chosen approach later (see [SYSTEM_DESIGN.md §11](../SYSTEM_DESIGN.md#11-what-wed-revisit-as-the-system-grows)).

## Decision (proposed)

Use **RevenueCat** to wrap App Store/Play Billing subscription handling, when monetization work begins in Phase 6. Not implemented in v1 — recorded here to inform data-model decisions made earlier (a future `subscriptions` table is anticipated, not yet built).

## Options Considered

### Option A: RevenueCat
| Dimension | Assessment |
|---|---|
| Complexity | Low — handles receipt validation, entitlement state, cross-platform subscription logic |
| Cost | Free up to $2.5k/mo tracked revenue — covers the entire realistic pre-scale range |
| Scalability | Purpose-built for exactly this | 
| Team familiarity | N/A |

**Pros:** avoids building and maintaining receipt-validation and entitlement logic by hand (a notoriously easy area to get subtly wrong); free tier comfortably covers early revenue; also a legitimate real-world integration to showcase in the portfolio narrative.
**Cons:** another third-party dependency; revenue-share-style free tier means a future cost reappears if revenue crosses the threshold — acceptable, since that means the product is succeeding.

### Option B: Raw StoreKit (iOS) + Play Billing (Android) integration, no wrapper
| Dimension | Assessment |
|---|---|
| Complexity | High — two separate native billing integrations, manual receipt validation, manual entitlement/state reconciliation |
| Cost | $0 in tooling fees |
| Scalability | Fine once built, but "once built" is the expensive part |
| Team familiarity | N/A |

**Pros:** no dependency, no revenue-share threshold ever.
**Cons:** significant solo-dev effort for a well-known hard problem (subscription state reconciliation, refunds, restores, grace periods) that a wrapper solves correctly out of the box; effort is better spent on the product's differentiators (Phase 2/3 features) than reimplementing billing infrastructure.

## Trade-off Analysis

This is not a close call at the project's current stage: Option B's cost advantage only matters after revenue exceeds RevenueCat's free threshold, at which point the product is generating meaningful money and the fee is easily justified. Building billing infrastructure by hand now would trade solo-developer time away from Phases 2–5, directly working against the "portfolio-ready release soon" goal.

## Consequences (anticipated)

- Becomes easier: subscription state, restores, and cross-platform entitlement checks handled by a vetted library instead of hand-rolled logic.
- Becomes harder: nothing significant at this scale.
- Data model impact now: leave room for a future `subscriptions`/`entitlements` table; do not build one in v1's schema ([SYSTEM_DESIGN.md §4](../SYSTEM_DESIGN.md#4-data-model)) since it would sit unused and drift from RevenueCat's actual data shape until Phase 6 design work happens for real.

## Action Items

1. [ ] Revisit and formally accept this ADR at the start of Phase 6, confirming RevenueCat's terms haven't materially changed
2. [ ] Design the subscription/entitlement data model at that time, informed by RevenueCat's actual webhook/event shape rather than guessed now
