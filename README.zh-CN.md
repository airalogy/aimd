# AIMD 包 Monorepo

[![CI](https://github.com/airalogy/aimd/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/airalogy/aimd/actions/workflows/ci.yml)
[![Docs](https://github.com/airalogy/aimd/actions/workflows/docs.yml/badge.svg?branch=main)](https://github.com/airalogy/aimd/actions/workflows/docs.yml)
[![npm scope](https://img.shields.io/badge/npm-%40airalogy%2F*-CB3837?logo=npm)](https://www.npmjs.com/org/airalogy)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)

本仓库以 monorepo 形式维护 AIMD 相关包：

| 包名 | npm | 文档 | 说明 |
| --- | --- | --- | --- |
| `@airalogy/aimd-core` | [![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-core?logo=npm&color=cb3837)](https://www.npmjs.com/package/@airalogy/aimd-core) | [README](./packages/aimd-core/README.zh-CN.md) · [站点](https://airalogy.github.io/aimd/zh/packages/aimd-core/) | AIMD 解析器、语法定义与工具 |
| `@airalogy/aimd-editor` | [![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-editor?logo=npm&color=cb3837)](https://www.npmjs.com/package/@airalogy/aimd-editor) | [README](./packages/aimd-editor/README.zh-CN.md) · [站点](https://airalogy.github.io/aimd/zh/packages/aimd-editor/) | AIMD 的 Monaco 编辑器集成与 Vue 编辑流程 |
| `@airalogy/aimd-renderer` | [![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-renderer?logo=npm&color=cb3837)](https://www.npmjs.com/package/@airalogy/aimd-renderer) | [README](./packages/aimd-renderer/README.zh-CN.md) · [站点](https://airalogy.github.io/aimd/zh/packages/aimd-renderer/) | 将 AIMD 渲染为 HTML 与 Vue |
| `@airalogy/aimd-recorder` | [![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-recorder?logo=npm&color=cb3837)](https://www.npmjs.com/package/@airalogy/aimd-recorder) | [README](./packages/aimd-recorder/README.zh-CN.md) · [站点](https://airalogy.github.io/aimd/zh/packages/aimd-recorder/) | 面向结构化 AIMD 记录的 Vue UI 组件与样式 |

## AIMD 案例

场景案例集中放在 [examples/](./examples/)，并通过 [examples/index.json](./examples/index.json) 提供机器可读清单。用户可以在 [Demo 案例页](https://airalogy.github.io/aimd/demo/#/examples) 中直接预览、编辑和填写这些案例。

## 开发

在仓库根目录安装依赖：

```bash
pnpm install
```

全部包进入 watch 模式（改动自动构建）：

```bash
pnpm dev
```

单包开发：

```bash
pnpm --filter @airalogy/aimd-core dev
pnpm --filter @airalogy/aimd-editor dev
pnpm --filter @airalogy/aimd-renderer dev
pnpm --filter @airalogy/aimd-recorder dev
```

启动 Demo 开发服务器（可视化测试所有包功能）：

```bash
pnpm dev:demo
```

访问 http://localhost:5188 查看 Demo，包含以下页面：

- **案例**：浏览仓库内 AIMD 场景案例并在记录器中填写
- **Core 解析器**：实时解析 AIMD Markdown，查看 AST 和提取的字段
- **Editor 编辑器**：Monaco 编辑器 Token 定义和主题配置预览
- **Renderer 渲染器**：AIMD 渲染为 HTML / Vue VNodes 的实时预览
- **Recorder 组件**：AIMD CSS 样式和 UI 组件预览

## 文档

文档位于 `docs/`，采用中英文双语与按包组织结构：

- 英文：`docs/en/`
- 中文：`docs/zh/`
- 按包划分：`docs/{en|zh}/packages/*`
- 内嵌 Demo 页面：`docs/{en|zh}/demo.md`

本地启动文档站：

```bash
pnpm docs:dev
```

构建文档站：

```bash
pnpm docs:build
```

`pnpm docs:build` 会同时打包文档站与 demo 静态资源（在文档站下挂载到 `/demo/`）。

全量类型检查：

```bash
pnpm type-check
```

## 构建

构建全部包：

```bash
pnpm build
```

构建单个包：

```bash
pnpm --filter @airalogy/aimd-core build
```

## 发布与版本管理

本仓库使用 `Changesets` 管理 publishable `@airalogy/aimd-*` 包的版本与发布流程。

- 正常功能开发时，不要手动修改各包 `package.json` 的 `version`
- 如果改动影响已发布包的外部行为，请运行 `corepack pnpm changeset:add`
- 一个功能如果同时影响多个包，优先写成一个多包 changeset
- 合并到 `main` 后，GitHub Actions 会自动创建或更新 release PR；合并 release PR 后再自动发布

中文说明见 [RELEASING.zh-CN.md](./RELEASING.zh-CN.md)。
