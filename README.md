# Anthaathi — Your Sleep Affirmations

> Where old patterns end, new ones begin.

Anthaathi is a mobile app for sleep affirmations, offering two modes — **Self-Recorded** (your own voice, looped to fall asleep to) and **AI Guided** (the same text narrated in a calm, on-device synthesized voice, male or female) — extended with a manifestation and goal-tracking layer (vision boards, AI-assisted affirmation drafting, streaks, journaling). Built on a free-tier-first stack.

The name comes from the classical Tamil poetic form *Anthaathi* (அந்தாதி), where the last word of one verse becomes the first word of the next — an unbroken chain where every ending feeds the next beginning.

## Status

Phase 0 (Foundations) complete; Phase 1 (Core Parity) starting next. See [`CLAUDE.md`](CLAUDE.md) (local, git-ignored) for live status, or [`Dev_Journal.md`](Dev_Journal.md) for the committed history of what's been built and why.

## Documentation

| Doc | Purpose |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Product Requirements — problem, users, scope, success metrics |
| [docs/SRS.md](docs/SRS.md) | Software Requirements Specification — functional & non-functional requirements |
| [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) | Architecture, data model, API design, sequence flows, security model |
| [docs/adr/](docs/adr/) | Architecture Decision Records — the "why" behind each major technical choice |
| [docs/EXECUTION_PLAN.md](docs/EXECUTION_PLAN.md) | The build order — phases and steps, checked off as work lands |
| [Dev_Journal.md](Dev_Journal.md) | Chronological log of completed work, one entry per commit |

## Stack (v1)

- **Client**: React Native + Expo (TypeScript)
- **Backend**: Supabase (Postgres, Auth, Storage, Edge Functions) — free tier
- **AI text**: Gemini / Groq free-tier API, called server-side from an Edge Function
- **AI voice**: on-device synthesis to a file, no cloud TTS: Kokoro neural voices via sherpa-onnx (optional one-time model download), with the phone's own TTS as fallback — [ADR-0007](docs/adr/0007-voice-synthesis-strategy.md), [ADR-0008](docs/adr/0008-on-device-neural-voices.md)
- **Monetization**: RevenueCat (deferred to post-MVP)

Full rationale in [docs/adr/](docs/adr/).

## Local development

Setup instructions will be added once the app is scaffolded (see `Dev_Journal.md` for progress).

## License

Anthaathi is free software, licensed under the **GNU General Public License v3.0 or later** — see [LICENSE](LICENSE). You may use, study, modify and redistribute it, including commercially, provided anything you distribute stays under the same license with its complete source available.

Why GPL: the AI Guided "natural voices" run Kokoro on-device through [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx), whose Android library statically includes [espeak-ng](https://github.com/espeak-ng/espeak-ng) (GPL-3.0-or-later) to pronounce words missing from Kokoro's dictionary. Removing espeak-ng was tested and made such words (plurals, names, numbers) go silent, so voice quality was chosen over keeping the app closed-source.

Third-party components keep their own licenses:

| Component | How it's used | License |
|---|---|---|
| sherpa-onnx (+ onnxruntime) | Android native library, fetched at build time | Apache-2.0 (onnxruntime: MIT) |
| espeak-ng | Statically linked inside sherpa-onnx | GPL-3.0-or-later |
| Kokoro-82M v1.0 model | Downloaded by the app on demand, not bundled | Apache-2.0 |
| Ambience beds | Bundled audio, see [assets/beds/README.md](assets/beds/README.md) | CC0 |
| React Native, Expo, Supabase client and other npm dependencies | App runtime | Their own (mostly MIT / Apache-2.0) |
