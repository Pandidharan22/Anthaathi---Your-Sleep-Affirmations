# Product Requirements Document — Anthaathi

| | |
|---|---|
| **Status** | Draft — v0.1 |
| **Owner** | Pandidharan |
| **Last updated** | 2026-09-20 |
| **Related** | [SRS.md](SRS.md), [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md), [adr/](adr/) |

## 1. Summary

Anthaathi is a mobile app for recording and replaying self-spoken sleep affirmations, extended with a manifestation/goal-tracking layer. It targets people who already practice affirmations or want to start, and who believe (as the product does) that hearing a goal stated in your own voice, nightly, is a more effective habit-formation tool than a narrated meditation track.

Alongside self-recorded affirmations, the app also offers an **AI Guided Session** mode — the same affirmation text read aloud in a calm, soothing voice (male/female choice), for users who don't want to record themselves. This is generated once per script and saved on-device, not streamed live — see [ADR-0007](adr/0007-voice-synthesis-strategy.md).

The product is being built solo, on a free-tier-only budget, with two explicit outcomes: (1) a daily-use app for the author, and (2) a portfolio-quality, eventually monetized release.

## 2. Problem statement

People who want to build a consistent affirmation/visualization practice run into three recurring failures:

1. **No easy way to record, organize, and loop their own voice.** Voice-memo apps aren't built for nightly looped playback with a sleep timer, and narrated meditation apps use someone else's voice, which the self-spoken-affirmation research and user testimonials (see reference app review data) suggest is less effective for self-concept change.
2. **The affirmation practice is disconnected from actual goals.** Generic affirmation content doesn't map to what the person is specifically trying to achieve, so the practice feels vague and is easy to abandon.
3. **No reinforcement loop.** Without visible progress (streaks, a goal board, journaling), the habit has no scaffolding and decays within weeks — the single biggest failure mode for any habit-based app.

## 3. Goals

- **G1**: Ship a working, daily-usable self-spoken affirmation app (record, organize, loop-play) that matches the core loop of the reference app.
- **G2**: Add a goal/manifestation layer (vision board, goal-to-affirmation AI drafting, streaks, journaling) that the reference app does not have, as the product's differentiator.
- **G3**: Build and operate the entire v1 on free-tier infrastructure — no paid services until there is subscription revenue to justify them.
- **G4**: Produce a portfolio-quality codebase and documentation set demonstrating professional product/engineering process (this doc set, ADRs, tests, CI).
- **G5**: Reach a state where the app can be submitted to the App Store and Google Play.

## 4. Non-goals (v1)

- Social features (sharing affirmations, following other users, community feed) — out of scope; this is a private, personal-use tool.
- Real-world tree planting or any funded give-back mechanic — deferred until there's subscription revenue to fund it honestly (see [ADR-0005](adr/0005-monetization-platform.md)).
- Multi-language UI — English only for v1.
- Android tablet / iPad-optimized layouts — phone-first only.
- Offline AI generation — the AI-assisted affirmation drafting feature requires connectivity.

## 5. Target users

**Primary persona — "The Practicing Manifestor"**
Already affirms or journals in some form (an app, a notebook, a voice memo habit). Wants a nightly practice that's specific to their actual goals, not generic wellness content. Values privacy of their own voice recordings. Comfortable with a phone-first app; not necessarily technical.

**Secondary persona — "The Curious Beginner"**
Heard about affirmations/manifestation, hasn't built a habit. Needs low-friction onboarding (AI-assisted drafting lowers the "what do I even say" barrier) and visible reinforcement (streaks) to stay engaged past week one.

## 6. Scope — v1 (MVP)

Prioritized MoSCoW. Full functional detail in [SRS.md](SRS.md).

**Must have**
- Record, save, and organize self-spoken affirmations into folders
- Loop playback with a sleep timer
- Basic trim on recordings
- Vision board (text + image goals)
- Goal → affirmation AI draft generation
- Streak tracking
- Account + cross-device sync (auth via Supabase)

