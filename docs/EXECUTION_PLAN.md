# Execution Plan — Anthaathi

| | |
|---|---|
| **Status** | Living document — updated after every step |
| **Last updated** | 2026-09-20 |
| **Related** | [PRD.md](PRD.md) §6 (scope), [SRS.md](SRS.md) (FR-/NFR- IDs referenced below), [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md), [adr/](adr/) |

This is the authoritative build order. Work proceeds **one unchecked step at a time**, top to bottom within the current phase (rule 1 in `CLAUDE.md`). Each step is scoped to be independently verifiable and independently committable — if a step feels too big to verify in one sitting, split it before starting rather than mid-way through.

**How to use this file each session**: find the first unchecked `[ ]` step below — that is the next step. Do not skip ahead to a later step or start a later phase early, even if it looks quick, without the user explicitly redirecting. When a step is completed and committed, check it off (`[x]`) as part of the Dev Journal commit for that step, and update `CLAUDE.md`'s Current Status section.

Each step lists the requirement IDs it implements (traceability back to [SRS.md](SRS.md)) and the skill(s) to use (rule 5).

---

## Phase 0 — Foundations

Goal: a running, empty app with the right scaffolding — nothing user-facing yet, but every later phase builds on this being solid.

- [x] **0.1** Decide product concept, name, tagline, scope
- [x] **0.2** Write PRD, SRS, System Design doc, ADRs 0001–0005
- [x] **0.3** Write this execution plan
- [x] **0.4** Scaffold the Expo app (TypeScript template) — implements [ADR-0001](adr/0001-mobile-app-framework.md). Verify: app builds and runs on at least one simulator/device.
- [x] **0.5** Base project config: ESLint, Prettier, TypeScript strict mode, folder structure (`app/`, `components/`, `lib/`, `hooks/`, etc.). Verify: `lint`/`typecheck` scripts pass on the empty scaffold.
- [x] **0.6** Testing harness: Jest + React Native Testing Library, one trivial passing test. Use `engineering:testing-strategy` to decide the coverage approach up front (supports NFR-501). Verify: `test` script runs green in CI.
- [ ] **0.7** CI pipeline: GitHub Actions running lint + typecheck + test on every push. Verify: a deliberately broken PR/commit fails the pipeline, a clean one passes.
- [ ] **0.8** Create the Supabase project (dashboard), wire `.env.example` + `.env` (git-ignored) for its URL/anon key — implements part of [ADR-0002](adr/0002-backend-platform.md). Verify: client can reach Supabase (a trivial auth-status check) with no secrets in git (`git log -p` spot check).
- [ ] **0.9** Navigation shell: routes/screens for Auth, Library, Player, Goals, Journal, Settings as placeholders (no logic yet). Verify: can navigate between all placeholder screens.
- [ ] **0.10** Base design system: color tokens, typography, spacing, light/dark mode — use `design:design-system`. Verify: placeholder screens render correctly in both light and dark mode.

**Phase 0 exit criteria**: empty-but-real app running on a device, CI green, Supabase reachable, no secrets committed, design tokens in place.

---

## Phase 1 — Core parity (self-spoken affirmations)

Goal: the app is usable for its core purpose — record, organize, and loop-play your own voice — matching the reference app's core loop. Implements FR-101–FR-304.

