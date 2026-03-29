# @airalogy/aimd-theme

`@airalogy/aimd-theme` is the semantic theme core for AIMD UI packages.

It centralizes three things:

- semantic UI tokens for recorder / renderer / editor surfaces
- CSS variable generation for scoped theme roots
- syntax-theme adapters for Monaco / Shiki style token themes

## Install

```bash
pnpm add @airalogy/aimd-theme
```

## Main Exports

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

## CSS Variable Root

Use `createCssVars(...)` when a host component wants one scoped theme root instead of relying on global CSS overrides.

```ts
const style = createCssVars(defaultLight)
```

This output includes both semantic variables such as `--aimd-color-text` and recorder compatibility aliases such as `--rec-text` / `--aimd-var-bg`.

## Syntax Theme Adapters

`@airalogy/aimd-theme` does not know AIMD editor scope names by itself. Pass the scope map from the editor package:

```ts
import { createAimdTheme } from "@airalogy/aimd-editor/monaco"
import { defaultDark } from "@airalogy/aimd-theme"

const monacoTheme = createAimdTheme(defaultDark, "aimd-dark")
```

For lower-level integrations:

```ts
import { createAimdSyntaxTokenColors } from "@airalogy/aimd-theme"
import { AIMD_EDITOR_SYNTAX_SCOPES } from "@airalogy/aimd-editor/monaco"

const tokenColors = createAimdSyntaxTokenColors(AIMD_EDITOR_SYNTAX_SCOPES, defaultLight)
```
