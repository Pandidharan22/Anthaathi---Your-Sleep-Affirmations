# ADR-0001: Mobile app framework

**Status:** Accepted
**Date:** 2026-09-19
**Deciders:** Pandidharan

## Context

Anthaathi needs a phone app (iOS + Android) built by a solo developer on a $0 infrastructure budget, with a hard requirement for background audio playback, microphone recording, and reasonably fast iteration speed. The project also serves as a portfolio piece, so the stack's market relevance matters alongside technical fit.

## Decision

Build with **React Native + Expo (managed workflow, TypeScript)**.

## Options Considered

### Option A: React Native + Expo
| Dimension | Assessment |
|---|---|
| Complexity | Low–Medium — one codebase, managed native tooling |
| Cost | $0 — Expo/EAS free build tier covers solo-dev iteration |
| Scalability | Sufficient for a consumer app at this scale; ejects to bare workflow if needed |
| Team familiarity | N/A (solo), but RN has the largest ecosystem/tutorial base of the options |
| Portfolio signal | Strong — most in-demand cross-platform mobile stack |

**Pros:** single codebase for both platforms; free EAS build tier reaches both app stores without owning a Mac for iOS builds; expo-av covers recording/background-audio needs directly; huge community for unblocking solo-dev issues.
**Cons:** managed workflow abstracts some native APIs — occasionally needs a config plugin or prebuild step for deeper native access.

### Option B: Native (Swift + Kotlin, two codebases)
| Dimension | Assessment |
|---|---|
| Complexity | High — two codebases, two toolchains |
| Cost | $0 in tooling, but requires a Mac for iOS |
| Scalability | Best possible native performance/control |
| Team familiarity | N/A |
| Portfolio signal | Strong per-platform, but doubles the surface area to maintain and demo |

**Pros:** best-in-class native audio/background APIs, no abstraction layer.
**Cons:** roughly 2x the implementation and maintenance effort for a solo dev; directly conflicts with the "push for a portfolio-ready release soon" timeline goal.

### Option C: Flutter
| Dimension | Assessment |
|---|---|
| Complexity | Low–Medium, similar to RN |
| Cost | $0 |
| Scalability | Comparable to RN |
| Team familiarity | N/A |
| Portfolio signal | Weaker than RN — smaller hiring-market footprint |

**Pros:** single codebase, good performance.
**Cons:** smaller ecosystem for this app's specific needs (audio mixing libraries less mature than RN's); less valuable as a portfolio signal given current market demand skews toward RN/TypeScript.

### Option D: PWA (web-first, installable)
| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Cost | $0, no store fees at all |
| Scalability | Fine for the UI; weak for the product's core needs |
| Team familiarity | N/A |
| Portfolio signal | Weakest — not a "shipped app" in the way store presence is |

**Pros:** zero store fees, fastest to deploy.
**Cons:** weak background-audio support (the sleep-timer-while-locked requirement is central to the product and PWAs handle this poorly across iOS Safari in particular); undermines both G5 (store submission) and G4 (portfolio quality) from the PRD.

## Trade-off Analysis

The decision is dominated by two PRD goals that pull in the same direction: **G3** (free-tier budget) and **G5** (store submission timeline). Native (Option B) is rejected primarily on effort — doubling codebases is the single biggest threat to shipping at all as a solo developer. PWA (Option D) is rejected on a hard functional requirement (FR-303, background playback) rather than effort. Flutter (Option C) is a reasonable second choice but loses to React Native on portfolio relevance and audio-library maturity, with no offsetting technical advantage for this specific app.

## Consequences

- Becomes easier: shipping to both stores from one codebase; hiring-market-relevant portfolio artifact; large ecosystem of RN audio/notification libraries to draw on.
- Becomes harder: any deep native-only API access requires a config plugin or workflow eject — acceptable, not expected to be needed for this feature set.
- Revisit if: a specific native capability proves unreachable through Expo's managed workflow and config plugins (not anticipated for the current scope).

## Action Items

1. [ ] Scaffold Expo + TypeScript project (Phase 0)
2. [ ] Confirm expo-av supports background audio + sleep-timer requirements on both platforms before Phase 1 is considered complete
