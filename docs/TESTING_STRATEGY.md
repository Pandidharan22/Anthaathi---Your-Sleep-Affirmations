# Testing Strategy — Anthaathi

| | |
|---|---|
| **Status** | v0.1 — established at Execution Plan step 0.6, revisited as each phase adds real logic |
| **Last updated** | 2026-09-20 |
| **Related** | [SRS.md NFR-501](SRS.md#55-maintainability), [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) |

## Principle

Test in proportion to risk and blast radius, not for coverage-percentage's own sake (per NFR-501: "sufficient to catch regressions," not a fixed threshold). As a solo-dev, free-tier project, the testing budget goes toward the areas most likely to silently corrupt user data or break the core loop — not toward exhaustively testing framework glue or trivial UI.

## Coverage by layer

| Layer | Test type | What's covered | What's skipped |
|---|---|---|---|
| Pure business logic (streak derivation, data transforms, validation) | Unit (Jest) | Correctness of the logic itself, edge cases (timezone boundaries, empty history, gaps) | N/A — this is exactly where bugs hide silently, full coverage expected |
| Audio session state (record/play/loop/timer state machine) | Unit (Jest) | State transitions, especially interrupted/edge-case transitions (FR-related to §4.2–4.3 in SRS) | Actual native audio I/O — mocked, not tested (no value in re-testing `expo-av` itself) |
| AI-request handling (client side of FR-501–FR-504) | Unit (Jest) | Draft-accept/edit/discard flow, error/degradation states (FR-503) | The Edge Function's own logic — covered separately, see below |
| Supabase RLS policies | Integration (SQL, at the DB level) | Per-user data isolation (NFR-202) — deferred until Phase 1 step 1.1 introduces the schema, tracked there rather than here prematurely | N/A |
| UI components | Component tests (React Native Testing Library) | Critical interaction paths a regression would actually hurt (record button states, player controls, form validation feedback) | Purely presentational components with no logic — not worth a test per line above |
| Full end-to-end device flows | None in v1 | — | Explicitly deferred: Detox/Maestro setup is real effort for a solo dev on a free-tier timeline; revisit before Phase 5 if manual testing during store-readiness proves insufficient |

## Tooling

- **Jest** via the `jest-expo` preset (handles React Native's module resolution/mocking out of the box — the standard, Expo-recommended choice, no reason to hand-roll a custom Jest config).
- **React Native Testing Library** for component tests — tests behavior (what's rendered, what happens on interaction), not implementation detail.
- No separate assertion-matcher library beyond what RNTL ships with current versions.

## What "done" looks like per step

Per `CLAUDE.md` rule 2 (verify before commit), each implementation step in the [Execution Plan](EXECUTION_PLAN.md) that introduces real logic (not just scaffolding) adds tests for that logic as part of the same step — not as a separate catch-up pass. Phase review steps (e.g. 1.9) run `engineering:code-review` partly to catch gaps in this discipline, not to backfill tests wholesale.

## Revisit triggers

- If manual QA before Phase 5 submission repeatedly misses real bugs → reconsider adding Detox/Maestro for the core record → save → play flow specifically (not full E2E coverage).
- If RLS policy bugs occur in practice → formalize the SQL-level integration tests referenced above rather than relying on manual Supabase dashboard checks.
