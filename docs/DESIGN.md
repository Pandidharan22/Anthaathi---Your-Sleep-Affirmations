# Design reference — Anthaathi

| | |
|---|---|
| **Status** | Current direction chosen 2026-10-17 — not yet applied to the app |
| **Source of truth** | Claude Design canvas "Anthaathi UI Design": https://claude.ai/artifact/VV8H7x3HJ7qS2kcsW8bqmL |
| **Related** | [EXECUTION_PLAN.md](EXECUTION_PLAN.md) "UI/UX redesign (before Phase 5)", [SRS.md](SRS.md) NFR-401–NFR-403 |

The screens themselves live on the canvas, not in this repo. This file records the decisions behind them, so they survive without the canvas and can be checked against the code during the redesign.

## Where things are on the canvas

| Board | What it is |
|---|---|
| **Full App — Velvet Dusk (24 screens)** | **The current direction.** All 24 screens, including the AI Guided flow. |
| Full App — 24 screens (Claude Design) | The earlier warm "Dawn Glow" version. Kept for reference. |
| Foundations, Gradient Exploration | Token swatches and the gradient comparison that led to both palettes. |
| Mood Board, App Open — Splash | Early drafts, superseded by the full-app boards. |

## Direction

Dark-first, and a night that is cool rather than warm, with one small warm accent: "curling up in a warm bedsheet while it's raining and cold outside."

The first version ("Dawn Glow", mauve → terracotta → gold) was found **too warm** by potential users because of the orange. The current version keeps the same layouts but uses only the **Velvet Dusk** gradient, and brings terracotta back only as an accent.

The app is dark-only for now. NFR-403 (light and dark appearance) still stands; the light theme is deferred, not dropped.

## Color tokens

| Token | Hex | Use |
|---|---|---|
| Background | `#1D1622` | Screen background |
| Surface | `#271E2E` | Cards, inputs, small icon buttons |
| Elevated | `#362A3F` | Chips, sheets, second Velvet Dusk stop |
| Border | `#4A3B54` | Unselected outlines, inactive step dots, unplayed waveform |
| Text | `#F7EEE3` | Primary text — warm cream, kept on purpose for a little warmth |
| Text secondary | `#C9BDB0` | Captions, helper text |
| Text muted | `#8B8090` | Timestamps, inactive tab labels |
| Mauve | `#A98FC4` | Actions; third Velvet Dusk stop; the glow color |
| Light mauve | `#C3AEDA` | Accent text and icons; light end of filled controls; **selected/on states** |
| ~~Terracotta~~ | ~~`#E3946E`~~ | **Removed 2026-10-21** (user, R.7a): it didn't suit the theme. Selected/on states now use light mauve — see below |
| Error | `#E07A8A` | Errors, destructive actions (a cool rose, replacing the old rust) |
| Success | `#8FBF9F` | Success states |
| Info | `#8FA3D9` | Informational notes |

**Gradients**

- **Velvet Dusk**: `#1D1622 → #362A3F → #A98FC4`. Full-screen hero surfaces (Splash, Player, Generating, Mode Choice) use it as a mesh: a `#1D1622 → #362A3F` base with soft mauve blobs.
- **Filled controls** (primary button, play, record, progress bar): `linear-gradient(135deg, #A98FC4, #C3AEDA)` with dark `#1D1622` text or icons. They use the light end of the ramp because cream text on mauve fails contrast (see below).
- **Gradient text** (screen titles like "Library"): the same mauve → light mauve.

## Selected and on states

One rule: **mauve means "do something", a flat light mauve `#C3AEDA` means "this is chosen or on"** (`colors.selected`). It is never a gradient, which keeps it apart from the gradient-filled action buttons.

The board drew these in terracotta `#E3946E`. The user removed terracotta from the app on 2026-10-21 (R.7a phone check): it didn't suit the Velvet Dusk theme. Light mauve, already the theme's light end, replaced it everywhere.

It appears as a **fill or border on selected/on states**:

The active tab, selected chips and filters, Settings toggles that are on, the chosen card on Mode Choice and its checkmark, the chosen voice on Voice Picker, the selected goal cover, the current step indicator, the Player's loop and ambience buttons when on (a filled circle with a dark icon), the playing preview button, and the "● Recording" label. (The streak badge was terracotta on the board; the user changed it to the mauve gradient with a soft mauve glow on 2026-10-18, during R.4a.)

## Glows

A soft glow sits around the big round "voice" controls: the mic buttons (Onboarding, Folder Detail, Record, Mode Choice), the play buttons on Preview and Trim, the Player's play/pause and its orb, the Generating orb, the trim handles, and the app icon on Splash. A chosen card (Mode Choice, Choose a voice) gets a faint one under its border.

