# AGENTS

## Scope

- `packages/*` are publishable AIMD packages (`@airalogy/aimd-*`).

## Documentation Layout

- Package READMEs live in `packages/<package-name>/README.md` and `packages/<package-name>/README.zh-CN.md`.
- Docs site source lives in `docs/`.
- English package docs live in `docs/en/packages/<package-name>.md`.
- Chinese package docs live in `docs/zh/packages/<package-name>.md`.
- Docs site config lives in `docs/.vitepress/config.mjs`.

## Documentation Expectations For AI Agents

- When changing public package API, user-facing behavior, onboarding flow, or examples, update the relevant package README and matching docs pages under `docs/en/` and `docs/zh/`.
- Keep English and Chinese docs aligned in scope unless the user explicitly asks otherwise.
- Keep package README concise and onboarding-focused; put fuller explanations and API usage in `docs/`.

## Demo Sample Expectations

- `demo/src/composables/sampleContent.aimd` is the canonical interactive sample used across AIMD demos.
- When adding a new built-in var type, recorder widget, or other user-visible field experience, add a minimal example to `demo/src/composables/sampleContent.aimd` unless the user explicitly asks not to.
- Prefer one clear example per built-in type in the sample so users can discover it directly from the demo UI.

## Vue Rendering Stability

- Do not use unstable dynamic component factories in templates such as `:is="() => nodes"` for recorder/editor output. They can force unnecessary unmount/remount cycles and cause focus or scroll jumps while typing.
- When syncing `v-model` state back into local reactive state, short-circuit echo updates if the semantic content has not changed. Avoid rebuilding recorder/editor subtrees for no-op parent round-trips.

## Versioning Policy For AI Agents

- When a change affects a package's **published behavior**, update that package version in its `package.json`.
- When a publishable package version is bumped, update that package's `CHANGELOG.md` in the same change.
- Keep the changelog entry scoped to the package itself; do not describe unrelated workspace changes in another package's changelog.
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
- If you do bump a package version, treat updating that package changelog as required release metadata, not optional follow-up work.

## Pull Request Workflow For AI Agents

- Prefer **one user-visible feature, one bug fix, or one narrowly scoped refactor per PR**.
- Do not bundle unrelated fixes, cleanup, or follow-up ideas into the same PR just because they touch nearby files.
- When a larger effort contains multiple independent fixes/features, split them into separate branches and separate PRs in the order they can be reviewed safely.
- Before opening a PR, make sure the diff is focused and explainable as a single reviewable change.
- Use a dedicated branch for each PR; do not keep stacking unrelated work on the same branch.
- When opening PRs from this workspace, prefer using `gh pr create` so the resulting branch/PR linkage is explicit and reproducible.
- In the PR body, state:
  - what changed,
  - why it changed,
  - and exactly which tests/build checks were run.
- If a change fixes a regression introduced by an earlier branch or PR, submit that regression fix as its own PR unless the user explicitly asks to fold it back into a larger branch.
