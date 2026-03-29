# @airalogy/aimd-theme

Semantic theme tokens for AIMD UI packages.

This package centralizes:

- shared semantic color tokens for recorder / renderer / editor
- CSS variable generation for theme-scoped roots
- syntax theme adapters for Monaco / Shiki style token themes

## Quick Start

```ts
import {
  createCssVars,
  createAimdSyntaxTheme,
  defaultDark,
  defaultLight,
} from '@airalogy/aimd-theme'
```

## Exports

- `defaultLight`
- `defaultDark`
- `resolveAimdTheme(theme?)`
- `createCssVars(theme?)`
- `createAimdSyntaxTokenColors(scopes, theme?)`
- `createAimdSyntaxTheme(scopes, theme?, name?)`
