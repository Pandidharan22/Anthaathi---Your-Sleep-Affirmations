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
- [x] **4.3** Audio studio UI (volume balance, bed selection). — `components/BedPicker.tsx` in the Player: ambience chips with an 8 s preview before Play, and one voice/ambience balance slider (user's choice), live while playing.
- [x] **4.4** Design + accessibility pass on the studio UI. — slider track/thumb contrast (new `controlAccent` token), 44+ pt touch targets, slider only with a bed, controls set apart from Stop, screen-reader labels.

**Phase 4 exit criteria**: a recorded affirmation can be layered with an ambience/music bed and saved as part of the nightly playback.

---

## UI/UX redesign (before Phase 5)

Requested by the user on 2026-10-10: the whole app's UI/UX is to be redesigned **before** starting Store Readiness. The user will provide their design ideas; the steps get planned from those, not before. Phase 5 does not start until this is done.

**Design direction chosen 2026-10-17: see [DESIGN.md](DESIGN.md).** Potential users found the first "Dawn Glow" palette too warm because of the orange; the current direction is the cooler "Velvet Dusk" palette, with terracotta used only as an accent for selected/on states and a soft glow around the voice controls, plus the "Cradle" logo. All 24 screens are on the design canvas linked from DESIGN.md.

Other inputs already known: gold-on-light contrast failing across buttons and selected chips (deferred from 2.6 and 4.4); the Player's duplicated "Player" title and the off-screen "No timer" chip; no screen titles using `accessibilityRole="header"` and no explicit `TextInput` labels (deferred from 2.6).

**Scope (decided 2026-10-17):** the redesign also builds every feature the mockups show that the app doesn't have yet (the user chose "include all extras" over restyling only). Each extra is listed in the step for its screen; extras that need a migration or an Edge Function change are marked **(migration)** / **(Edge Function)** and get the same local-stack verification as Phases 1–3.

- [x] **R.1** Foundations: Velvet Dusk tokens in `constants/theme.ts`, replacing the gold set, named by role (mauve = action, terracotta = selected/on) — a single dark set; the app is dark-only (`userInterfaceStyle: "dark"`), light theme deferred per NFR-403. Load Fraunces, Nunito and Playfair Display; typography tokens get their font families. Script-check the contrast table in DESIGN.md against the real token values. Confirm on the phone that RN 0.86's `boxShadow` glow and `experimental_backgroundImage` gradients render on Android before building on them. Done: both render on Android (user's phone, 2026-10-17); react-native-web 0.21 drops `experimental_backgroundImage`, so R.2 needs a web fallback for the preview. Temporary `app/dev-design-check.tsx` is removed in R.2.
- [x] **R.2** Shared components: pill button (gradient fill with dark text / secondary / text), chip (terracotta selected state plus a non-color cue), card, labelled text field (closes the missing `TextInput` labels), screen header (`accessibilityRole="header"`, gradient title), round glowing voice control, dusk mesh background, custom tab bar with icons and a terracotta active state. Done: `components/ui/` (Button, IconButton, Chip, Card, TextField, GradientText, ScreenTitle, NavHeader, GlowButton, DuskBackground, Icon with the board's 34 SVG icons) plus `components/TabBar.tsx`, live in the app. Needed `react-native-svg` + `@react-native-masked-view/masked-view` (dev build `8895e92b`). Checked on the user's phone through a temporary `app/dev-components.tsx` gallery.
- [x] **R.3** Entry: splash (Cradle mark + Playfair wordmark), onboarding welcome, sign up, sign in. Extras: **Name** at sign-up (stored in Supabase `user_metadata`, no migration); **Forgot password** (Supabase password-reset email with a code typed into the app; a deep link was the first idea); **Continue with Apple** — needs an Apple Developer Program membership ($99/yr) even for Android, which conflicts with NFR-601's $0 budget, so it is blocked on the same condition as step 3.7 unless the user decides otherwise. Split into **R.3a** splash + welcome, **R.3b** sign up + sign in, **R.3c** forgot password. Decided 2026-10-17: Welcome is one page with no page dots (only page 1 is designed); the in-app splash shows for at least 3 s (user, after trying 1.2 s), then fades. The Apple button is left out rather than shown disabled, and the sign-up "agree to Terms & Privacy" line waits for step 5.2's documents. The native launch screen stays Android's default until 5.1 (it needs a rebuild and the vector logo). **R.3a done** (2026-10-17): splash on every cold start and again after sign-out (then Welcome), logo glow baked by `scripts/make-brand-glow.js`, Welcome screen; verified on the user's phone. **R.3b done** (2026-10-17): separate `/sign-up` (Name stored as `display_name` in user metadata, 8-character password rule) and `/sign-in` screens replace the combined `/auth`; errors mapped from Supabase error codes and shown under the field they belong to; "Already have an account? Sign In" link under Create Account (user's addition); verified on the user's phone. **R.3c done** (2026-10-18): emailed one-time code (user's choice over a deep link; the live project sends 8 digits, the app accepts 6–10) — `/forgot-password` → `/reset-password` (code + new password), `supabase/templates/recovery.html` (also pasted into the live dashboard), and a `recovering` state that keeps the user on the reset screen until the new password is saved. Verified on the user's phone against the live project: the code arrived from `no-reply@mail.pandidharan.dev`, the password changed, and the user was signed in.
- [x] **R.4** Library and new affirmation: Library as folder cards (recording count + total length per folder, "Good evening, <name>" greeting, create-folder card), Folder Detail (rows show source, voice, length, relative date; floating record button), and the Mode Choice screen (Self-Recorded / AI Guided) as the single entry for a new affirmation. Split and decided 2026-10-18: **R.4a** Library + Mode Choice (they ship together so the new mic button has a destination), **R.4b** Folder Detail (rows with an inline play preview, ⋯ menu for rename/delete) replacing the separate Folders screen. Decisions (user): unfiled recordings get an "Unfiled" card shown only when some exist; Library also gets the glowing mic button (→ Mode Choice), and its header "+" makes a folder like the dashed card; a row's play icon plays a preview in place. Mine: every folder card uses the folder icon (folders have no icon field); the streak stays on Library until R.8 moves it to Goals. **R.4a done** (2026-10-18): Library (gradient title, greeting by sign-up name and time of day, folder cards with count and total length, Unfiled card, dashed create-folder card + name sheet, glowing mic) and Mode Choice (`/new-affirmation`, passes the folder on to the record screens). User's change on the phone: the streak pill is mauve with a soft mauve glow instead of terracotta (DESIGN.md updated); it keeps the 🌱/🌿/🌳 growth stages because FR-602 requires a growth metaphor. Verified on the user's phone. **R.4b done** (2026-10-18): Folder Detail (`app/folder/[id].tsx`): new recording rows (source glyph, "Self-Recorded · 32s · 2 nights ago" / "AI Guided · Nicole · …", length), an in-place preview per row that plays the trimmed range (`hooks/usePreviewPlayer.ts`), total length, ⋯ menu for Rename (folder-name sheet) and Delete, the glowing mic (→ Mode Choice with this folder), and Unfiled at `/folder/unfiled`. The old Folders screen (`app/folders.tsx`) is removed. Verified on the user's phone.
- [x] **R.5** Recording flow: Record (pulsing mic, script shown, "● Recording"), Preview (waveform, title, folder, save/discard/re-record), Trim (big waveform with glowing handles, `TrimEditor` restyle). Split and decided 2026-10-18: **R.5a** Record, **R.5b** Preview (incl. "Trim silence"), **R.5c** Trim, **R.5d** the recording edit screen (`app/affirmation/[id]/trim.tsx`). Decisions (user): **real waveforms** — loudness captured while recording (expo-audio metering) and computed from the WAV for AI Guided audio, stored **on the device only** next to the audio (local SQLite column, no Postgres migration: the audio itself never leaves the device), recordings made before this show a flat line; the edit screen has no mockup, so it **reuses the Preview layout** (title, waveform + playback, folder and Trim chips, AI script section for AI Guided, Delete). **R.5a done** (2026-10-18): Record screen (dusk background, "● Recording"/"Paused", script as a quote, glowing mic whose halo follows the live level, gradient timer, tap to pause/resume, hold to stop, Cancel/Done ✓, restyled permission states); loudness sampled every 100 ms and saved to the device-only `affirmation_waveforms` table. Verified on the user's phone. **R.5b done** (2026-10-18): Preview after Done (title field, `components/PlaybackCard.tsx` waveform card with trim-aware play and ±5 s, folder chip, "Trim silence" via `findSilenceTrim` with a threshold relative to each take, Save recording / Discard / Re-record, confirm before Back discards). User's phone check also asked for smooth motion: waveform progress and the Record halo now animate every frame (Animated, halo on the native driver). Verified on the user's phone. **R.5c done** (2026-10-19): Trim screen (`components/TrimScreen.tsx`, a full-screen modal; Android back cancels) opened from a new "Trim" chip on Preview: kept range in gradient numbers, 60-bar waveform with glowing handles (one touch area grabs the nearer handle, 0.1 s steps, at least 1 s kept, screen-reader adjustable in 0.5 s steps), ruler, "◀ Preview" / "Preview ▶" (3 s inside each handle) and play with a playhead, and a note saying what's cut. A hand-set trim and Trim silence replace each other. Verified on the user's phone. **R.5d done** (2026-10-19): the saved-recording screen moves to `/affirmation/[id]` on the Preview layout (title, PlaybackCard, folder / Trim silence / Trim chips saving as they're changed, AI Guided script + voice + Regenerate, Delete with a confirm); AI Guided waveforms are built from the WAV on first view (`wavLevels`, `getOrBuildWaveform`) and rebuilt after Regenerate; `TrimEditor` removed. Verified on the user's phone. **R.5 complete.**
- [x] **R.6** AI Guided flow: Script (step 1 of 3, word/time estimate, "Redraft" from a goal), Voice Picker (step 2, tap to preview, per-voice descriptions), Generating (step 3, glowing orb, cancel), Generation Error (script kept, try again / back to script). AI Draft screen: extras **Softer / Shorter / More vivid / Try another** refinements **(Edge Function)** and **Save as text only** (stores the draft on the goal, see R.8). Split and decided 2026-10-19: **R.6a** the AI Guided flow (Script → Choose a voice → Generating → Error, replacing `app/record-ai-guided.tsx`), **R.6b** the AI Draft screen and its refinements (Edge Function redeploy). Decisions (user): after generating, the app **opens the new recording** (R.5d's screen: listen, rename, folder, trim), so the flow has no title or folder fields (the title comes from the script's first words; a folder passed in from Mode Choice is kept); a voice preview **reads the first sentence of the user's script**; **Save as text only moves to R.8**, with the goal's linked affirmation. **R.6a done** (2026-10-19): `app/ai-guided/script.tsx` (step dots, Fraunces italic script field, sentence/reading-time/300-character counts, "From your goal" card with Redraft) and `app/ai-guided/voice.tsx` (voice cards with a description each, previews of the first sentence, Generating with the breathing orb and Cancel, Generation Error keeping the script); generation is cancellable (`GenerationCancelledError`), success closes the flow and opens the new recording; `app/record-ai-guided.tsx` removed. Verified on the user's phone. **R.6b done** (2026-10-19): the goal Draft screen follows mockup #15 (goal card, suggestion card with word count and reading time, Softer / Shorter / More vivid / Try another, Edit field, Record this / Use an AI voice); refinements rewrite the Edit field's text, keeping the user's edits (user's choice), via an optional `refine` + `currentText` on `generate-affirmation` (validated, same daily limit; deployed live after a local-stack check). User's request: a shared `typography.script` (Fraunces italic) for every user or AI script, and `TextField variant="script"`. Verified on the user's phone. **R.6 complete** (Save as text only is in R.8).
- [x] **R.7** Player: "Now looping" layout, glowing pause control, quote of the current affirmation, loop counter, restyled ambience picker; fixes the duplicated title and the off-screen "No timer" chip. Uses R.10's default sleep timer. Split and decided 2026-10-20: **R.7a** now playing (mockup #10), **R.7b** the chooser (no mockup). Decisions (user): the chooser shows **folders and single recordings** to tick, with sleep timer, ambience and a glowing Play, and Folder Detail's ⋯ gets **Play this folder**; a session ends by **holding the play button** (tap = pause/resume, as on Record) or ⋯ → End session, or the sleep timer; the loop button **off = play the selection once, then end**; the **back arrow returns to the chooser while audio keeps playing**, with a Now playing card to come back. Until R.10, the timer starts from the last one chosen. **R.7a done** (2026-10-21): now playing, simplified on the user's phone checks: no header or tab bar, a fixed non-scrolling layout, a moon in a soft breathing glow with 33 twinkling stars (`components/MoonSky.tsx`) instead of the affirmation's details, a play/pause with no glow of its own (tap pause, hold end), the waveform with loop count and timer, and loop / ⏱ / End session / ambience; Back and Android's back gesture return to the chooser while it keeps playing; timer and ambience in bottom sheets (`components/ui/Sheet.tsx`), the ambience picker restyled. Also (user): every glow is now mauve (`glowColor()`), and terracotta is gone from the app, replaced by light mauve `#C3AEDA` for selected/on states (DESIGN.md updated). Verified on the user's phone. **R.7b done** (2026-10-21): the chooser (`components/PlayerChooser.tsx`, no mockup, in the Library's style): a gradient "Player" title (the native header is off for good, which also fixes the duplicated title), a highlighted Now playing card, folder cards ticked as a whole (a dash when partly chosen), single recordings, wrapping timer chips (fixes the off-screen "No timer"), the ambience picker and a glowing Play in a bar with what's chosen; Folder Detail's ⋯ gains Play this folder (Unfiled: Play these recordings), which starts it straight away. Also (user): the voice / ambience balance moved onto now playing in place of the waveform, as a new `components/BalanceSlider.tsx` in the app's style, also used in the Ambience sheet; `@react-native-community/slider` removed. Verified on the user's phone. **R.7 complete.**
- [ ] **R.8** Goals: list as a grid of vision cards with Active / Completed / Archived tabs, Add/Edit Goal, Goal Detail, Completed view with its milestone note. Extras **(migration)**: target length (7 / 30 / 90 days / open) and progress ("Day 18 of 30", nights left); **Archived** status; a goal's linked affirmation (text and/or recording, shown on Goal Detail with Play / Edit / Redraft); per-goal **loop count**, which needs playback sessions to record which affirmations played.
- [ ] **R.9** Journal: grouped list with the monthly count, New Entry (date/time header, "Different prompt", "Skip prompt", character count), entry detail. Extra **(migration)**: **attach a recording** to an entry.
- [ ] **R.10** Settings and account: profile header (name, email), bedtime reminder, Natural voices section, privacy rows. Extras: **default sleep timer** and **loop crossfade length** (on-device preferences, like the reminder); **Export all data** (JSON of the user's rows plus their audio files, through the system share sheet); Delete Account as a type-"delete"-to-confirm screen showing the real counts of what will be erased.
- [ ] **R.11** Review: `design:design-critique` and `design:accessibility-review` over every screen, `engineering:code-review` over the redesign diff, full real-device regression pass, then a PR into `develop`.

---

## Phase 5 — Store readiness

Goal: ship. Gate for App Store / Play Store submission.

- [ ] **5.1** Final app icon, splash screen, visual identity.
- [ ] **5.2** Privacy policy written and linked in-app (also restore the sign-up screen's "By continuing you agree to our Terms & Privacy" line from the Velvet Dusk mockup, left out in R.3b) (covers mic use, voice storage, account deletion — [SRS.md §8](SRS.md#8-compliance)).
- [ ] **5.3** Full accessibility audit — `design:accessibility-review` (NFR-401–NFR-403).
- [ ] **5.4** Performance pass: cold start < 2s, app size < 60MB (NFR-101–NFR-103) — `engineering:deploy-checklist`.
- [x] **5.4a** Custom email sender (SMTP) for Supabase Auth, e.g. Resend or Brevo free tier. Supabase's built-in sender only delivers to the project team's own addresses at about 2 emails an hour, so before real users exist, password-reset codes (R.3c) and any sign-up confirmations need it. Free tier keeps NFR-601's $0 budget. **Done early (2026-10-18), during R.3c:** Resend (free tier) on the verified subdomain `mail.pandidharan.dev`, connected as Supabase's custom SMTP, sender `Anthaathi <no-reply@mail.pandidharan.dev>`. The SMTP key lives only in the Supabase dashboard.
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
