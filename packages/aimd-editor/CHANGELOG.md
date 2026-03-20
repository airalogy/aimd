# Changelog

All notable changes to `@airalogy/aimd-editor` will be documented in this file.

## [Unreleased]

## [1.6.1] - 2026-03-21

### Fixed

- Scoped full-height editor layout to `minHeight={0}` only, so embeds inside fixed-height parents no longer regress when using the default editor height.

## [1.6.0] - 2026-03-19

### Added

- Added built-in insertion-dialog var type presets for Airalogy code-string types (`CodeStr`, `PyStr`, `JsStr`, `TsStr`, `JsonStr`, `TomlStr`, `YamlStr`) so the editor can surface the same code-oriented types that the recorder now renders with dedicated code editors.

## [1.5.0] - 2026-03-19

### Added

- Exported lightweight `@airalogy/aimd-editor/wysiwyg` and `@airalogy/aimd-editor/embedded` entries so host packages can embed WYSIWYG-only or source/WYSIWYG field editors without routing everything through the full `AimdEditor`.

### Changed

- Added host-facing support for unmounting inactive source / WYSIWYG panes in embedded editor scenarios, reducing hidden-editor focus and scroll interference inside recorder-style integrations.

## [1.4.0] - 2026-03-19

### Added

- Added `varTypePlugins` on `AimdEditor` / `AimdFieldDialog` so host applications can surface custom type presets in the insertion dialog without changing AIMD syntax itself.
- Exported `createAimdVarTypePresets(...)` and the typed preset shape for reusable custom type suggestion UIs.

## [1.3.0] - 2026-03-17

### Added

- Added explained interactive `var` type presets for recorder-supported types such as `date`, `datetime`, `time`, `CurrentTime`, `UserName`, `AiralogyMarkdown`, and `DNASequence`, so users can discover field behaviors directly from the insertion dialog.

### Changed

- Replaced the closed interactive `var` type dropdown with a freeform input plus an explained preset grid, so first-time users can choose the right type without already knowing AIMD type names.

## [1.2.3] - 2026-03-13

### Fixed

- Fixed Monaco source-mode highlighting for fenced `quiz` blocks so ````quiz` content now embeds YAML tokenization instead of falling back to plain AIMD/markdown styling.
- Fixed Monaco source-mode highlighting for fenced `assigner` blocks so `assigner runtime=client` now embeds JavaScript tokenization and default `assigner` blocks embed Python tokenization instead of falling back to plain AIMD/markdown styling.

## [1.2.1] - 2026-03-12

### Fixed

- Fixed WYSIWYG parsing/round-tripping for AIMD inline templates inside Markdown tables, so `{{var|...}}` now works without breaking table cells when switching between source and WYSIWYG modes.

## [1.1.1] - 2026-03-05

### Fixed

- Fixed AIMD inline type highlighting so `UpperCamelCase` types (for example `UserName`, `CurrentTime`, `AiralogyMarkdown`) are consistently tokenized as `type.aimd` instead of being split into mixed colors.
- Replaced case-insensitive identifier matching with explicit `[A-Za-z_]` matching to avoid Monaco regex edge cases where leading uppercase letters were not tokenized correctly.
