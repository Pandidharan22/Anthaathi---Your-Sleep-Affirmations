# ADR-0008: On-device neural voices (Kokoro via sherpa-onnx) for AI Guided Sessions

**Status:** Accepted
**Date:** 2026-10-10
**Deciders:** Pandidharan
**Partly supersedes:** [ADR-0007](0007-voice-synthesis-strategy.md) (the choice of voice engine only)

## Context

[ADR-0007](0007-voice-synthesis-strategy.md) chose a native module that synthesizes speech to a local file with the phone's own TTS engine (Android `TextToSpeech.synthesizeToFile`). That architecture works: an AI Guided affirmation is a normal audio file in the Library and Player (FR-515), made offline at no cost (FR-513). ADR-0007 also predicted its weak point, which turned out to be the deciding one: the voice's character is whatever the OS ships.

On the user's phone the system voices read flat and fast. Step 3.12 tuned what the API exposes (per-voice rate and pitch, per-sentence pauses, a gap between Player tracks). The user's verdict was "way better but still not calm or soothing." For an app whose AI Guided mode exists to sound like a calm narrator at bedtime, that's a product failure, and it's a ceiling of the platform voices, not something more tuning fixes.

Constraints carried over unchanged: $0 budget (NFR-601), offline after setup, no cloud TTS (FR-513), audio as a file that the Player treats like a recording (FR-515), app package under 60 MB (NFR-103), and Android only for now (step 3.7 deferred).

## Decision

Add **Kokoro-82M v1.0** (full precision) as the primary AI Guided voice engine, running on-device through **sherpa-onnx**, behind our own thin Expo module `modules/anthaathi-neural-tts`. The Android system voices stay as the fallback.

- **Voices**: Nicole and Bella (female), Michael and Echo (male), picked by ear by the user. Nicole and Michael are the defaults. Voice ids are `kokoro:<speaker>` in the existing `affirmations.voice_id` column, so there was no migration.
- **Model delivery**: not bundled. The user downloads it from Settings ("Natural voices", ~350 MB), from sherpa-onnx's own GitHub release, verified against a pinned SHA-256 before extraction. The app checks for ~800 MB free space first, blocks the download when offline, and asks before using mobile data. Mirroring the file to our own release is deferred.
- **Runtime**: the model loads on demand (~2 s) and unloads after 60 s idle, since it holds several hundred MB of RAM. Synthesis runs at about 0.5-0.6x real time on the user's phone.
- **Pacing**: each phrase is synthesized separately and joined with exact silences: 1.8 s after a sentence, 0.5 s at a comma or a `/` mark. AI drafts include `/` marks, and the script fields explain them.
- **Fallback**: the system voices remain as "Basic female" and "Basic male", always available. Natural voices are disabled in the picker until downloaded. A natural-voice affirmation whose model was later removed fails with a specific message pointing to Settings (FR-516), and its existing audio file keeps playing.
- **Native library**: the official `sherpa-onnx-static-link-onnxruntime` AAR (1.13.8), fetched by Gradle at build time and checked against a pinned SHA-256. Only `classes.jar` and the arm64-v8a library are used.
- **Licence**: sherpa-onnx's Android library statically includes espeak-ng (GPL-3.0-or-later), which Kokoro uses to pronounce words missing from its dictionary. The project is therefore licensed **GPL-3.0-or-later**.

Unchanged from ADR-0007: the native-module approach, generate once and cache (FR-514), and one Library/Player path for every affirmation.

## Options Considered

### Option A: Keep the tuned Android system voices (ADR-0007 as built)
| Dimension | Assessment |
|---|---|
| Complexity | Already built |
| Cost | $0, no download, no APK growth |
| Quality | Rejected by the user after tuning: not calm or soothing |
| Device variance | High: voices differ by phone and OS vendor |

**Pros:** nothing to download, small, already verified. **Cons:** fails the product's core requirement for this mode, and there's no further API lever to pull.

