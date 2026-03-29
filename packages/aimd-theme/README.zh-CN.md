# @airalogy/aimd-theme

AIMD UI 包共享的语义主题 token。

这个包负责集中提供：

- recorder / renderer / editor 共用的语义颜色 token
- 主题根节点使用的 CSS 变量生成
- Monaco / Shiki 风格语法主题适配器

## 快速开始

```ts
import {
  createCssVars,
  createAimdSyntaxTheme,
  defaultDark,
  defaultLight,
} from '@airalogy/aimd-theme'
```

## 导出内容

- `defaultLight`
- `defaultDark`
- `resolveAimdTheme(theme?)`
- `createCssVars(theme?)`
- `createAimdSyntaxTokenColors(scopes, theme?)`
- `createAimdSyntaxTheme(scopes, theme?, name?)`
