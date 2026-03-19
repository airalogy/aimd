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

## Documentation

Docs are hosted under `docs/` with bilingual structure:

- English: `docs/en/`
- Chinese: `docs/zh/`
- Organized by package: `docs/{en|zh}/packages/*`
- Embedded demo page: `docs/{en|zh}/demo.md`

Run docs locally:

```bash
pnpm docs:dev
```

Build docs:

```bash
pnpm docs:build
```

`pnpm docs:build` packages both docs and demo assets (mounted under `/demo/` in the docs site).

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

## Citation

If the AIMD packages are useful in your work, please cite the Airalogy paper:

```bibtex
@misc{yang2025airalogyaiempowereduniversaldata,
      title={Airalogy: AI-empowered universal data digitization for research automation},
      author={Zijie Yang and Qiji Zhou and Fang Guo and Sijie Zhang and Yexun Xi and Jinglei Nie and Yudian Zhu and Liping Huang and Chou Wu and Yonghe Xia and Xiaoyu Ma and Yingming Pu and Panzhong Lu and Junshu Pan and Mingtao Chen and Tiannan Guo and Yanmei Dou and Hongyu Chen and Anping Zeng and Jiaxing Huang and Tian Xu and Yue Zhang},
      year={2025},
      eprint={2506.18586},
      archivePrefix={arXiv},
      primaryClass={cs.AI},
      url={https://arxiv.org/abs/2506.18586},
}
```
