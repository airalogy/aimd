# @airalogy/aimd-theme

`@airalogy/aimd-theme` 是 AIMD UI 包的语义主题核心。

它集中提供三类能力：

- recorder / renderer / editor 共用的语义 UI token
- 面向 scoped theme root 的 CSS 变量生成
- Monaco / Shiki 风格语法主题适配器

## 安装

```bash
pnpm add @airalogy/aimd-theme
```

## 主要导出

```ts
import {
  createAimdSyntaxTheme,
  createAimdSyntaxTokenColors,
  createCssVars,
  defaultDark,
  defaultLight,
  resolveAimdTheme,
} from "@airalogy/aimd-theme"
```

## CSS 变量根节点

当宿主组件希望通过一个局部主题根节点控制样式，而不是依赖全局 CSS 覆盖时，使用 `createCssVars(...)`：

```ts
const style = createCssVars(defaultLight)
```

输出里既包含 `--aimd-color-text` 这样的语义变量，也包含 `--rec-text`、`--aimd-var-bg` 这样的 recorder 兼容别名。

## 语法主题适配器

`@airalogy/aimd-theme` 本身不知道 AIMD 编辑器的具体 scope 名称，需要配合 editor 包提供的 scope 映射一起使用：

```ts
import { createAimdTheme } from "@airalogy/aimd-editor/monaco"
import { defaultDark } from "@airalogy/aimd-theme"

const monacoTheme = createAimdTheme(defaultDark, "aimd-dark")
```

如果你需要更底层的 token color 输出：

```ts
import { createAimdSyntaxTokenColors } from "@airalogy/aimd-theme"
import { AIMD_EDITOR_SYNTAX_SCOPES } from "@airalogy/aimd-editor/monaco"

const tokenColors = createAimdSyntaxTokenColors(AIMD_EDITOR_SYNTAX_SCOPES, defaultLight)
```
