# System Design — Anthaathi

| | |
|---|---|
| **Status** | Draft — v0.1 |
| **Last updated** | 2026-09-20 |
| **Related** | [PRD.md](PRD.md), [SRS.md](SRS.md), [adr/](adr/) |

## 1. Requirements recap

Full detail in [SRS.md](SRS.md). The requirements that most shape this design:

- Core recording/playback must work fully offline (NFR-301) → **local-first storage**, cloud sync is additive.
- No secrets in the client (NFR-203, FR-504) → **server-side mediation** for anything calling a keyed API.
- Every user can only touch their own data (NFR-202) → **RLS-enforced multi-tenancy** from day one, even as a single-user app today.
- $0/month infra through MVP (NFR-601) → every component choice is checked against a free tier in §8.

## 2. High-level architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Mobile Client (Expo)                       │
│                                                                     │
│  ┌──────────┐ ┌───────────┐ ┌────────┐ ┌───────┐ ┌────────────┐  │
│  │  Auth UI │ │ Recorder / │ │ Library│ │ Player│ │ Goals /    │  │
│  │          │ │ Audio      │ │        │ │       │ │ Vision     │  │
│  │          │ │ Studio     │ │        │ │       │ │ Board      │  │
│  └────┬─────┘ └─────┬──────┘ └───┬────┘ └───┬───┘ └─────┬──────┘  │
│       │             │             │           │            │      │
│       └─────────────┴─────────────┴───────────┴────────────┘      │
│                            │                                       │
│                 Local storage (SQLite/MMKV + filesystem)           │
│                 — recordings live here first, always                │
└────────────────────────────┬────────────────────────────────────┘
                              │ HTTPS (Supabase client SDK)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Supabase (free tier)                     │
│                                                                     │
│  ┌────────────┐  ┌───────────────┐  ┌─────────────────────────┐  │
│  │    Auth    │  │   Postgres     │  │  Storage (audio backup, │  │
│  │            │  │   + RLS        │  │  images)                 │  │
│  └────────────┘  └───────────────┘  └─────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Edge Function: generate-affirmation                       │   │
│  │  (holds LLM API key server-side, never exposed to client)  │   │
│  └───────────────────────┬───────────────────────────────────┘   │
└──────────────────────────┼────────────────────────────────────────┘
                            │ HTTPS
                            ▼
              ┌──────────────────────────┐
              │  LLM provider (Gemini or  │
              │  Groq free tier)          │
              └──────────────────────────┘

  Optional, deferred (see PRD open questions):
  ┌──────────────────────────┐
  │ Self-hosted Piper/Coqui   │  ← Cloud Run / HF Spaces free tier
  │ TTS (synthetic voice mode)│
  └──────────────────────────┘

  Post-MVP:
  ┌──────────────────────────┐
  │ RevenueCat (subscriptions)│  ← App Store / Play billing wrapper
  └──────────────────────────┘
```

**Key architectural decision: local-first.** Recordings are captured and played from on-device storage. Supabase Postgres holds structured data (folders, goals, journal entries, streak state) and *metadata* about recordings; the audio files themselves only reach Supabase Storage if the user opts into cloud backup. This keeps the free-tier storage quota (1GB) from being consumed by every user's raw audio by default, and means the core loop has zero network dependency. Rationale: [ADR-0004](adr/0004-audio-storage-strategy.md).

## 3. Component breakdown

| Component | Responsibility | Runs where |
|---|---|---|
| Auth | Sign up/in/out, session persistence | Client (Supabase Auth SDK) |
| Recorder | Mic capture, waveform preview, trim | Client (expo-av) |
| Audio Studio | Layering ambience/music beds, mixing | Client (expo-av / ffmpeg-kit) |
| Library | Folder/recording CRUD, list/search | Client + Postgres (metadata), local FS (audio) |
| Player | Loop playback, sleep timer, background audio | Client (expo-av, background audio mode) |
| Goals / Vision Board | Goal CRUD, image attachment | Client + Postgres + Storage (images) |
| AI Assist | Goal → affirmation text drafting | Client → Edge Function → LLM provider |
| Journal | Prompted journal entries | Client + Postgres |
| Streaks | Daily-completion tracking, growth visual | Client, derived from local playback-session log + Postgres sync |
| Notifications | Local daily reminder | Client (Expo Notifications, on-device scheduling — no server round-trip needed for v1) |

## 4. Data model

All tables live in Supabase Postgres, scoped by `user_id` with RLS (`auth.uid() = user_id` on every table). This is the *synced metadata* layer — audio bytes live on-device (and optionally in Storage, referenced by `storage_path`).

```
users (managed by Supabase Auth — not a custom table)

