# Changelog

All notable changes to `@airalogy/aimd-recorder` will be documented in this file.

## [1.7.0] - 2026-03-19

### Added

- Added `fieldAdapters` on `AimdRecorder` so host applications can replace or wrap built-in `var`, `var_table`, `step`, `check`, and `quiz` field UIs while keeping AIMD parsing and record-state management in the recorder.
- Exported recorder-side adapter types (`AimdRecorderFieldAdapter*`) for typed host integrations that need access to the parsed node, current value, localized messages, and default recorder vnode.

## [1.6.0] - 2026-03-17

### Added

- Added a built-in `DNASequence` recorder widget for AIMD `var` fields, including editable sequence text, `linear` / `circular` topology, and GenBank-aligned subset editing for feature segments and qualifier rows.
- Added a viewer-first `DNASequence` recorder experience powered by `SeqViz`, including inline linear/circular sequence visualization, drag-to-select range creation, and click-to-focus feature selection.
- Added one-click GenBank export for `DNASequence` fields, downloading the current structured value as a `.gbk` file with sequence, topology, feature locations, and qualifier rows.
- Added an optional top-level `name` field to the `DNASequence` recorder so users can label a plasmid or construct independently from per-feature annotation names.

### Changed

- Kept the recorder-side `DNASequence` canonical payload at `airalogy_dna_v1`, while expanding the structure to support multi-segment locations, per-segment partial flags, and qualifier rows.
- Shifted the default editor from a pure form to a visual sequence workflow plus an advanced details editor for multi-segment locations, per-segment partial flags, and qualifier rows.
- Split the built-in `DNASequence` recorder into two explicit modes: a default interactive mode centered on the visual viewer and a raw structure mode for sequence text, multi-segment coordinates, and qualifier editing.
- Reduced the default DNA editor surface area so common viewer-based operations no longer compete visually with the full structured editor in the same screen.
- Reworked the interactive empty state so users can start by pasting DNA text or importing sequence-oriented FASTA / GenBank files instead of being redirected to the raw structure editor.
- Moved `DNASequence` file import into the shared top toolbar so both `Interactive` and `Raw structure` modes expose the same import/export actions.
- Defined file import and interactive sequence onboarding as replacement actions: importing or pasting a new sequence now clears existing annotations that are not reconstructed from the imported text.
- Imported FASTA / GenBank content now populates the sequence name when a header or locus name is available, and GenBank export/download filenames prefer the top-level `DNASequence.name` over the AIMD var id.

## [1.5.1] - 2026-03-13

### Added

- Added local execution support for fenced `assigner runtime=client` blocks, including `auto`, `auto_first`, and explicit `manual` triggering semantics.
- Added exposed component methods `runClientAssigner(id)` and `runManualClientAssigners()` on `AimdRecorder` for manual client assigner execution.
- Added localized recorder copy for quiz answer and rubric labels so open-question metadata stays aligned with renderer output.

### Changed

- Recorder field updates now re-run extracted client assigners and write resulting values back into `record.var` in dependency order.

### Fixed

- Fixed async inline rebuild races in `AimdRecorder` so `auto` client assigners reliably refresh downstream field displays after dependent input changes.
- Fixed client assigner execution in `AimdRecorder` by removing an invalid strict-mode `eval` shadow from the runtime compiler. `assigner runtime=client` auto assignments such as `Math.round(...)` now execute instead of silently failing with a syntax error.

## [1.4.4] - 2026-03-12

### Changed

- Aligned recorder quiz type labels with renderer output so `choice` quizzes distinguish `single` / `multiple` mode as `Single choice` / `Multiple choice` in English and `单选` / `多选` in Chinese.
- Reused the renderer-side quiz label helper in recorder locales to avoid maintaining the single-vs-multiple choice labeling logic twice.

## [1.4.3] - 2026-03-12

### Fixed

- Fixed decimal var input handling in `AimdRecorder` so `float`/`number` fields can enter values like `1.1` without the controlled input immediately collapsing the decimal point mid-typing.
- Preserved authored float default literals like `25.0` for the initial recorder display, so decimal defaults no longer collapse to `25` before the user edits the field.

## [1.4.2] - 2026-03-12

### Changed

- `AimdRecorder` now passes the live record into renderer edit context so inline `ref_var` references show the current var value as readonly content when available, instead of always showing the raw var id.
- Updated `ref_step` presentation styles so inline step references reuse the same step-like visual language instead of the generic reference blockquote styling.
- Aligned `ref_var` presentation with normal var styling by removing the generic reference block shell and faded state.
- Unified inline check label typography with var/step identifiers by raising `check` id/label weight to match the other AIMD field tags.
- Aligned recorder-mode `ref_var` colors with the recorder's actual var field palette so referenced variable values use the same blue treatment as normal var inputs.

### Fixed

- Synced with the renderer-side `ref_step` fix so recorder-mode step references keep localized step numbers instead of regressing to raw step ids.

## [1.4.0] - 2026-03-12

### Added

- Added built-in runtime locale support for recorder UI via `locale` (`en-US` / `zh-CN`) on both `AimdRecorder` and `AimdQuizRecorder`.
- Added `messages` overrides plus exported locale helpers (`createAimdRecorderMessages`, `resolveAimdRecorderLocale`) for customizing recorder labels without forking the components.

## [1.2.0] - 2026-03-05

### Changed

- Unified var header semantics to use `.aimd-field__id` for var id display and measurement, while preserving the previous visual style.
- Reworked stacked var width sizing to be content-driven (label/input measurement), with tuned date/time compensation and reduced unnecessary default min-width for single-line controls.
- Improved plain `str/text` var input behavior: long text now wraps instead of horizontal scrolling, auto-resizes by content, and keeps compact single-line alignment with other controls (`30px` baseline) plus better multiline readability.
- Fixed height conflicts caused by generic textarea min-height rules (`82px`/`78px`) so compact `str/text` fields no longer get unintentionally stretched.
- Normalized datetime-like var values to include timezone offset on both initial hydration and user re-selection.
- Renamed implementation file from `AimdProtocolRecorder.vue` to `AimdRecorder.vue`; `AimdProtocolRecorder` is kept as a deprecated export alias for compatibility.
