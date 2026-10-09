# Execution Plan — Anthaathi

| | |
|---|---|
| **Status** | Living document — updated after every step |
| **Last updated** | 2026-09-21 |
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
- [x] **0.7** CI pipeline: GitHub Actions running lint + typecheck + test on every push. Verify: a deliberately broken PR/commit fails the pipeline, a clean one passes.
- [x] **0.8** Create the Supabase project (dashboard), wire `.env.example` + `.env` (git-ignored) for its URL/anon key — implements part of [ADR-0002](adr/0002-backend-platform.md). Verify: client can reach Supabase (a trivial auth-status check) with no secrets in git (`git log -p` spot check).
- [x] **0.9** Navigation shell: routes/screens for Auth, Library, Player, Goals, Journal, Settings as placeholders (no logic yet). Verify: can navigate between all placeholder screens.
- [x] **0.10** Base design system: color tokens, typography, spacing, light/dark mode — use `design:design-system`. Verify: placeholder screens render correctly in both light and dark mode.

**Phase 0 exit criteria**: empty-but-real app running on a device, CI green, Supabase reachable, no secrets committed, design tokens in place.

---

## Phase 1 — Core parity (self-spoken affirmations)

Goal: the app is usable for its core purpose — record, organize, and loop-play your own voice — matching the reference app's core loop. Implements FR-101–FR-304.

