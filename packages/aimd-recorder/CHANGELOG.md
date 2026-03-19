# Changelog

All notable changes to `@airalogy/aimd-recorder` will be documented in this file.

## [Unreleased]

## [1.11.0] - 2026-03-19

### Added

- Added built-in step timing support driven by AIMD `duration`, including protocol-level estimated duration summaries, per-step elapsed timers, and persisted recorder-side timing fields (`elapsed_ms`, `timer_started_at_ms`, `started_at_ms`, `ended_at_ms`).
- Added countdown-aware step timer modes from AIMD `timer="elapsed|countdown|both"`, including remaining-time display, overtime display after zero, and warning styling as the countdown approaches completion.
- Added an embedded AiralogyMarkdown editor for step annotations so step notes can store longer formatted markdown content instead of being limited to a single-line plain-text input.
- Added `stepDetailDisplay: "auto" | "always"` on `AimdRecorder` so hosts can keep step timer and note details progressively disclosed by default or force them permanently expanded.

### Changed

- Reworked built-in step rendering into a compact primary row plus on-demand detail area so empty notes and unused timer controls no longer occupy space by default, while existing notes and active timers stay visible.
- Normalized recorder-facing AIMD step metadata and persisted step-timer state to snake_case so recorder JSON matches the rest of the AIMD / Airalogy data model.

## [1.10.0] - 2026-03-19

### Added

- Added built-in recorder support for Airalogy code-string types (`CodeStr`, `PyStr`, `JsStr`, `TsStr`, `JsonStr`, `TomlStr`, `YamlStr`), rendering them in a Monaco-based code editor with language-appropriate highlighting where available.
- Added `fieldMeta.codeLanguage` plus code-aware `fieldMeta.inputType` overrides so host apps can force a recorder var field into a code editor and choose the Monaco language explicitly for custom string types.

### Fixed

- Refined compact recorder var input sizing so `str` fields behave like autosizing inline text inputs that expand horizontally, then wrap and grow in height at the available width limit, while `number` fields now also resize with typed content without switching to multiline editing.

## [1.9.0] - 2026-03-19

### Changed

- Replaced the built-in `AiralogyMarkdown` recorder textarea with a full-width embedded AIMD/Markdown editor that opens in `Source` mode by default, still supports switching to `WYSIWYG`, and lifts inline occurrences into their own block row while keeping the same type token and plugin override path.

### Fixed

- Stabilized recorder subtree rendering during input updates so inline fields no longer flash, lose typed characters, or jump scroll position when parent `v-model` state echoes back into the recorder.

## [1.8.0] - 2026-03-19

### Added

- Added `typePlugins` on `AimdRecorder` so host applications can attach per-type initialization, normalization, display/parsing hooks, and dedicated widgets for custom AIMD var types.
- Exported recorder-side type plugin helpers and types so custom recorder integrations can share a stable typed contract.

### Changed

- Migrated built-in `CurrentTime`, `UserName`, `AiralogyMarkdown`, and `DNASequence` recorder behavior onto the same type-plugin path used by custom types.

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