folders
  id            uuid PK
  user_id       uuid FK → auth.users
  name          text
  created_at    timestamptz

affirmations
  id              uuid PK
  user_id         uuid FK
  folder_id       uuid FK → folders, nullable
  title           text
  local_uri       text        -- path on device; source of truth for playback
  storage_path    text        -- nullable; set only if user opts into cloud backup
  duration_ms     integer
  created_at      timestamptz

goals
  id            uuid PK
  user_id       uuid FK
  title         text
  description   text
  image_path    text nullable   -- Supabase Storage path
  status        text            -- 'active' | 'achieved'
  created_at    timestamptz
  achieved_at   timestamptz nullable

journal_entries
  id            uuid PK
  user_id       uuid FK
  prompt        text nullable
  body          text
  created_at    timestamptz

playback_sessions
  id            uuid PK
  user_id       uuid FK
  played_at     timestamptz
  duration_ms   integer
  -- one row per completed session; streaks are derived (see §5), not stored as a mutable counter,
  -- so a streak can always be recomputed/audited from source data

ai_generation_log
  id            uuid PK
  user_id       uuid FK
  goal_id       uuid FK → goals, nullable
  prompt_used   text
  result_text   text
  created_at    timestamptz
  -- kept for the user's own history/debugging, not for training anything
```

**Streak derivation**: computed from `playback_sessions` (distinct calendar days with ≥1 session, consecutive from today backward) rather than stored as an incrementable counter. This avoids an entire class of bugs (double-increment, timezone edge cases, drift between stored counter and actual history) at the cost of a lightweight query — acceptable at this scale (NFR-101 budget has ample headroom for it).

## 5. API design

Two call patterns, deliberately kept separate:

**A. Direct client → Supabase** (auth, folders, affirmations metadata, goals, journal, playback_sessions): standard Supabase SDK calls, authorized by RLS. No custom REST layer needed — this is the majority of app traffic and Supabase's generated API covers it.

**B. Client → Edge Function → external provider** (the one case where a secret must stay server-side):

```
POST /functions/v1/generate-affirmation
Auth: Supabase JWT (from signed-in session)
Body: { goalId: string, goalText: string }
Response 200: { draftText: string }
Response 429: { error: "rate_limited" }          → FR-503 graceful degradation
Response 502: { error: "provider_unavailable" }  → FR-503 graceful degradation
```

The Edge Function validates the JWT, applies a per-user rate limit (protecting the shared free-tier LLM quota from any single user, including future abuse), calls the LLM provider with the server-held API key, and returns plain drafted text — never audio, never anything auto-published as the user's affirmation (FR-502).

## 6. Key sequence flows

**Record & save an affirmation (fully offline-capable)**
```
User → Recorder: tap record
Recorder → Mic: capture audio
User → Recorder: stop, trim, confirm
Recorder → Local FS: write audio file
Recorder → Local DB (SQLite, offline-first cache): insert affirmation row
Local DB -- background sync, when online --> Supabase Postgres: upsert metadata row
(No network required for the recording to exist and be playable.)
```

**Goal → AI-drafted affirmation**
```
User → Goals UI: select goal, tap "Draft affirmation"
Client → Edge Function (generate-affirmation): goalId, goalText, JWT
Edge Function → LLM provider: prompt built from goalText
LLM provider → Edge Function: draft text
Edge Function → Client: draftText
Client: show draft, user edits/accepts
User → Recorder: records the (possibly edited) text in their own voice
                  [normal record-and-save flow from here]
