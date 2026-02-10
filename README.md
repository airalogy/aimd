# AIMD Packages Monorepo

This repository contains the AIMD packages maintained as a single monorepo:

- `@airalogy/aimd-core`: AIMD parser, syntax definitions, and utilities
- `@airalogy/aimd-editor`: Monaco editor integration for AIMD
- `@airalogy/aimd-renderer`: Rendering AIMD to HTML and Vue
- `@airalogy/aimd-recorder`: Vue UI components and styles for AIMD

## Development

Install dependencies at the repo root:

```bash
pnpm install
```

Run all packages in watch mode (build on change):

```bash
pnpm dev
```

Run dev for a single package:

```bash
pnpm --filter @airalogy/aimd-core dev
pnpm --filter @airalogy/aimd-editor dev
pnpm --filter @airalogy/aimd-renderer dev
pnpm --filter @airalogy/aimd-recorder dev
```

Start the Demo dev server (visually test all packages):

```bash
pnpm dev:demo
```

Visit http://localhost:5188 to see the demo, which includes:

- **Core Parser**: Live AIMD Markdown parsing with AST and extracted fields
- **Editor**: Monaco editor token definitions and theme config preview
- **Renderer**: Live HTML / Vue VNode rendering preview
- **Recorder**: AIMD CSS styles and UI component preview

Type-check all packages:

```bash
pnpm type-check
```

## Build

Build all packages:

```bash
pnpm build
```

Build a single package:

```bash
pnpm --filter @airalogy/aimd-core build
```
