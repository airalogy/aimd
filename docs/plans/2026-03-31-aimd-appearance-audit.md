# AIMD Appearance Audit

Date: 2026-03-31
Branch: `feat/recorder-var-asset-polish`
Base: `upstream/main`

## Goal

This audit inventories the current `aimd/` changes that still affect appearance relative to `upstream/main`, and classifies each relevant delta as either:

- `yes`: should revert to the upstream default appearance at the package baseline
- `no`: should stay only as an explicit `@airalogy/aimd-theme` or `@airalogy/aimd-presentation` capability

The rule is unchanged:

1. Package defaults should stay visually aligned with `upstream/main`.
2. Host-specific polish belongs in `theme` or `presentation`.
3. Mixed changes must keep the behavior fix while extracting or reverting the cosmetic delta.

## Baseline Inventory

### Commit range still ahead of `upstream/main`

```text
534cde6 merge: integrate upstream main into presentation upgrade branch
bd3d5de feat(presentation): add semantic theme and profile core
5b2e02a feat(editor): add source block affordances
5a806c3 fix(recorder): improve code block rendering and inline layout
9d4c6a7 feat: polish recorder var and file field UX
c78d4e0 fix(renderer): group inline check body copy for recorder
9c7a15c feat(recorder): merge inline check copy into check cards
48908bf fix: hide untimed step timers and prefer step titles
3a7fb69 fix(core): parse nested var_table subvars correctly
2779c4a docs: define focused PR workflow for agents
7d645c8 fix(editor): gate full-height layout to minHeight=0
162e943 fix: route Monaco workers correctly in editor packages
f68dc63 fix: resolve recorder figure assets and scale images
```

### Files with the largest added appearance-style literals in the current diff

These counts only measure added lines in `HEAD` vs `upstream/main` that match hardcoded appearance patterns such as hex colors, `rgba(...)`, `linear-gradient(...)`, `box-shadow`, `border-radius`, or `background:`.

| File | Added appearance-style hits | Notes |
| --- | ---: | --- |
| `packages/aimd-recorder/src/components/AimdRecorder.vue` | 65 | Main recorder shell, timer pills, table/card chrome, tooltip/card polish |
| `packages/aimd-recorder/src/components/AimdAssetField.vue` | 44 | Entire new file is polished card-style asset UI |
| `packages/aimd-editor/src/vue/AimdSourceEditor.vue` | 28 | Source block fence and zone affordances |
| `packages/aimd-recorder/src/components/AimdCodeField.vue` | 12 | Mostly already routed through theme vars |
| `packages/aimd-renderer/src/common/codeBlockPresentation.ts` | 12 | Central code-card presentation helper |
| `packages/aimd-renderer/src/vue/vue-renderer.ts` | 8 | Step-card helper still contains inline card chrome |
| `packages/aimd-recorder/src/components/AimdMarkdownField.vue` | 5 | Mostly already routed through theme vars |
| `packages/aimd-recorder/src/components/AimdDnaSequenceField.vue` | 2 | Small shell alignment change, still hardcoded |

## Explicitly Excluded From Appearance Scope

These changes should stay on the behavior track and should not be treated as appearance regressions:

- `3a7fb69 fix(core): parse nested var_table subvars correctly`
- `162e943 fix: route Monaco workers correctly in editor packages`
- `7d645c8 fix(editor): gate full-height layout to minHeight=0`
- `f68dc63 fix: resolve recorder figure assets and scale images`
- `c78d4e0 fix(renderer): group inline check body copy for recorder`
- `9c7a15c feat(recorder): merge inline check copy into check cards`
- `48908bf` piece that hides untimed timers when no timer is configured

The appearance-related part of `48908bf` is only the title / id display preference, which is audited below under `presentation`.

## Appearance Audit Table

