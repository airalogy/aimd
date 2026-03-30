# @airalogy/aimd-presentation

`@airalogy/aimd-presentation` 是 AIMD UI 包共享的展示策略核心。

它把“非颜色类”的展示规则从主题 token 里拆出来，让宿主应用可以在一个地方统一控制：

- assigner 可见性
- step detail 可见性
- outline 可见性
- 技术 id 可见性
- label 优先策略
- compact / comfortable 密度

## 安装

```bash
pnpm add @airalogy/aimd-presentation
```

## 主要导出

```ts
import {
  defaultAimdPresentationProfile,
  resolveAimdPresentationProfile,
} from "@airalogy/aimd-presentation"
```

## Profile 结构

```ts
const profile = resolveAimdPresentationProfile({
  assigners: "collapsed",
  stepDetails: "hidden",
  outline: "compact",
  ids: "show",
  labels: "prefer_label",
  density: "compact",
})
```

这份 profile 可以直接传给 `@airalogy/aimd-recorder`、`@airalogy/aimd-renderer` 等 AIMD 宿主包使用。
