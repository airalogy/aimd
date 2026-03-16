# Changelog

All notable changes to `@airalogy/aimd-editor` will be documented in this file.

## [Unreleased]

### Fixed

- Expanded the interactive `var` insertion UI from a closed type dropdown to a freeform input with common AIMD presets, so recorder-supported types like `date`, `datetime`, `time`, `CurrentTime`, `UserName`, and `AiralogyMarkdown` are now discoverable from the dialog.
- Reworked the interactive `var` type picker into an explained preset grid plus an optional custom type input, so first-time users can choose the right field behavior without already knowing AIMD type names.

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
