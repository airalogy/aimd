# AIMD Design

## Purpose

This document defines the UI and interaction design principles for the AIMD package layer.

It is the design source of truth for:

1. `@airalogy/aimd-editor`
2. `@airalogy/aimd-recorder`
3. `@airalogy/aimd-renderer`
4. Shared protocol-facing visual semantics across AIMD field types

It is not the place to define desktop shell layout, page navigation, or app-wide product flows. Those belong in `player/DESIGN.md`.

## Design Goal

AIMD components should make structured protocol content feel readable, executable, and low-friction.

They must not feel like raw syntax visualizers.

The design target is:

1. content-first
2. semantically distinct
3. visually quiet
4. responsive by reorganization, not by naive shrinking
5. embeddable into many different hosts without breaking layout

## Core Principles

### 1. Content First, Control Second

The user should first perceive:

1. what this protocol says
2. what action is required
3. what data is expected

They should not first perceive:

1. implementation ids
2. schema mechanics
3. syntax tokens
4. decorative control chrome

If a component is more visually prominent than the protocol information it carries, it is overdesigned.

### 2. Semantic Types Must Stay Visually Distinct

Different AIMD field types are not variants of one generic form input.

They represent different user intentions:

1. `step`: task / procedure unit
2. `check`: confirmation unit
3. `var`: direct input field
4. `var_table`: structured multi-row record unit
5. `quiz`: assessment / prompt unit
6. `callout` / explanatory content: guidance unit
7. `fig`: visual reference unit

The system should preserve these differences in layout, emphasis, and interaction style.

### 3. Do Not Leak Internal IDs Into Primary UI

Internal ids are implementation handles, not user-facing labels.

Rules:

1. Prefer `title` or human-readable content when available.
2. Show ids only as fallback.
3. Avoid making ids the most prominent visible text.
4. If an id must be shown, demote it to low-contrast supporting metadata.

### 4. Reduce Box Noise

Avoid “box inside box inside box” composition.

Prefer:

1. fewer borders
2. lower contrast surfaces
3. clearer spacing
4. one dominant container per semantic unit

Avoid:

1. nested outlined controls inside already bordered cards
2. heavy color blocks for ordinary content
3. field chrome that competes with content hierarchy

### 5. Responsive Means Recompose, Not Compress

Wide and narrow layouts should not be the same layout scaled down.

Examples:

1. `var_table` may be table-like on desktop, but card-like on narrow screens.
2. step detail controls may move below the title instead of staying on one row.
3. check cards may stack confirmation, message, and notes vertically on small screens.

## Field-Type Design Rules

### `step`

`step` is an action card, not an inline syntax token.

Step cards should prioritize:

1. readable title or task text
2. sequence / hierarchy
3. optional confirmation state
4. optional timing state
5. optional notes

Rules:

1. Prefer `node.title` over raw `id`.
2. Show timer affordances only when timing is actually configured.
3. Treat countdown and elapsed timing as enhancement layers, not default clutter.
4. Group nearby body content into the step container when the renderer is in grouped mode.

### `check`

`check` is a confirmation unit, not a bare form checkbox.

Rules:

1. If same-paragraph trailing content exists, absorb it into the check card as the primary body copy.
2. Raw check ids should disappear from the primary UI when readable body copy exists.
3. `checked_message` should render as internal status feedback, not detached helper text.
4. Checked state should be visible through subtle state styling such as reduced contrast or strike-through of the primary body copy.
5. Dynamic `annotation` belongs inside the same visual container.

The ideal mental model is:

1. confirm this thing
2. see the current status
3. optionally read or add contextual notes

Not:

1. interact with a generic checkbox row

### `var`

`var` is a focused input surface.

Rules:

1. Keep it visually compact.
2. Do not overemphasize variable metadata.
3. Prefer clean single-surface inputs over stacked framing unless the data type requires more space.
4. Variable identifiers should not dominate the field visually.

### `var_table`

`var_table` is a structured record editor, not “a table because tables exist”.

Rules:

1. Desktop optimizes for scanability.
2. Narrow screens optimize for per-row editing.
3. Row actions should stay discoverable but quiet.
4. The unit of editing is the row, not the grid line.

### `quiz`

`quiz` should visually separate prompt content from answer controls.

Rules:

1. Prompt first
2. controls second
3. answer / rubric visibility should depend on mode

### `fig`

Figures should be resolved and displayed as content, not as raw file references.

Rules:

1. captions stay connected to images
2. images scale within the content column
3. file path mechanics remain hidden

## Grouping Rules

Grouping is a core part of AIMD readability.

### Step Body Grouping

When enabled, step-following content should be absorbed into the step container until a meaningful structural boundary is encountered.

Boundaries include:

1. another grouped step container
2. heading
3. divider

### Check Body Grouping

When enabled, same-paragraph trailing copy after a `check` field should be absorbed into the check container.

This allows:

```aimd
{{check|measurement_complete}} Confirm all wells have been recorded.
```

to render as one semantic unit rather than split UI.

Default expectation:

1. inline trailing check copy should be grouped
2. detached block content should not be auto-grouped unless explicitly designed later

## Typography And Hierarchy

### General

Use typography to express structure before using color.

Prefer:

1. font-weight changes
2. spacing
3. line-height
4. subtle badges

Avoid:

1. large saturated fills
2. oversized chrome
3. code-like visual treatment for normal user-facing copy

### Labels

Use supporting labels sparingly.

Examples:

1. scope badges are useful as secondary cues
2. ids are usually fallback metadata
3. helper copy should not compete with main content

## State Design

Every semantic unit should communicate state without noise.

### Good State Signals

1. checkbox state
2. subtle pill / badge status
3. text decoration changes for completed confirmations
4. light banners for success / warning / overtime states

### Bad State Signals

1. large full-surface color fills
2. duplicate state controls
3. multiple unrelated status accents at once

## Layout Contracts For Embedded Use

AIMD components are meant to be embedded inside host apps.

Therefore:

1. width must collapse safely
2. controls must allow wrapping
3. `minHeight=0` full-height mode must be explicit, not accidental
4. no component should assume it owns the page

## Design Smells

These are usually signs the AIMD UI is drifting in the wrong direction:

1. a raw id is more prominent than readable protocol text
2. the user sees two containers where one semantic unit should exist
3. timer UI appears when no timing behavior is configured
4. a field looks like a technical widget instead of a protocol element
5. long content overflows because layout assumes short labels
6. controls inside a bordered card still use strong bordered sub-controls by default

## Review Checklist

Before shipping any AIMD UI change, check:

1. Does the UI prioritize readable protocol content over implementation metadata?
2. Does each field type still look semantically distinct?
3. Does the design stay stable on narrow width?
4. Are long labels and body copy wrapped safely?
5. Are status and confirmation cues clear but low-noise?
6. Does the component compose well into a host app without layout hacks?
