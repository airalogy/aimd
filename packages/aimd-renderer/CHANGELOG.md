# Changelog

All notable changes to `@airalogy/aimd-renderer` will be documented in this file.

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