**Should have**
- Ambience/music-bed layering in the audio studio
- Manifestation journal with prompts
- Local reminders/notifications
- AI Guided Session mode: on-device text-to-speech narration of affirmation text, male/female voice choice, generated once and saved locally (see [ADR-0007](adr/0007-voice-synthesis-strategy.md))

**Could have**
- Weekly goal check-in nudges

**Won't have (v1)**
- Subscriptions/paywall (v1 ships fully free; monetization is a post-MVP phase)
- Real tree-planting give-back

## 7. Success metrics

Since v1's primary user is the author, "success" is defined in build and personal-usage terms first, with store-readiness metrics as the release gate:

| Metric | Target |
|---|---|
| Personal nightly usage | Used by the author ≥ 5 nights/week for 2 consecutive weeks post-launch |
| Crash-free sessions | ≥ 99% (measured via free-tier error tracking once instrumented) |
| Cold start time | < 2s on a mid-range Android device |
| App size | < 60MB (avoid store-visibility penalties and slow installs) |
| Store submission | Passes App Store + Play Store review on first or second attempt |

Post-launch (not v1-blocking): install count, D7 retention, streak-length distribution — instrumented once there's an actual user base beyond the author.

## 8. Constraints & assumptions

- **Budget**: $0 through MVP, aside from unavoidable one-time/annual store fees at submission time (Apple $99/yr, Google $25 one-time).
- **Team**: solo developer (the author), assisted by Claude Code.
- **Free-tier ceilings** (Supabase, LLM APIs, Cloud Run) are assumed sufficient for personal + early-portfolio-demo usage; they are not assumed sufficient at any meaningful scale. Revisit before any public marketing push — see [SYSTEM_DESIGN.md §8](SYSTEM_DESIGN.md#8-free-tier-limits--scaling-path).
- **Voice recordings are sensitive personal data.** Product and technical decisions default to the more private option unless there's a clear reason not to (see [SRS.md §5.2](SRS.md#52-security--privacy)).
- **AI Guided Session requires a custom development build.** The native TTS-to-file module means the app can no longer be tested via plain Expo Go or the web-preview workflow once that module exists — verification of this specific feature requires an `expo-dev-client`/EAS development build on a real device or emulator (see [ADR-0007](adr/0007-voice-synthesis-strategy.md)).

## 9. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Free-tier LLM/TTS rate limits interrupt the AI-assist feature | Medium | Low (feature is non-critical to core loop) | Design AI-assist as fully optional; core recording/playback never depends on it |
| Solo-dev scope creep delays store submission | High | Medium | Strict MoSCoW scope, phased roadmap, no phase skipping |
| App Store rejects app handling of microphone/voice data without clear privacy disclosure | Medium | High (blocks launch) | Privacy policy + explicit mic-permission rationale written before Phase 5 submission |
| "Anthaathi" name collision with existing company (anthaathi.com) causes store/SEO confusion | Low–Medium | Medium | Accepted risk (see naming discussion in Dev_Journal); revisit if it becomes a real conflict post-launch |
| Native TTS-to-file module (Kotlin + Swift) takes longer than a JS-only feature would, risking G5's timeline | Medium | Medium | Built as an isolated module behind a clean JS interface so it can be descoped to a fast-follow without blocking the rest of Phase 3 if it overruns |

## 10. Open questions

- Exact subscription pricing/tiering — deferred to Phase 6, not blocking MVP.

**Resolved**: the AI Guided Session (TTS) voice strategy was an open question as of the original draft. Decided: native on-device synthesis-to-file (not a cloud TTS call, not live-only OS speech) — see [ADR-0007](adr/0007-voice-synthesis-strategy.md). This means the feature requires real native code and a custom development-build workflow (`expo-dev-client`), which is a genuine scope/effort trade-off accepted deliberately — tracked as a risk in §9.
