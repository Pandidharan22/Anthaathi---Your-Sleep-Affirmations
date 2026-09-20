# Anthaathi — Your Sleep Affirmations

> Where old patterns end, new ones begin.

Anthaathi is a mobile app for self-recorded sleep affirmations — record affirmations in your own voice, loop them to fall asleep to — extended with a manifestation and goal-tracking layer (vision boards, AI-assisted affirmation drafting, streaks, journaling). Built on a free-tier-first stack.

The name comes from the classical Tamil poetic form *Anthaathi* (அந்தாதி), where the last word of one verse becomes the first word of the next — an unbroken chain where every ending feeds the next beginning.

## Status

Pre-development. See [`CLAUDE.md`](CLAUDE.md) (local, git-ignored) for live status, or [`Dev_Journal.md`](Dev_Journal.md) for the committed history of what's been built and why.

## Documentation

| Doc | Purpose |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Product Requirements — problem, users, scope, success metrics |
| [docs/SRS.md](docs/SRS.md) | Software Requirements Specification — functional & non-functional requirements |
| [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) | Architecture, data model, API design, sequence flows, security model |
| [docs/adr/](docs/adr/) | Architecture Decision Records — the "why" behind each major technical choice |
| [Dev_Journal.md](Dev_Journal.md) | Chronological log of completed work, one entry per commit |

## Stack (v1)

- **Client**: React Native + Expo (TypeScript)
- **Backend**: Supabase (Postgres, Auth, Storage, Edge Functions) — free tier
- **AI text**: Gemini / Groq free-tier API, called server-side from an Edge Function
- **AI voice (optional)**: self-hosted Piper/Coqui TTS
- **Monetization**: RevenueCat (deferred to post-MVP)

Full rationale in [docs/adr/](docs/adr/).

## Local development

Setup instructions will be added once the app is scaffolded (see `Dev_Journal.md` for progress).
