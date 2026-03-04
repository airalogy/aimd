# AGENTS

## Scope

- `packages/*` are publishable AIMD packages (`@airalogy/aimd-*`).

## Versioning Policy For AI Agents

- When a change affects a package's **published behavior**, update that package version in its `package.json`.
- Use SemVer:
  - `major`: breaking API/behavior changes.
  - `minor`: backward-compatible feature additions.
  - `patch`: backward-compatible bug fixes.
- Treat these as version-worthy by default:
  - Public API/type export changes.
  - Runtime behavior changes users can observe.
  - Parser/renderer output changes.
  - Build output that downstream users consume.

## Changes That Usually Do Not Need Version Bump

- Internal refactor with no external behavior change.
- Tests only.
- Docs only.
- CI/tooling/config changes not affecting package runtime/API.

## Commit vs Version Bump

- Do **not** bump version on every commit.
- Bump versions when preparing a release (or when your workflow requires release metadata in each PR).
- If unsure whether a change is externally visible, prefer:
  - Ask for confirmation, or
  - Do at least a `patch` bump.