- [x] **1.1** Supabase schema + RLS migrations for `folders`, `affirmations` (metadata), matching [SYSTEM_DESIGN.md §4](SYSTEM_DESIGN.md#4-data-model). Verify: RLS policy test — user A cannot read/write user B's rows.
- [x] **1.2** Auth screens: sign up, sign in, sign out, persisted session. Implements FR-101–FR-103. Verify: manual test of all three flows + app-restart session persistence.
- [x] **1.3** Local-first data layer: on-device SQLite + sync queue skeleton to Postgres — implements [ADR-0004](adr/0004-audio-storage-strategy.md). Verify: create a record offline, confirm it syncs once connectivity returns.
- [x] **1.4** Recording flow: mic capture, preview, discard/re-record, save. Implements FR-201–FR-202. Verify: manual record→save round trip on-device; mic permission rationale copy reviewed (NFR-204).
- [x] **1.5** Trim UI on a saved/pending recording. Implements FR-203.
- [x] **1.6** Folder CRUD + assigning recordings to folders. Implements FR-204–FR-206.
- [x] **1.7** Player: loop playback, sleep timer, continues when backgrounded/locked. Implements FR-301–FR-303. Verify: playback survives lock screen on both iOS and Android test devices.
- [x] **1.8** Account deletion (data + auth). Implements FR-104, NFR-205.
- [x] **1.9** Phase review: run `engineering:code-review` over the phase's diff before moving to Phase 2.

**Phase 1 exit criteria**: can record, organize, and fall asleep to a looping self-spoken affirmation, fully offline-capable (NFR-301), across an app restart.

---

## Phase 2 — Manifestation features

Goal: the differentiator layer beyond the reference app. Implements FR-401–FR-404, FR-601–FR-604, FR-701–FR-702.

- [x] **2.1** Goals schema + vision board CRUD UI (text + optional image). Implements FR-401–FR-403.
- [x] **2.2** Mark-achieved / completed-goals view. Implements FR-404. (Already satisfied by step 2.1's implementation — see Dev_Journal.md.)
- [x] **2.3** `playback_sessions` logging + derived streak calculation and display. Implements FR-601–FR-602.
- [x] **2.4** Journal entries (prompted + freeform), chronological view. Implements FR-603–FR-604.
- [x] **2.5** Local daily reminder notifications, opt-in/opt-out. Implements FR-701–FR-702.
- [x] **2.6** Design pass over all Phase 2 screens: `design:design-critique` then `design:accessibility-review` (NFR-401–NFR-403).

**Phase 2 exit criteria**: a user can set a goal, get reinforced by a streak, and journal — the full manifestation loop works without AI involvement yet.

---

## Phase 3 — AI layer

Goal: goal-to-affirmation text drafting (FR-501–FR-504, [ADR-0003](adr/0003-ai-provider-strategy.md)) and AI Guided voice sessions (FR-511–FR-516, [ADR-0007](adr/0007-voice-synthesis-strategy.md)), without ever compromising the self-spoken principle or a secret key.

**Text drafting**
- [x] **3.1** Supabase Edge Function scaffold + provider secret stored server-side only. Verify: key is absent from the client bundle (grep the built artifact).
- [x] **3.2** `generate-affirmation` function: goal → draft text, per-user rate limiting. Implements FR-501, FR-504.
- [x] **3.3** Client integration: request draft → user edits/accepts → normal record flow. Implements FR-502 (never auto-narrated).
- [x] **3.4** Error/degradation handling for provider downtime or rate limits. Implements FR-503. Verify: simulate a 429/502 and confirm the app shows a clear error, not a crash.

**AI Guided voice sessions (native, on-device — ADR-0007)**
- [x] **3.5** Set up `expo-dev-client` and an EAS development build profile — prerequisite; nothing below this can be tested via Expo Go or the web-preview workflow.
- [x] **3.6** Android native module (Kotlin): wrap `TextToSpeech.synthesizeToFile()`. Verify: synthesizes a known string to a playable WAV file on a real device/emulator.
- [ ] **3.7** iOS native module (Swift): wrap `AVSpeechSynthesizer`'s buffer-writing API, assemble to a playable file. Verify: same check as 3.6, on a real device/simulator. **Deferred** (2026-09-28) — no Mac/iOS device available on this Windows dev setup, and installing a dev build on a physical iOS device needs an Apple Developer Program membership ($99/yr), which conflicts with NFR-601's $0 budget (same reasoning as the Android-only call in step 3.5). Revisit once monetization funds the developer account, or if a Mac/iOS device becomes available.
- [x] **3.8** Unify behind one Expo Module JS interface: voice listing, `synthesize(text, voiceId) → local file path`. Implements FR-512, FR-513. **Android-only for now** (3.7 deferred) — the JS interface should stay platform-agnostic in shape so iOS slots in later without a redesign, but only the Android implementation needs to exist behind it right now.
- [x] **3.9** Extend `affirmations` schema with `source`, `voice_id`, `script_text` (see [SYSTEM_DESIGN.md §4](SYSTEM_DESIGN.md#4-data-model)); wire caching/re-synthesis logic. Implements FR-514.
- [x] **3.10** Client integration: mode toggle (Self-Recorded / AI Guided) + voice picker, feeding into the same Library/Player as recordings. Implements FR-511, FR-515.
- [x] **3.11** Error/degradation handling for synthesis failure. Implements FR-516. Verify: simulate a synthesis failure and confirm a clear error, no crash, no partial file saved.
- [x] **3.12** Voice pacing: slower per-voice rate/pitch, per-sentence pauses, and a gap between affirmations in the Player (user feedback after step 4.2: too fast, no pauses). Per-voice values tuned by ear on-device (male 0.8/1/1.8s, female 0.6/1/1.8s).
- [x] **3.13a** Spike: Kokoro v1.0 (full precision) on-device via sherpa-onnx, our own thin module (`modules/anthaathi-neural-tts`) around the official AAR; dev screen only. Verified on the user's phone: install 158 s, load 1.8 s, synthesis ~0.5-0.6x real time; voices Bella (0.8), Nicole, Echo, Michael (1.0) judged good, with phrase pauses (1.8 s sentence / 0.5 s comma or `/`).
- [x] **3.13b** Real integration: Kokoro voices in the AI Guided picker with fallback to system voices when the model isn't installed; Settings download/delete of the model; host the model on our own GitHub release; `/` hint in the script editor and `/` marks in AI drafts; new ADR superseding the relevant part of ADR-0007; APK size vs NFR-103 (+24 MB arm64 native lib). Decided: model downloaded from sherpa-onnx's release pinned by SHA-256 (no mirror yet); default voices Nicole + Michael; AI drafts get `/` marks (Edge Function redeploy OK'd); espeak-ng kept for quality, so the project is GPL-3.0-or-later. Sub-steps 1-6 done (download checksum + arm64-only, model management, Settings download, picker integration, `/` hint + pause marks in AI drafts, [ADR-0008](adr/0008-on-device-neural-voices.md) + docs + dev screen removed). Sub-step 7 done: CI-mode run, code review over the branch (5 findings fixed, see journal), verified on the user's phone. Delivered to `develop` via the first feature PR.

**Parked for later (not scheduled)**: let the user choose how many affirmations to draft for a goal (requested 2026-10-10). Today one draft gives 2-3 sentences (about 3 affirmations); allow choosing up to 20 per goal. Things to weigh when it's picked up: one request returning many lines vs. many requests against the 20-per-24h rate limit (`ai_generation_log`), Groq output-token limits, whether "20 per goal" is a per-request cap or a lifetime cap per goal, and how the draft screen lets the user keep some lines and drop others.

**Phase 3 exit criteria**: AI-assisted text drafting works end-to-end and fails gracefully; AI Guided voice sessions generate, cache, and play through the standard Player exactly like a recording; core app is provably unaffected if either the LLM provider or on-device synthesis is unavailable.

---

## Phase 4 — Audio studio polish

Goal: the in-app audio studio experience (ambience/music-bed layering) that the reference app is known for. Extends FR-304.

- [x] **4.1** Source/curate a small CC0 ambience + music-bed library (freesound.org CC0 filter or equivalent). — 4 beds in `assets/beds/` (rain, ocean, crickets, pad); see `assets/beds/README.md`.
- [x] **4.2** Layering/mixing implementation (affirmation track + ambience bed). — two-player crossfaded loop in `lib/bedLoop.ts`, wired into the Player; verified on-device.
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