**Glows are mauve `#A98FC4`**, the bright end of the Velvet Dusk gradient (`glowColor()` / `glows` in `constants/theme.ts`). They were terracotta on the board; the user changed them on 2026-10-21 (R.7a phone check): they liked the glow, not its color.

Not on: text buttons ("Done", "Save recording", "Sign in", "Continue"), small utility icons (back, close, more), or progress bars. **No ring around buttons or round controls** — it was tried and removed; the glow alone carries the warmth. (Borders on selected cards are fine.)

**Glow levels (settled after tuning).** A single layer at about 60–65% opacity reaching about 40px:

| Element | CSS |
|---|---|
| Round controls (mic, play, Mode Choice tile) | `box-shadow: 0 0 36px 4px rgba(169,143,196,0.62)` |
| Generating orb | `box-shadow: 0 0 40px 4px rgba(169,143,196,0.65)` |
| App icon (Splash) | `filter: drop-shadow(0 0 20px rgba(169,143,196,0.62))` |
| Trim handles | `box-shadow: 0 0 14px 2px rgba(169,143,196,0.62)` |
| Light behind Record / Generating controls | radial gradient at 55% |
| Player moon | the Generating orb's glow at 70%, with dim twinkling stars around it; the play/pause has no glow of its own |

For reference: about 45–55% read as no warmth at all, and two layers at 75–90% with 2–2.5× the reach was too much.

## Typography

| Role | Font | Size / weight |
|---|---|---|
| Wordmark "Anthaathi" (Splash only) | Playfair Display | 56px / 800, gradient fill |
| Display | Fraunces | 32px / 700 |
| Title | Fraunces | 24px / 600 |
| Subtitle, card titles | Fraunces | 18px / 600 |
| Taglines, quotes, prompts | Fraunces italic | 16px / 400 |
| Body | Nunito | 16px / 400 |
| Caption | Nunito | 13px / 400 |
| Buttons | Nunito | 15px / 700 |
| Field labels | Nunito | 12px / 600, uppercase |
| Tamil letter அ in the logo | Noto Serif Tamil | — |

All four are Google Fonts. Playfair Display replaced Sinoreta, whose license is personal-use only.

## Shape

Buttons and chips are pills (`999px` radius). Cards use `20px`, inputs `12px`. Round icon buttons are `44px`. Chips are drawn smaller than 44px, so they need extra hit area in code (as step 4.4 did).

## Logo

The mark blends a crescent moon with **அ**, the first letter of "Anthaathi" in Tamil. The current choice is **"Cradle"**: the letter's loop and bowl on the left, the crescent on the right. It replaced "Descender" on 2026-10-17. The user may revisit it.

`assets/brand/anthaathi-mark-cradle.png` is a transparent cutout of the mark (white plus alpha, 638 × 328). The color comes from CSS: the cutout is used as a mask over the mauve gradient, so the same file works in any palette.

It was cut from an AI-generated reference image, so it is a raster image. It is fine for the in-app splash, but too small for store icons (Apple and Google want a 1024 × 1024 master) and should be redrawn as a vector before Phase 5.

## Contrast checks

WCAG ratios behind the choices above (AA needs 4.5:1 for normal text, 3:1 for large text and UI shapes):

| Pair | Ratio | Result |
|---|---|---|
| Dark text on mauve `#A98FC4` | 6.23 | Pass — used on filled controls |
| Dark text on light mauve `#C3AEDA` | 8.73 | Pass |
| Cream text on mauve `#A98FC4` | 2.47 | **Fail** — why filled controls use dark text |
| Light mauve text on surface | 7.92 | Pass |
| Light mauve (selected) border or icon on elevated | 6.66 | Pass |
| Rose error text on surface | 5.58 | Pass (the old rust `#D9614A` was 4.39 — a fail) |
| Light mauve (selected) vs mauve (action) | 1.40 | Too close to tell apart by color alone |
| Light mauve (selected) vs cream text | 1.76 | Too close to tell apart by color alone |

Those last rows matter: every selected state also has a non-color cue (a filled pill with dark text, a border, a wider bar, or a checkmark), so selection never depends on hue. Keep it that way when adding new selected states.

## Not yet applied

The app still uses the older tokens in `constants/theme.ts` (gold primary, separate light and dark sets). Applying this design is the job of the "UI/UX redesign (before Phase 5)" steps in [EXECUTION_PLAN.md](EXECUTION_PLAN.md). Those steps also cover the known issues listed there: header roles, `TextInput` labels, the Player's duplicate title, and the off-screen "No timer" chip.