| File or commit | Visual delta | Revert to upstream default? | If not, owner | Notes |
| --- | --- | --- | --- | --- |
| `packages/aimd-theme/src/index.ts` in `bd3d5de` | Introduces semantic surface, border, state, and code-block token system | no | `theme` | Keep the token system and CSS-var export surface. This is the right ownership boundary. |
| `packages/aimd-theme/src/index.ts` defaults | `defaultLight` / `defaultDark` currently encode a polished blue/soft-card package baseline rather than an upstream-neutral baseline | yes | — | Keep the package, but reset default token values so package defaults visually match `upstream/main`. |
| `packages/aimd-editor/src/theme.ts` in `bd3d5de` | Syntax token colors move from inline editor-specific constants to theme-backed token generation | no | `theme` | Correct extraction. The remaining issue is the default theme values, not the API shape. |
| `packages/aimd-presentation/src/index.ts` in `bd3d5de` | Introduces profile-level ownership for `density`, `ids`, `labels`, `assigners`, `stepDetails`, `outline` | no | `presentation` | Correct ownership boundary for non-color display strategy. |
| `packages/aimd-recorder/src/components/AimdRecorder.vue:214-215` | Recorder resolves `presentationProfile` with `assigners: "collapsed"` as an implicit package default | yes | — | This leaks host preference into the package baseline. Package default should remain upstream-style hidden unless host opts in. |
| `packages/aimd-recorder/src/components/AimdRecorder.vue:217-218`, `:1222-1225` | Recorder root injects resolved theme CSS vars and exposes density / outline data attributes | no | `theme` + `presentation` | Keep this plumbing. It is the correct host-consumption path. |
| `packages/aimd-recorder/src/components/AimdRecorder.vue` style section | Recorder content shell, empty state, timing pills, timer controls, stacked input shells, table drag states, card chrome, and tooltip polish still use many hardcoded colors / gradients / shadows | no | `theme` | These are the main remaining hardcoded visual deltas that should be tokenized instead of living in package CSS. |
| `packages/aimd-editor/src/vue/AimdSourceEditor.vue` in `5b2e02a` | Source fences and block zones add tinted backgrounds, gutter accents, header chrome, badges, chips, and flow arrows around fenced blocks | no | `theme` | Keep the affordance feature, but its fence/zone styling must be theme-backed instead of hardcoded. |
| `packages/aimd-editor/src/vue/source-blocks.ts` + completions in `AimdSourceEditor.vue` | Source block parsing and fenced-snippet completions | yes | — | Not an appearance API. Keep the behavior helpers, but any visual chrome must not be baked into package defaults. |
| `packages/aimd-recorder/src/components/AimdAssetField.vue` in `9d4c6a7` | New asset card, preview shell, unavailable state, trigger area, badges, icon buttons, gradients, hover lift, and error tint are fully hardcoded | no | `theme` | This should stay as a reusable field type, but all current polish must move behind semantic theme slots. |
| `packages/aimd-recorder/src/components/AimdVarField.vue` plus `.aimd-var-tooltip` styles in `AimdRecorder.vue` | Stacked var tooltip / metadata affordance replaces the old inline label treatment | no | `theme` | Behavior is fine; tooltip chrome and hover/focus treatment should be theme-owned. |
| `packages/aimd-recorder/src/components/AimdDnaSequenceField.vue` | DNA field now gets the same stacked-shell framing with a hardcoded border / radius | no | `theme` | Small but still part of the recorder field-shell appearance migration. |
| `packages/aimd-recorder/src/components/AimdCodeField.vue` in `5a806c3` / `bd3d5de` | Code field gets header, submeta, badge, surface shell, and loading / fallback chrome | no | `theme` | This is already mostly on theme vars and should remain theme-owned. The follow-up is default token neutralization, not rollback. |
| `packages/aimd-recorder/src/components/AimdMarkdownField.vue` | Markdown editor shell switches from bare wrapper to token-backed bordered surface | no | `theme` | Already on theme vars; keep. |
| `packages/aimd-recorder/src/components/AimdMarkdownNoteField.vue` | Preview code blocks are rendered through the code-block theme pipeline | no | `theme` | Correct extraction. No rollback needed. |
| `packages/aimd-renderer/src/common/codeBlockPresentation.ts` in `5a806c3` | Introduces shared code-card / assigner-card chrome generator with semantic tone inputs | no | `theme` | This is the correct place for reusable code-block appearance logic. |
| `packages/aimd-renderer/src/common/assignerVisibility.ts` | Assigner hidden/collapsed/expanded behavior now resolves through `presentationProfile`; visual chrome is delegated to `codeBlockPresentation` | no | `presentation` for visibility, `theme` for chrome | Correct split. Keep. |
| `packages/aimd-recorder/src/components/AimdStepCheckField.vue` | Step/check label vs id display, scope badge visibility, outline badge visibility, compact density, and details disclosure now resolve through `presentationProfile` | no | `presentation` | Correct extraction. This is where title/id preference belongs instead of package-default markup decisions. |
| `packages/aimd-renderer/src/vue/vue-renderer.ts` default step/check rendering | Preview and renderer now use presentation-driven primary label, secondary id, scope visibility, and outline visibility | no | `presentation` | Correct extraction. Keep. |
| `packages/aimd-renderer/src/vue/vue-renderer.ts#createStepCardRenderer` | Optional step-card helper still hardcodes green/orange gradients, badge fills, shadows, ID pill chrome, and body typography styling | no | `theme` + `presentation` | Keep as an opt-in host helper, but move inline colors/surfaces into `theme`; leave density/visibility to `presentation`. |
| `packages/aimd-recorder/src/styles/aimd.css` | Base recorder CSS now points many legacy field colors at semantic CSS vars | no | `theme` | Good direction. Remaining literals here should be cleaned up, but the ownership is correct. |
| Figure styles in `packages/aimd-recorder/src/styles/aimd.css` | Added figure caption / title colors and sizing for resolved figures | no | `theme` | Keep the behavior fix for figure resolution; route caption/title colors through theme. |

## Current Decision Summary

### Revert to upstream default at package baseline

- `packages/aimd-theme/src/index.ts` default token values
- `packages/aimd-recorder/src/components/AimdRecorder.vue` implicit `assigners: "collapsed"` package default

### Keep, but only as theme / presentation capability

- Theme package API and CSS-var plumbing
- Presentation profile API and downstream renderer / recorder consumers
- Source-block affordance chrome
- Recorder asset / var tooltip / field-shell polish
- Recorder shell, timer, table, and card chrome
- Shared code-block / assigner-card presentation helpers
- Optional step-card renderer chrome

## Immediate Follow-up Order

1. Reset package defaults that currently leak host taste.
   - Theme default palettes
   - Recorder default assigner visibility
2. Tokenize the remaining hardcoded appearance hotspots.
   - `AimdSourceEditor.vue`
   - `AimdAssetField.vue`
   - `AimdRecorder.vue`
   - `vue-renderer.ts#createStepCardRenderer`
   - recorder figure / DNA shell / tooltip details
3. Keep all visibility, density, id/label, outline, and disclosure policy work under `@airalogy/aimd-presentation`.
4. Consume any non-upstream look from `player` host config instead of changing AIMD defaults again.
