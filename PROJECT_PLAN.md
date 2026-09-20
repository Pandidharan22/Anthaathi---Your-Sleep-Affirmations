# Anthaathi — Your Sleep Affirmations

**Tagline:** Where old patterns end, new ones begin.

**Name meaning:** Anthaathi (அந்தாதி) is a classical Tamil poetic form where the last word of one verse becomes the first word of the next — an unbroken chain where every ending feeds the next beginning. That's the ritual this app is built around: each night's affirmation practice closes one cycle and opens the next.

Reference/inspiration app: [My Sleep Affirmations](https://anzaro.dk/apps/my-sleep-affirmations) (anzaro.dk) — self-recorded voice affirmations, in-app audio studio, folders/moods, tree-planting give-back. Anthaathi keeps the self-spoken core and adds a manifestation/goal layer on top.

## Core principle
The psychological hook of the reference app is real: your own voice works better than a narrator's for sleep affirmations. Anthaathi keeps that as the foundation and layers in AI *assistance* (drafting affirmation text from stated goals) without replacing the self-spoken narration — AI helps you write what you'll say, it doesn't say it for you (except as an optional, clearly-separate synthetic-voice mode).

## Feature set

### Core (parity with reference app)
- Record affirmations in your own voice
- Loop playback with sleep timer
- In-app trim/layer audio studio (ambience, music beds)
- Folders / moods organization

### Differentiators (manifestation layer)
- Goal → affirmation generator (AI-assisted drafting, user still records it themselves)
- Vision board (images + text goals)
- Streaks + a growing visual metaphor (garden/constellation) instead of real trees until revenue funds a real give-back
- Gratitude / manifestation journal with prompts
- Weekly goal check-ins
- Local reminders to record/listen

### Stretch
- Optional self-hosted synthetic-voice narration (for users who don't want to record themselves) — kept as an explicitly separate mode from the self-spoken core

## Tech stack (free-tier first)

| Layer | Choice | Notes |
|---|---|---|
| App | React Native + Expo | one codebase, free, EAS free build tier |
| Backend/DB | Supabase free tier | Postgres + auth + storage |
| Audio storage | on-device first, optional cloud backup | avoids burning free storage quota on audio files |
| Audio processing | expo-av / ffmpeg-kit | trim/layer/mix |
| AI text | Gemini or Groq free tier, called from a Supabase Edge Function | no API key ships in the client |
| AI voice (optional) | self-hosted Piper/Coqui TTS on Cloud Run free tier or HF Spaces | only for the optional synthetic-voice mode |
| Ambience/music beds | CC0 sources (freesound.org CC0 filter) | cheaper and better quality than generating audio |
| Notifications | Expo Push | free |
| CI/CD | GitHub Actions | free minutes |
| Monetization (later) | RevenueCat | free up to $2.5k/mo tracked revenue, handles iOS/Android billing |

Unavoidable real costs at ship time: Apple Developer Program ($99/yr) for iOS distribution, Google Play one-time $25 registration.

## Roadmap

- **Phase 0 — Foundations**: Expo scaffold, Supabase project, auth, navigation shell, design system/branding
- **Phase 1 — Core parity**: record, loop playback + sleep timer, folders/moods, basic trim
- **Phase 2 — Manifestation features**: vision board, goals, streaks, journal, reminders
- **Phase 3 — AI layer**: goal-to-affirmation generator, optional synthetic-voice narration
- **Phase 4 — Audio studio polish**: layering/mixing, ambience/music beds
- **Phase 5 — Store readiness**: icons, screenshots, privacy policy, EAS build, TestFlight/internal testing, submission
- **Phase 6 — Monetization**: RevenueCat subscriptions; real give-back mechanic once revenue exists

## Open items to revisit
- Final app icon / visual identity
- Privacy policy (required — app handles voice recordings)
- Whether synthetic-voice mode ships in v1 or as a fast-follow
