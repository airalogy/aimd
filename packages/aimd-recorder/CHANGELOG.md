# Changelog

All notable changes to `@airalogy/aimd-recorder` will be documented in this file.

## [1.4.0] - 2026-03-12

### Added

- Added built-in runtime locale support for recorder UI via `locale` (`en-US` / `zh-CN`) on both `AimdProtocolRecorder` and `AimdQuizRecorder`.
- Added `messages` overrides plus exported locale helpers (`createAimdRecorderMessages`, `resolveAimdRecorderLocale`) for customizing recorder labels without forking the components.

## [1.2.0] - 2026-03-05

### Changed

- Unified var header semantics to use `.aimd-field__id` for var id display and measurement, while preserving the previous visual style.
- Reworked stacked var width sizing to be content-driven (label/input measurement), with tuned date/time compensation and reduced unnecessary default min-width for single-line controls.
- Improved plain `str/text` var input behavior: long text now wraps instead of horizontal scrolling, auto-resizes by content, and keeps compact single-line alignment with other controls (`30px` baseline) plus better multiline readability.
- Fixed height conflicts caused by generic textarea min-height rules (`82px`/`78px`) so compact `str/text` fields no longer get unintentionally stretched.
- Normalized datetime-like var values to include timezone offset on both initial hydration and user re-selection.
- Renamed implementation file from `AimdProtocolRecorder.vue` to `AimdRecorder.vue`; `AimdProtocolRecorder` is kept as a deprecated export alias for compatibility.
