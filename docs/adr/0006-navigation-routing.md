# ADR-0006: Navigation / routing library

**Status:** Accepted
**Date:** 2026-09-20
**Deciders:** Pandidharan

## Context

Step 0.5 of the [Execution Plan](../EXECUTION_PLAN.md) establishes the app's folder structure, and step 0.9 builds the navigation shell (Auth, Library, Player, Goals, Journal, Settings screens per [SYSTEM_DESIGN.md §3](../SYSTEM_DESIGN.md#3-component-breakdown)). Both depend on how routing is structured, so this decision needs to be made now rather than implicitly.

## Decision

Use **Expo Router** (file-based routing, `app/` directory as the source of truth for screens).

## Options Considered

### Option A: Expo Router
| Dimension | Assessment |
|---|---|
| Complexity | Low — routes are files, no manual navigator wiring |
| Cost | $0 |
| Scalability | Fine at this app's screen count; typed routes supported |
| Team familiarity | N/A; file-based routing has a shallow learning curve |
| Portfolio signal | Strong — it's Expo's current recommended default and the direction the ecosystem is moving |

**Pros:** colocates route definition with the screen; deep linking and typed routes come largely for free; less boilerplate than manually configuring navigators; actively the path Expo steers new projects toward, which matters for a portfolio artifact staying current.
**Cons:** file-based conventions (layouts, groups, dynamic segments) have their own learning curve if unfamiliar; slightly more "magic" than explicit navigator configuration.

### Option B: React Navigation (manually configured)
| Dimension | Assessment |
|---|---|
| Complexity | Medium — explicit stack/tab navigator setup, linking config written by hand |
| Cost | $0 |
| Scalability | Proven at any scale |
| Team familiarity | N/A; very large community and documentation base |
| Portfolio signal | Still solid, but increasingly the "manual" alternative to Expo Router rather than the default |

**Pros:** maximum explicit control over navigation structure; no file-based conventions to learn.
**Cons:** more boilerplate for the same result; deep linking config and route typing have to be hand-maintained; Expo Router is built on top of React Navigation anyway, so this option mostly adds manual work without a corresponding capability gain for this app's fairly standard navigation needs (a handful of stacks/tabs, no exotic routing requirements).

## Trade-off Analysis

Anthaathi's navigation needs are straightforward — an auth flow plus a handful of top-level screens (Library, Player, Goals, Journal, Settings) — with no requirement that pushes toward React Navigation's extra manual control. Expo Router is built on React Navigation internally, so nothing is lost in capability, and the reduced boilerplate directly serves the "portfolio-ready release soon" timeline goal. This isn't a close call for an app this size.

## Consequences

- Becomes easier: adding a new screen is adding a file under `app/`; deep linking and route params get reasonable defaults.
- Becomes harder: nothing significant at this app's scale; revisit only if a future screen needs navigation behavior Expo Router doesn't cleanly support (not anticipated).
- Folder structure: `app/` holds routes (file-based); `components/`, `hooks/`, `lib/` hold shared UI, hooks, and non-route logic respectively, created as they gain real content rather than scaffolded empty.

## Action Items

1. [ ] Install `expo-router` and its peer dependencies (Execution Plan step 0.5)
2. [ ] Replace `App.tsx`/`index.ts` entry with `app/_layout.tsx` + `app/index.tsx` (step 0.5)
3. [ ] Build out the real screen set per [SYSTEM_DESIGN.md §3](../SYSTEM_DESIGN.md#3-component-breakdown) (step 0.9)
