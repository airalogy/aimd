# Changelog

All notable changes to `@airalogy/aimd-renderer` will be documented in this file.

## [2.0.0] - 2026-03-12

### Changed

- Unified the renderer-side AIMD identifier cleanup into a single breaking release: parsed/extracted metadata now uses `id` as the only identifier field.
- Removed deprecated AIMD `name` compatibility fields from renderer-facing node metadata and extracted field objects.
- Removed deprecated `data-aimd-name` output. Consumers should use `data-aimd-id`.

## [1.4.1] - 2026-03-12

### Changed

- Fixed inline AIMD fields inside Markdown tables so `{{var|...}}` works directly without requiring the Markdown escape form `{{var\|...}}`.

## [1.4.0] - 2026-03-12

### Added

- Added built-in runtime locale support for renderer output via `locale` (`en-US` / `zh-CN`) across HTML, Vue, and unified renderer APIs.
- Added `messages` overrides plus exported locale helpers (`createAimdRendererMessages`, `resolveAimdRendererLocale`) for custom copy control.

## [1.3.0] - 2026-03-05

### Changed

- Enabled browser-side automatic KaTeX stylesheet loading when calling async render APIs (`renderToHtml`, `renderToVue`), so math rendering works out of the box without extra style wiring in typical usage.

### Added

- Added public style entry `@airalogy/aimd-renderer/styles` for manual style preloading/custom loading flows.
- Added `katex` as a direct dependency to guarantee stylesheet availability for consumers.