```

**Nightly playback with sleep timer**
```
User → Player: select affirmation(s) + folder, set timer
Player → Local FS: stream audio, loop
Player → OS: request background-audio session (continues when locked)
Timer expires → Player: fade out, stop
Player → Local DB: log playback_session (played_at, duration)
Local DB -- background sync --> Postgres: upsert playback_sessions row (streak source of truth)
```

## 7. Security & privacy model

- **RLS on every table**: `user_id = auth.uid()`, no exceptions, verified by test (see testing strategy, Phase 1).
- **Storage buckets**: private by default; signed URLs with short expiry for any client read of a Storage object (goal images, backed-up audio).
- **Secrets**: LLM API key lives only in Supabase Edge Function environment config, never in the Expo bundle, never in git (NFR-203, enforced by `.gitignore`).
- **Voice data**: treated as sensitive personal data throughout — local-first by default (§2), opt-in only for cloud backup, deletable on account deletion (FR-104, NFR-205).
- **Transport**: TLS everywhere (Supabase and Expo defaults; no custom exceptions needed).
- **Mic permission**: requested with a specific, honest rationale string at first-record attempt, not at app launch (NFR-204) — reduces unnecessary permission friction and matches store review expectations.

## 8. Free-tier limits & scaling path

| Service | Free tier ceiling (verify current values before Phase 5 — these change) | What happens at the ceiling |
|---|---|---|
| Supabase | ~500MB DB, ~1GB Storage, ~5GB egress/mo, 50k MAU (Auth) | DB/egress limits are the ones to watch; local-first design keeps Storage usage low. Upgrade path: Supabase Pro ($25/mo) — a monetization-funded expense, not a Phase 0–5 one. |
| LLM provider (Gemini/Groq free tier) | Per-provider RPM/TPM caps, subject to change | Edge Function returns `429` → client shows "try again shortly" (FR-503); feature is non-critical so this never blocks core use |
| Cloud Run (if TTS mode is built) | Generous always-free request/compute quota, scales to zero | Cold-start latency on first request after idle; acceptable for an optional feature |
| Expo/EAS Build | Limited free builds/month | Batch builds deliberately; not a concern at solo-dev iteration speed |

**Scaling path (explicitly out of scope until there's revenue or real multi-user load — noted here so it's not forgotten):** move DB-heavy read paths behind caching, evaluate Supabase Pro, revisit the LLM provider choice if usage patterns exceed free-tier design assumptions, consider a proper CDN for Storage-served images/audio.

## 9. Observability

- **Error tracking**: Sentry free tier (5k events/mo) once the app has real usage — deferred to Phase 1/2, not needed for the scaffold step.
- **Analytics**: none in v1 beyond what's needed for PRD success metrics (crash-free sessions, cold-start time) — avoid instrumenting more than the product needs; revisit if/when there are real external users.
- **Logs**: Supabase's built-in Postgres/Edge Function logs are sufficient at this scale; no separate log aggregation needed yet.

## 10. Failure modes & edge cases

| Scenario | Handling |
|---|---|
| Recording interrupted (call, app killed) mid-record | Partial file discarded, user returned to pre-record state — no corrupt/incomplete affirmation ever saved |
| Network unavailable during save | Local save succeeds (local-first); Postgres sync retried on next connectivity (background sync queue) |
| LLM provider down or rate-limited | FR-503 — clear inline error, core app unaffected |
| Cloud-synced audio conflict (same affirmation edited on two devices) | Out of scope for v1 (single-device usage assumed for MVP); flagged here so it isn't silently ignored if multi-device becomes a real requirement |
| App killed while playing (sleep timer active) | Expo background-audio task should survive backgrounding; if the OS kills the process, playback simply stops — acceptable degradation, no data loss since session log is written incrementally, not only at timer-end |

## 11. What we'd revisit as the system grows

- **Local DB choice**: SQLite via a lightweight ORM is assumed sufficient for v1's data volume (single user, hundreds of rows). Revisit if the app grows multi-device-sync-heavy.
- **Streak computation**: recomputing from `playback_sessions` is fine at this row count; would need a materialized/cached value if the table grows into the tens of thousands of rows per user.
- **Edge Function rate limiting**: a simple per-user counter is enough pre-launch; a real multi-user launch would want a proper rate-limiting layer (e.g. Upstash free tier) in front of the LLM call.
- **Monetization integration**: RevenueCat is deferred entirely (see [ADR-0005](adr/0005-monetization-platform.md)) — not designed into the data model yet beyond leaving room for a future `subscriptions` table.
