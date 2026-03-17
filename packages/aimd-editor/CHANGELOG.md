# Changelog

All notable changes to `@airalogy/aimd-editor` will be documented in this file.

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
