# Contributing to AIMD

Thank you for your interest in contributing to the AIMD monorepo. This guide covers the development workflow, conventions, and release process.

## Prerequisites

- **Node.js** 20 or later
- **pnpm** 10 or later
- **Git**

## Setting Up the Dev Environment

```bash
# Clone the repository
git clone https://github.com/airalogy/aimd.git
cd aimd

# Install all workspace dependencies
pnpm install

# Build all packages (needed before running node:test tests)
pnpm build

# Start all packages in watch mode
pnpm dev

# Start only the demo app
pnpm dev:demo
```

## Project Structure

The monorepo is managed with pnpm workspaces and contains four publishable packages plus a demo app:

```text
aimd/
  packages/
    aimd-core/        # Parser, AST types, syntax grammar, utilities
    aimd-editor/      # Monaco language integration + Vue WYSIWYG editor
    aimd-renderer/    # HTML and Vue rendering engines
    aimd-recorder/    # Data-input components and recorder UI
  demo/               # Interactive demo app (Vue 3)
  docs/               # VitePress documentation site
```

### Package Dependency Graph

```text
aimd-core
  <- aimd-renderer (depends on aimd-core)
  <- aimd-editor   (depends on aimd-core + aimd-renderer)
  <- aimd-recorder (depends on aimd-core + aimd-renderer)
```

All inter-package dependencies use `workspace:*` protocol, so local changes are picked up automatically during development.

## Running Tests

The monorepo uses two test runners:

### node:test (built-in Node.js test runner)

Used by `aimd-core`, `aimd-editor`, and `aimd-renderer` for integration tests against built output. These tests live in `packages/<name>/tests/*.test.mjs` and require a prior build step.

```bash
# Build all packages, then run node:test suites across the workspace
pnpm test
```

### Vitest

Used for unit tests that run against source TypeScript directly. Test files live at `packages/*/src/**/*.test.ts` and use `happy-dom` as the DOM environment.

```bash
# Run all vitest suites once
pnpm test:vitest

# Watch mode
pnpm test:vitest:watch

# With coverage
pnpm test:vitest:coverage
```

### Type Checking

```bash
# Type-check all packages
pnpm type-check
```

## Building Packages

```bash
# Build all packages (Vite build + TypeScript declarations)
pnpm build
```

Each package defines its own `build` script. Most use Vite for the bundle and `tsc --emitDeclarationOnly` for type declarations.

## Documentation

The docs site is built with VitePress and lives in `docs/`.

```bash
# Start docs dev server
pnpm docs:dev

# Production build (includes embedded demo)
pnpm docs:build

# Preview the production build
pnpm docs:preview
```

### Documentation Layout

- Package READMEs: `packages/<name>/README.md` (concise, onboarding-focused)
- English docs: `docs/en/packages/<name>.md`
- Chinese docs: `docs/zh/packages/<name>.md`
- Site config: `docs/.vitepress/config.mjs`

When changing public API, user-facing behavior, or examples, update the relevant package README and both English and Chinese docs pages.

## Code Style and Conventions

### General

- All packages use **ESM** (`"type": "module"` in each `package.json`).
- TypeScript strict mode is enabled across all packages.
- Vue 3 Composition API with `<script setup>` is the standard for `.vue` files.

### Naming

- Package names follow the `@airalogy/aimd-*` pattern.
- Exported types use `Aimd` prefix (e.g., `AimdVarField`, `AimdRendererOptions`).
- Factory functions use `create` prefix (e.g., `createAimdEditorMessages`).
- Locale resolution helpers use `resolve` prefix (e.g., `resolveAimdRendererLocale`).

### Localization

- All user-facing packages support `en-US` and `zh-CN`.
- AIMD syntax keywords stay in English (e.g., `type: choice`, `mode: single`).
- Each package provides `createXxxMessages(locale)` factory functions and `resolveXxxLocale()` helpers.

### Imports

- Use subpath imports when only a subset of a package is needed:
  - `@airalogy/aimd-core/parser`
  - `@airalogy/aimd-editor/monaco`
  - `@airalogy/aimd-renderer/styles`
  - `@airalogy/aimd-recorder/composables`

## Pull Request Process

1. Create a feature branch from `main`.
2. Make your changes, following the conventions above.
3. Ensure all tests pass: `pnpm build && pnpm test && pnpm test:vitest`.
4. Run type checking: `pnpm type-check`.
5. If your change affects public API or user-facing behavior in a package, update:
   - The package README
   - The English docs page under `docs/en/packages/`
   - The Chinese docs page under `docs/zh/packages/`
6. Open a PR against `main` with a clear description of the change and its motivation.

## Versioning and Releases

This project follows [Semantic Versioning](https://semver.org/):

- **major**: Breaking API or behavior changes.
- **minor**: Backward-compatible feature additions.
- **patch**: Backward-compatible bug fixes.

### When to Bump Versions

Bump the version in a package's `package.json` when a change affects its published behavior:

- Public API or type export changes
- Runtime behavior changes observable by users
- Parser or renderer output changes
- Build output consumed by downstream packages

### When NOT to Bump Versions

- Internal refactors with no external behavior change
- Test-only changes
- Documentation-only changes
- CI, tooling, or config changes that do not affect the package runtime or API

### Changelog

When you bump a package version, update that package's `CHANGELOG.md` in the same commit. Keep the entry scoped to the package itself.

### Release Checklist

1. Bump the version in the package's `package.json`.
2. Update the package's `CHANGELOG.md`.
3. Commit with a descriptive message.
4. Merge to `main`.

Do not bump versions on every commit. Bump when preparing a release or when your workflow requires release metadata in the PR.

## Demo Samples

The canonical interactive sample lives at `demo/src/composables/sampleContent.aimd`. When adding a new built-in var type, recorder widget, or user-visible field experience, add a minimal example there so users can discover it from the demo UI.