### Option B: Kokoro v1.0 full precision, on-device, own module around the official sherpa-onnx AAR (chosen)
| Dimension | Assessment |
|---|---|
| Complexity | Medium: a second native module, model lifecycle (download, verify, extract, load, unload) |
| Cost | $0; one-off ~350 MB download per device |
| Quality | Judged good by the user on their phone, with the phrase pacing |
| Device variance | Low: the same model and voices on every phone |
| App size | +~24 MB arm64 native library against NFR-103's 60 MB |

**Pros:** a consistent, calm voice on every device, still offline and free after setup, no server component. **Cons:** a large one-off download and storage cost, RAM use while generating, slower generation than system TTS, the GPL licence, and a dependency on sherpa-onnx's release staying available (pinned checksum makes a change fail safely, not silently).

### Option C: The `react-native-sherpa-onnx` community package
**Rejected.** Reading its source showed it ships FFmpeg, libarchive, MMKV, Play Asset Delivery and a custom onnxruntime from a personal Maven repository, needs a CMake build and two extra native peer packages, and was built against React Native 0.83 (we're on 0.86). That's too much supply-chain and size risk for one TTS call. Our own module wraps one AAR and a handful of methods.

### Option D: Smaller Kokoro builds (int8 / Q8 / F16)
**Rejected.** int8 and Q8 were ruled out by the user on quality. An F16 conversion was tried properly: it crashed ONNX Runtime's default graph optimizer, and ORT's CPU backend lacked F16 kernels, so it would have cast back to F32 anyway. The only gain would have been a smaller download.

### Option E: Kokoro without espeak-ng (to avoid the GPL)
**Rejected.** sherpa-onnx has no build switch to drop espeak-ng. Simulating an espeak-free build on affirmation-style sentences made every word missing from the dictionary go silent: plurals ("opportunities"), inflections, contractions, names and numbers. Working around that (a patched native build, number normalization, a derived extra lexicon) would still leave names weak. The user chose quality and the GPL; the repository was already public, and the GPL still allows selling the app.

### Option F: Cloud TTS (self-hosted Piper/Coqui, as in ADR-0007's Option D)
**Not pursued.** It breaks offline generation and adds a hosted service to run for free. On-device neural synthesis gives the voice quality without either cost. Piper as an on-device engine wasn't compared side by side; Kokoro's voices met the bar on the first listening pass.

## Trade-off Analysis

The decision trades size, RAM and a licence obligation for voice quality, which is the whole point of the mode. The costs were made opt-in or bounded rather than imposed: the model is a user-initiated download (nobody who records only in their own voice pays for it), memory is held only while generating, and the system voices remain so the feature never depends on a 350 MB download to work at all. Keeping our own small module instead of a broad community package keeps the native surface we're responsible for small and fully pinned.

## Consequences

- **Easier**: AI Guided sounds the same, and calm, on every Android phone. Pacing is controlled precisely by us, not the OS engine.
- **Harder**: two engines to maintain behind one picker; model lifecycle code (download, checksum, extraction, idle unload) with failure paths to keep clean; generation is slower than system TTS; the release APK carries ~24 MB of native code against the 60 MB budget, to be measured properly in step 5.4.
- **Licence**: the app and all its source are GPL-3.0-or-later. Anyone distributing it must provide source. Any future closed-source component would need a separate decision.
- **Revisit if**: the release APK breaks NFR-103 (consider Play Feature Delivery for the native library); sherpa-onnx's release URL changes (mirror the pinned file to our own release); iOS work starts (step 3.7, sherpa-onnx has an iOS build, so the same model and voices can carry over); or a smaller model reaches comparable quality.

## Action Items

1. [x] Spike Kokoro on-device and pick voices and pacing by ear (step 3.13a)
2. [x] Verify the model download by checksum; ship arm64 only (3.13b-1)
3. [x] Model management: space and network checks, cleanup, load/unload lifecycle (3.13b-2)
4. [x] Settings: download, progress, removal (3.13b-3)
5. [x] Natural voices in the AI Guided picker, with the system-voice fallback (3.13b-4)
6. [x] `/` pause marks in AI drafts and a hint on script fields (3.13b-5)
7. [ ] Measure the release APK against NFR-103 (step 5.4)
8. [ ] Mirror the model to our own GitHub release (deferred)
