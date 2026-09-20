# Dev Journal — Anthaathi

One entry per committed step, newest first. Each entry: what was done, why, how it was verified, and the commit it belongs to.

---

## 2026-09-20 — Formal documentation suite (PRD, SRS, System Design, ADRs)

**What**: Replaced `PROJECT_PLAN.md` with a proper engineering documentation set: `docs/PRD.md` (problem statement, goals/non-goals, personas, MoSCoW-scoped v1 feature set, success metrics, risks, open questions), `docs/SRS.md` (functional requirements FR-101–FR-702 and non-functional requirements NFR-101–NFR-601, each traceable to a PRD goal), `docs/SYSTEM_DESIGN.md` (architecture diagram, component breakdown, data model/ERD, API design split between direct-client-to-Supabase and Edge-Function-mediated calls, three key sequence flows, security/privacy model, free-tier scaling analysis, failure modes, and an explicit "what we'd revisit as the system grows" section), and five ADRs in `docs/adr/` covering the mobile framework, backend platform, AI provider strategy, audio storage strategy, and monetization platform decisions — each with a real options-considered trade-off table, not just the chosen answer. Added a root `README.md` as the repo's entry point and doc index. Updated `CLAUDE.md` to point at the new doc set and to reference requirement IDs (FR-/NFR-) going forward instead of freeform feature descriptions.

**Why**: The original `PROJECT_PLAN.md` was a planning sketch, not a spec — no traceable requirements, no documented trade-off reasoning behind technical choices, nothing a fresh session (or a reviewer) could audit against. This establishes requirements and architecture as the source of truth before any code is written, per the project's non-negotiable process rules (`CLAUDE.md` rules 1, 5, 6).

**Verification**: Manually reviewed each doc for internal consistency and cross-reference accuracy. Wrote and ran a Node script to programmatically verify every relative markdown link and anchor reference across all docs resolves to a real file/heading (using a GitHub-slugger-accurate algorithm, since GitHub anchors from headings containing `&` or em dashes produce double hyphens — a common false-positive trap in naive slug checks). Caught and fixed two real cross-reference bugs in the process: `docs/SRS.md` linked to the wrong PRD section number for the "reinforcement loop" reference (was `§3`, should be `§2` — Problem Statement), and `docs/PRD.md` linked to the wrong SRS section number for the security/privacy reference (was `§6.2`, should be `§5.2`). No code exists yet, so no automated test suite applies.

**Commit**: `c3d4a8a` — Add formal PRD, SRS, System Design doc, and ADRs

---

## 2026-09-20 — Project planning & repo setup

**What**: Defined the app concept (self-recorded sleep affirmations + a manifestation/goal layer), chose the name "Anthaathi" and tagline "Where old patterns end, new ones begin.", picked a free-tier-first tech stack (React Native/Expo, Supabase, free-tier LLM API, optional self-hosted TTS), and wrote out a phased roadmap. Initialized the git repo, added a proper `.gitignore` (secrets/env/build artifacts excluded), and set up `CLAUDE.md` (git-ignored, local process rules + running status) and this journal.

**Why**: Establishes the project's direction and non-negotiable engineering process before any code is written, and checked the chosen name against existing trademarks/apps (found and flagged a naming collision with an unrelated company, decided to proceed anyway).

**Verification**: Manual review of `PROJECT_PLAN.md`, `.gitignore`, and `CLAUDE.md` contents for accuracy and completeness. No code yet, so no automated checks apply.

**Commit**: `d29a599` — Initial project setup: plan, gitignore, dev journal
