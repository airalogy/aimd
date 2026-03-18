# Changelog

All notable changes to `@airalogy/aimd-core` will be documented in this file.

Earlier historical releases were not backfilled yet. This changelog currently starts from the `2.x` release line.

## [2.2.0] - 2026-03-19

### Added

- Exported `validateVarDefaultType` from the parser entry so downstream tools can reuse AIMD var-default validation without reaching into internal modules.

### Changed

- Hardened `client_assigner` validation by parsing function bodies with `acorn`, closing Unicode-escape and computed-property bypasses that simple regex-only checks could miss.

## [2.1.0] - 2026-03-13

### Added

- Added extraction for fenced `assigner runtime=client` blocks, including structured `client_assigner[]` metadata with `id`, `mode`, `dependent_fields`, `assigned_fields`, and `function_source`.
- Added frontend-side assigner graph validation so duplicate assigned fields and cross-runtime cycles are rejected during AIMD parsing.
- Exported client assigner types and parser validation helpers for downstream packages that need to execute or inspect client assigners.
- Added `acorn` as a direct dependency in preparation for parser hardening around client assigner JavaScript syntax.

## [2.0.1] - 2026-03-12

### Added

- Added `AimdVarDefinition.defaultRaw` so downstream UIs can preserve authored default literals such as `25.0` while `default` remains the parsed numeric/boolean/string value.

## [2.0.0] - 2026-03-12

### Changed

- Completed the AIMD identifier cleanup as a breaking release: parsed AIMD nodes and extracted field metadata now use `id` as the only canonical identifier field.
- Removed deprecated `name` compatibility fields and step-hierarchy `parentName` / `prevName` / `nextName` aliases from parsed output and extracted field results.
- Renamed template-environment record lookup semantics to the `byId` model to match the `id`-only parsed output.
