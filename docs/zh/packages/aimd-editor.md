# @airalogy/aimd-editor

`@airalogy/aimd-editor` 基于 Monaco 与可视化编辑能力，提供 AIMD 协议编写体验。

## 安装

```bash
pnpm add @airalogy/aimd-editor
```

## 核心能力

- AIMD 语法高亮与编辑器集成。
- `var` / `step` / `check` / `quiz` / 引用等字段插入弹窗。
- 面向协议编写流程的可配置交互。

## 示例

```ts
import { AIMD_LANGUAGE_ID } from "@airalogy/aimd-editor"

console.log(AIMD_LANGUAGE_ID)
```

完整交互可参考 `aimd/demo` 中的编辑器页面。