- [ ] **1.1** Supabase schema + RLS migrations for `folders`, `affirmations` (metadata), matching [SYSTEM_DESIGN.md §4](SYSTEM_DESIGN.md#4-data-model). Verify: RLS policy test — user A cannot read/write user B's rows.
- [ ] **1.2** Auth screens: sign up, sign in, sign out, persisted session. Implements FR-101–FR-103. Verify: manual test of all three flows + app-restart session persistence.
- [ ] **1.3** Local-first data layer: on-device SQLite + sync queue skeleton to Postgres — implements [ADR-0004](adr/0004-audio-storage-strategy.md). Verify: create a record offline, confirm it syncs once connectivity returns.
- [ ] **1.4** Recording flow: mic capture, preview, discard/re-record, save. Implements FR-201–FR-202. Verify: manual record→save round trip on-device; mic permission rationale copy reviewed (NFR-204).
- [ ] **1.5** Trim UI on a saved/pending recording. Implements FR-203.
- [ ] **1.6** Folder CRUD + assigning recordings to folders. Implements FR-204–FR-206.
- [ ] **1.7** Player: loop playback, sleep timer, continues when backgrounded/locked. Implements FR-301–FR-303. Verify: playback survives lock screen on both iOS and Android test devices.
- [ ] **1.8** Account deletion (data + auth). Implements FR-104, NFR-205.
- [ ] **1.9** Phase review: run `engineering:code-review` over the phase's diff before moving to Phase 2.

**Phase 1 exit criteria**: can record, organize, and fall asleep to a looping self-spoken affirmation, fully offline-capable (NFR-301), across an app restart.

---

## Phase 2 — Manifestation features

Goal: the differentiator layer beyond the reference app. Implements FR-401–FR-404, FR-601–FR-604, FR-701–FR-702.

- [ ] **2.1** Goals schema + vision board CRUD UI (text + optional image). Implements FR-401–FR-403.
- [ ] **2.2** Mark-achieved / completed-goals view. Implements FR-404.
- [ ] **2.3** `playback_sessions` logging + derived streak calculation and display. Implements FR-601–FR-602.
- [ ] **2.4** Journal entries (prompted + freeform), chronological view. Implements FR-603–FR-604.
- [ ] **2.5** Local daily reminder notifications, opt-in/opt-out. Implements FR-701–FR-702.
- [ ] **2.6** Design pass over all Phase 2 screens: `design:design-critique` then `design:accessibility-review` (NFR-401–NFR-403).

**Phase 2 exit criteria**: a user can set a goal, get reinforced by a streak, and journal — the full manifestation loop works without AI involvement yet.

---

## Phase 3 — AI layer

Goal: goal-to-affirmation drafting, without ever compromising the self-spoken principle or a secret key. Implements FR-501–FR-504, [ADR-0003](adr/0003-ai-provider-strategy.md).

- [ ] **3.1** Supabase Edge Function scaffold + provider secret stored server-side only. Verify: key is absent from the client bundle (grep the built artifact).
- [ ] **3.2** `generate-affirmation` function: goal → draft text, per-user rate limiting. Implements FR-501, FR-504.
- [ ] **3.3** Client integration: request draft → user edits/accepts → normal record flow. Implements FR-502 (never auto-narrated).
- [ ] **3.4** Error/degradation handling for provider downtime or rate limits. Implements FR-503. Verify: simulate a 429/502 and confirm the app shows a clear error, not a crash.
- [ ] **3.5** **Decision point**: ship the optional synthetic-voice (TTS) mode now or fast-follow post-launch — resolve the open question in [PRD.md §10](PRD.md#10-open-questions) before proceeding further in this phase.

**Phase 3 exit criteria**: AI-assisted drafting works end-to-end and fails gracefully; core app is provably unaffected if the AI provider is unreachable.

---

## Phase 4 — Audio studio polish

Goal: the in-app audio studio experience (ambience/music-bed layering) that the reference app is known for. Extends FR-304.

- [ ] **4.1** Source/curate a small CC0 ambience + music-bed library (freesound.org CC0 filter or equivalent).
- [ ] **4.2** Layering/mixing implementation (affirmation track + ambience bed).
- [ ] **4.3** Audio studio UI (volume balance, bed selection).
- [ ] **4.4** Design + accessibility pass on the studio UI.

**Phase 4 exit criteria**: a recorded affirmation can be layered with an ambience/music bed and saved as part of the nightly playback.

---

## Phase 5 — Store readiness

Goal: ship. Gate for App Store / Play Store submission.

- [ ] **5.1** Final app icon, splash screen, visual identity.
- [ ] **5.2** Privacy policy written and linked in-app (covers mic use, voice storage, account deletion — [SRS.md §8](SRS.md#8-compliance)).
- [ ] **5.3** Full accessibility audit — `design:accessibility-review` (NFR-401–NFR-403).
- [ ] **5.4** Performance pass: cold start < 2s, app size < 60MB (NFR-101–NFR-103) — `engineering:deploy-checklist`.
- [ ] **5.5** EAS build configuration; internal testing via TestFlight + Play internal track.
- [ ] **5.6** Store listing assets (screenshots, description) + submission.

**Phase 5 exit criteria**: app is live (or in store review) on both platforms.

---

## Phase 6 — Monetization (post-MVP)

Goal: sustainable revenue, deferred per [ADR-0005](adr/0005-monetization-platform.md) until there's a live app to monetize.

- [ ] **6.1** Revisit and formally accept ADR-0005; confirm RevenueCat's current terms.
- [ ] **6.2** Design the subscription/entitlement data model against RevenueCat's actual event shape.
- [ ] **6.3** Paywall UI + `design:ux-copy` pass.
- [ ] **6.4** RevenueCat SDK integration.
- [ ] **6.5** Decide and implement a real give-back mechanic (e.g. tree planting), now fundable by revenue.

---

## Notes on sequencing discipline

- Phases are ordered by dependency, not by interest — Phase 2 (manifestation features) cannot start meaningfully until Phase 1's data layer and auth exist.
- A step is not "done" until it's verified (rule 2) and committed with its Dev Journal entry (rule 3) — checking a box here happens as part of that commit, not before.
- If a step turns out to hide a bigger sub-problem once started, stop and re-plan that step into smaller ones rather than pushing through unplanned scope (rule 1).
