# Software Requirements Specification — Anthaathi

| | |
|---|---|
| **Status** | Draft — v0.1 |
| **Last updated** | 2026-09-20 |
| **Related** | [PRD.md](PRD.md), [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) |

Requirement IDs are stable identifiers — once assigned, don't renumber; deprecate instead (mark `[DEPRECATED]`) so history stays traceable through commits and ADRs.

## 1. Purpose & scope

This document specifies the functional and non-functional requirements for Anthaathi v1 (MVP), as scoped in [PRD.md §6](PRD.md#6-scope--v1-mvp). It does not cover implementation details (data schemas, API contracts, component design) — those live in [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md).

## 2. Definitions

| Term | Meaning |
|---|---|
| Affirmation | A user-recorded audio clip of spoken affirmation content |
| Session | A single nightly playback of one or more affirmations, bounded by the sleep timer |
| Vision board item | A text and/or image representation of a goal |
| Streak | Consecutive-day count of at least one affirmation playback session |
| Edge Function | Server-side function (Supabase) that executes logic the client must not perform directly (e.g. calls requiring a secret API key) |

## 3. Overall description

### 3.1 Product perspective
Anthaathi is a standalone mobile app (not a companion to any other product). It depends on external services (Supabase, an LLM provider) but has no dependency on the reference app (anzaro.dk) beyond initial product inspiration.

### 3.2 User classes
- **Authenticated user**: the only user class in v1. No anonymous/guest mode, no admin UI (operational tasks are done directly against Supabase for a single-operator app at this stage).

### 3.3 Operating environment
- iOS 16+ and Android 10+ (Expo-supported range at time of writing; confirm against current Expo SDK support table before Phase 5 submission)
- Portrait orientation only, phone form factor

### 3.4 Design & implementation constraints
- Free-tier infrastructure only through MVP (binds every requirement below — see [PRD.md §8](PRD.md#8-constraints--assumptions))
- No secrets in client code; anything requiring an API key not safe to ship client-side must go through an Edge Function ([ADR-0003](adr/0003-ai-provider-strategy.md))
- The AI Guided Session feature (§4.6) requires a native module and therefore a custom development build (`expo-dev-client`/EAS) — it cannot be verified via plain Expo Go or the web-preview workflow used for the rest of the app ([ADR-0007](adr/0007-voice-synthesis-strategy.md))

## 4. Functional requirements

### 4.1 Authentication
- **FR-101**: The system shall allow a user to create an account via email + password.
- **FR-102**: The system shall allow a user to sign in and remain signed in across app restarts (persisted session).
- **FR-103**: The system shall allow a user to sign out, clearing any locally cached session data.
- **FR-104**: The system shall allow a user to delete their account and all associated data (recordings, goals, journal entries) — required for store privacy compliance.

### 4.2 Affirmation recording & library
- **FR-201**: The system shall allow a user to record an audio affirmation using the device microphone.
- **FR-202**: The system shall allow a user to play back, re-record, or discard a recording before saving it.
- **FR-203**: The system shall allow a user to trim the start/end of a recording.
- **FR-204**: The system shall allow a user to save a recording with a title and assign it to a folder.
- **FR-205**: The system shall allow a user to create, rename, and delete folders.
- **FR-206**: The system shall allow a user to delete a saved recording.
- **FR-207**: The system shall store recordings on-device by default; cloud backup/sync is opt-in (see [ADR-0004](adr/0004-audio-storage-strategy.md)).

### 4.3 Playback
- **FR-301**: The system shall play one or more selected affirmations in a loop.
- **FR-302**: The system shall allow a user to set a sleep timer that stops playback after a chosen duration.
- **FR-303**: The system shall continue playback when the app is backgrounded or the device is locked.
- **FR-304**: The system shall allow background ambience/music-bed audio to be layered under affirmation playback (Should-have — [PRD.md §6](PRD.md#6-scope--v1-mvp)).

### 4.4 Goals & vision board
- **FR-401**: The system shall allow a user to create a goal entry with a text description and an optional image.
- **FR-402**: The system shall display a user's goals as a vision board (grid/list view).
- **FR-403**: The system shall allow a user to edit or delete a goal entry.
- **FR-404**: The system shall allow a user to mark a goal as achieved, retaining it in a completed-goals view rather than deleting it.

### 4.5 AI-assisted affirmation drafting
- **FR-501**: The system shall allow a user to select a goal and request AI-drafted affirmation text based on it.
- **FR-502**: The system shall present the drafted text for the user to accept, edit, or discard before recording — the system shall never auto-generate a spoken affirmation without the user recording it themselves in their own voice (product principle, [PRD.md §1](PRD.md#1-summary)).
- **FR-503**: The system shall degrade gracefully (clear error state, no crash) if the AI provider is unavailable or a free-tier rate limit is hit.
- **FR-504**: The AI drafting request shall be routed through a server-side function; no LLM API key shall be present in the client bundle.

### 4.6 AI Guided Session (voice synthesis)
- **FR-511**: The system shall allow a user to choose, per affirmation, between Self-Recorded (their own voice) and AI Guided (synthesized voice) modes.
- **FR-512**: The system shall offer at least one male and one female voice option for AI Guided sessions.
- **FR-513**: The system shall synthesize affirmation text to a local audio file on-device — never via a cloud TTS call — per [ADR-0007](adr/0007-voice-synthesis-strategy.md).
- **FR-514**: The system shall cache the synthesized audio file after first generation and reuse it on subsequent playbacks, re-synthesizing only if the text or selected voice changes.
- **FR-515**: An AI Guided affirmation shall integrate with the same Library, folder, Player, and ambience-layering experience as a self-recorded one (FR-204–FR-206, FR-301–FR-304) — no separate playback path.
- **FR-516**: The system shall degrade gracefully (clear error state, no crash) if on-device voice synthesis fails, without affecting the rest of the app.

### 4.7 Streaks & journaling
- **FR-601**: The system shall track a daily streak counter, incremented once per calendar day on which the user completes at least one playback session.
- **FR-602**: The system shall display the current streak and a visual growth metaphor (per [PRD.md §2](PRD.md#2-problem-statement), reinforcement loop).
- **FR-603**: The system shall allow a user to create a journal entry, optionally against a daily prompt.
- **FR-604**: The system shall allow a user to view past journal entries chronologically.

### 4.8 Notifications
- **FR-701**: The system shall allow a user to opt in to a daily local reminder notification at a user-chosen time.
- **FR-702**: The system shall allow a user to disable reminders at any time.

## 5. Non-functional requirements

### 5.1 Performance
- **NFR-101**: Cold app start shall complete in under 2 seconds on a mid-range Android device (e.g. Snapdragon 6-series class, 4GB RAM).
- **NFR-102**: Audio recording start latency (tap-to-record-active) shall be under 300ms.
- **NFR-103**: App package size shall stay under 60MB.

### 5.2 Security & privacy
- **NFR-201**: Voice recordings shall be stored on-device by default; any cloud sync shall be opt-in and encrypted in transit (TLS).
- **NFR-202**: All database access shall be governed by row-level security — a user shall only ever be able to read/write their own data.
- **NFR-203**: No API keys, credentials, or secrets shall exist in client-side code or be committed to version control (enforced by `.gitignore` + code review; see [CLAUDE.md](../CLAUDE.md) rule 4).
- **NFR-204**: The system shall request microphone permission with a clear, specific rationale string, and shall function (minus recording) without indefinite permission-nagging if denied.
- **NFR-205**: Account deletion (FR-104) shall remove all user data within 30 days, in line with standard app-store data-deletion expectations.

### 5.3 Reliability & availability
- **NFR-301**: Core recording/playback functionality shall not depend on any external service being available (works fully offline once a recording exists locally).
- **NFR-302**: AI-assist and cloud-sync features shall fail independently without affecting core functionality (see FR-503).

### 5.4 Usability & accessibility
- **NFR-401**: All interactive elements shall meet a minimum 44x44pt touch target (platform HIG / Material guidance).
- **NFR-402**: Text shall meet WCAG 2.1 AA contrast minimums against its background in both light and dark mode — audited via `design:accessibility-review` before Phase 5.
- **NFR-403**: The app shall support both light and dark appearance, matching system setting by default.

### 5.5 Maintainability
- **NFR-501**: The codebase shall maintain automated test coverage on business logic (audio session state, streak calculation, AI-request handling) sufficient to catch regressions — exact thresholds set in the testing strategy produced via `engineering:testing-strategy` during Phase 1.
- **NFR-502**: Every non-trivial architectural decision shall be recorded as an ADR before implementation begins (see [adr/](adr/)).

### 5.6 Cost
- **NFR-601**: Infrastructure cost shall remain $0/month through MVP (Phases 0–5); any decision that would introduce a recurring cost requires an explicit ADR justifying the exception.

## 6. External interface requirements

| Interface | Direction | Notes |
|---|---|---|
| Supabase (Postgres, Auth, Storage) | Client ↔ Supabase | Direct client SDK calls, gated by RLS |
| Supabase Edge Functions | Client → Edge Function → LLM provider | Used for anything requiring a secret key (AI drafting) |
| LLM provider (Gemini or Groq) | Edge Function → provider | Server-side only, never called from client |
| Expo Push service | Client ↔ Expo | Local notifications for v1 (FR-701); remote push not required for MVP |
| Device OS TTS engine (Android `TextToSpeech`, iOS `AVSpeechSynthesizer`) | Client (native module) → OS | On-device only, no network; see [ADR-0007](adr/0007-voice-synthesis-strategy.md) |
| App Store / Google Play | Build/submission | EAS Build + store submission tooling |

## 7. Data requirements (high level)

Entities requiring persistence: user profile, folders, affirmation recordings (metadata; audio blobs live in device storage or Supabase Storage if synced), goals/vision-board items, journal entries, streak state. Full schema and relationships: [SYSTEM_DESIGN.md §4](SYSTEM_DESIGN.md#4-data-model).

## 8. Compliance

- A privacy policy covering microphone use, voice-recording storage, and account deletion is required before store submission (Phase 5 gate — tracked in [CLAUDE.md](../CLAUDE.md) current status).
- App does not knowingly target or collect data from children under 13; no COPPA-specific handling implemented in v1 (assumption to revisit if audience data suggests otherwise).
