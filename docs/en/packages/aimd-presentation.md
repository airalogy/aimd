# @airalogy/aimd-presentation

`@airalogy/aimd-presentation` is the shared presentation-profile core for AIMD UI packages.

It keeps non-color display strategy rules out of theme tokens and gives host apps one place to control:

- assigner visibility
- step detail visibility
- outline visibility
- technical id visibility
- label preference
- compact vs comfortable density

## Install

```bash
pnpm add @airalogy/aimd-presentation
```

## Main Exports

```ts
import {
  defaultAimdPresentationProfile,
  resolveAimdPresentationProfile,
} from "@airalogy/aimd-presentation"
```

## Profile Shape

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

Use this profile directly with AIMD host packages such as `@airalogy/aimd-recorder` and `@airalogy/aimd-renderer`.
