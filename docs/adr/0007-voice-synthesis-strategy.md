# ADR-0007: Voice synthesis strategy for AI Guided Sessions

**Status:** Accepted
**Date:** 2026-09-21
**Deciders:** Pandidharan

## Context

The product now includes an **AI Guided Session** mode: affirmation text read aloud in a calm, soothing voice (with a male and a female option) as an alternative to recording it in the user's own voice ([PRD.md §1](../PRD.md#1-summary), [SRS.md §4.6](../SRS.md#46-ai-guided-session-voice-synthesis)). The self-recorded mode's whole architecture is local-first and file-based ([ADR-0004](0004-audio-storage-strategy.md)) — a saved audio file that the existing Player can loop, time with the sleep timer, and layer with ambience (FR-301–FR-304). Whatever generates the AI voice needs to produce that same kind of file, not a one-shot live playback, or it won't fit the rest of the app without special-casing.

Two mechanisms were explored and rejected before reaching the chosen option:

- **`expo-speech` (Expo's JS wrapper around native OS TTS)**: inspected its actual TypeScript definitions directly rather than assuming from prior experience. Its full API surface is `speak()`, `getAvailableVoicesAsync()`, `isSpeakingAsync()`, `stop()`, `pause()`, `resume()` — a live-speech-only interface with no method that returns an audio buffer or writes to a file. Ruled out for this feature.
- **Recording the live TTS playback through the device microphone**: technically possible (`expo-av` recording running concurrently with `expo-speech`), but rejected on audio-quality grounds — the signal has to travel speaker → air → microphone, picking up room noise and speaker/mic distortion, and many devices run acoustic echo cancellation on the mic input specifically to suppress the device's own speaker output, which risks actively degrading the very audio being captured. Quality would also vary significantly by device hardware. Not acceptable for a feature whose entire pitch is a calm, soothing listening experience.

## Decision

Build a small **custom native module** (via Expo's Modules API, not a full eject) that wraps each platform's actual file-synthesis capability:

- **Android**: `TextToSpeech.synthesizeToFile()` — a first-party, one-call API that writes synthesized speech directly to a WAV file.
- **iOS**: `AVSpeechSynthesizer`'s buffer-writing API (`write(_:toBufferCallback:)`, iOS 13+) — delivers PCM buffer chunks that the module assembles into a playable audio file.

Both are unified behind one JS interface: list available voices, synthesize `(text, voiceId) → local file path`. The result is treated exactly like a user's own recording from that point on — same `affirmations` table, same Player, same folders.

## Options Considered

### Option A: Native module wrapping platform file-synthesis APIs (chosen)
| Dimension | Assessment |
|---|---|
| Complexity | Medium — real Kotlin + Swift code, not a config change |
| Cost | $0 forever — no API calls, no hosting, ever |
| Scalability | N/A — runs per-device, no shared infrastructure to scale |
| Team familiarity | N/A; bounded scope (one native module, not a rewrite) |
| Offline capability | Full — no network needed at any point |

**Pros:** genuinely free at any usage volume; works fully offline; produces a real file, so it fits the existing local-first Player architecture with zero special-casing; a well-supported Expo pattern (Expo Modules API), not a full eject — EAS Build and development builds still work normally.
**Cons:** real native code to write and maintain on two platforms; from this point on, testing this specific feature requires a custom development build (`expo-dev-client`/EAS dev build) — plain Expo Go and the web-preview workflow used for the rest of the app can't exercise it, since there's no web implementation of a native TTS-to-file module; voice selection/character is still whatever each user's OS ships (same device-to-device variability as any OS-dependent TTS), not a voice we fully control.

### Option B: `expo-speech` (live playback only)
**Rejected** — confirmed via its actual API surface (not assumption) that it has no file-export capability. Doesn't meet the "generate once, save as a file, reuse forever" requirement at all.

### Option C: Record live TTS playback via microphone
**Rejected** — real, predictable audio-quality degradation (speaker/mic round trip, possible echo-cancellation interference, device-hardware variance). The underlying idea (generate once, save as a file) is correct; this specific mechanism to achieve it is not.

### Option D: Self-hosted Piper/Coqui TTS (cloud) — the path [ADR-0003](0003-ai-provider-strategy.md) originally assumed
| Dimension | Assessment |
|---|---|
| Complexity | Low — an HTTP call from an Edge Function, similar shape to the existing affirmation-drafting flow |
| Cost | $0 on free tier (Cloud Run/HF Spaces), within usage limits |
| Scalability | Bounded by free-tier request limits — acceptable at this project's scale |
| Team familiarity | N/A; no native code required |
| Offline capability | Needs network for the one-time generation only (cached after); none for playback |

**Pros:** no native code at all, stays within the all-JS/Expo workflow used everywhere else; consistent voice quality across every device, since the voice model is controlled centrally rather than left to whatever each OS ships.
**Cons:** a real (if small) hosting component to run; needs connectivity for first-time generation of each script.

## Trade-off Analysis

Once Options B and C were ruled out on hard requirements (file output; audio quality) rather than preference, the real choice was between A (native, on-device) and D (cloud, all-JS). Both are architecturally clean — the deciding factor was the product's explicit preference for a genuinely free, fully offline, on-device solution over a lower-engineering-effort cloud dependency. That preference was stated directly by the person building this and is accepted as the deciding input, with the cost made explicit rather than glossed over: real native code, and a workflow change (dev-client builds required to test this feature) that the rest of the project has not needed until now.

## Consequences

- Becomes easier: the AI Guided feature has zero marginal cost or rate limit at any usage volume, works with no connectivity at all, and reuses the existing Player/Library/folder system without any new playback path.
- Becomes harder: this is the project's first native code (Kotlin + Swift) — a genuine skill/tooling step up from the JS-only work through Phase 0. Verifying this feature can no longer use the fast browser-preview loop the rest of the app uses; needs a real device or emulator running a development build. Voice character/quality is bounded by what each user's OS provides, which is inconsistent across devices — not something this decision can fully control.
- Revisit if: the native module's engineering cost threatens the store-submission timeline (tracked as an explicit risk in [PRD.md §9](../PRD.md#9-risks)) — Option D (self-hosted Piper) is documented above precisely so it's a ready fallback, not a from-scratch decision, if this needs to be descoped.

## Action Items

1. [ ] Set up `expo-dev-client` and an EAS development build profile (prerequisite — nothing else in this ADR can be tested without it)
2. [ ] Build the Android wrapper (Kotlin) around `TextToSpeech.synthesizeToFile()`
3. [ ] Build the iOS wrapper (Swift) around `AVSpeechSynthesizer`'s buffer-writing API, assembling output into a playable file
4. [ ] Unify both behind one Expo Module JS interface: voice listing, `synthesize(text, voiceId) → local file path`
5. [ ] Extend the `affirmations` data model with `source` (`recorded` | `ai_generated`) and `voice_id` fields (see [SYSTEM_DESIGN.md §4](../SYSTEM_DESIGN.md#4-data-model))
6. [ ] Add the corresponding build steps to [Execution Plan](../EXECUTION_PLAN.md) Phase 3
