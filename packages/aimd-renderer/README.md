# @airalogy/aimd-renderer

> AIMD rendering engines for HTML and Vue

## Overview

This package provides rendering engines for converting AIMD (Airalogy Markdown) AST to HTML and Vue virtual nodes. It includes processors for parsing AIMD content and flexible renderers for different output formats.

## Features

- 🎨 **HTML Rendering** - Convert AIMD to HTML with syntax highlighting
- 🖼️ **Vue Rendering** - Generate Vue virtual nodes for reactive components
- 🧩 **Modular Renderers** - Pluggable renderers for code blocks, assets, and more
- 📝 **Custom Rendering Rules** - Define custom rendering behavior for AIMD elements
- 🔌 **Plugin System** - Extend functionality with custom plugins
- ⚡ **Performance** - Optimized for both sync and async rendering

## Installation

```bash
pnpm add @airalogy/aimd-renderer @airalogy/aimd-core
```

## Usage

### Basic HTML Rendering

```typescript
import { renderToHtml, renderToHtmlSync } from '@airalogy/aimd-renderer'

const content = `
# Research Protocol

{{var|sample_name: str}}
{{step|sample_preparation}}
`

// Async rendering
const { html, fields } = await renderToHtml(content)
console.log(html)
console.log(fields)

// Sync rendering
const { html: htmlSync, fields: fieldsSync } = renderToHtmlSync(content)
```

### Vue Rendering

```typescript
import { renderToVue, createComponentRenderer } from '@airalogy/aimd-renderer'

const content = `...`

// Render to Vue virtual nodes
const { nodes, fields } = await renderToVue(content, {
  renderers: createComponentRenderer({
    // Custom component mappings
  })
})
```

### Advanced Processor Creation

```typescript
import { createRenderer } from '@airalogy/aimd-renderer'

const processor = createRenderer({
  // Custom rendering options
  extractFields: true,
  includeMeta: true,
})

const { html, fields } = await processor.toHtml(content)
console.log(html)
console.log(fields)
```

### Custom Asset Rendering

```typescript
import { createAssetRenderer } from '@airalogy/aimd-renderer'

const assetRenderer = createAssetRenderer({
  resolveUrl: async (assetPath) => {
    return `/assets/${assetPath}`
  },
  cache: true,
})
```

### Code Block Highlighting

```typescript
import { createCodeBlockRenderer } from '@airalogy/aimd-renderer'
import { createHighlighter } from 'shiki'

const highlighter = await createHighlighter({
  themes: ['github-light', 'github-dark'],
  langs: ['javascript', 'python', 'markdown'],
})

const codeRenderer = createCodeBlockRenderer({
  highlighter,
  theme: 'github-light',
})
```

### Mermaid Diagram Rendering

```typescript
import { createMermaidRenderer } from '@airalogy/aimd-renderer'

const mermaidRenderer = createMermaidRenderer({
  theme: 'default',
  securityLevel: 'loose',
})
```

## Exports

### Main Entry (`@airalogy/aimd-renderer`)

#### Processing Functions
- `createHtmlProcessor()` - Create HTML rendering processor
- `createRenderer()` - Create custom renderer with options
- `defaultRenderer` - Default renderer instance (`createRenderer()` result)
- `renderToHtml(content, options?)` - Render to HTML string (async)
- `renderToHtmlSync(content, options?)` - Render to HTML string (sync)
- `renderToVue(content, options?)` - Render to Vue virtual nodes
- `parseAndExtract(content, options?)` - Parse and extract AIMD fields

#### Renderer Creation
- `createComponentRenderer(options)` - Create Vue component renderer
- `createAssetRenderer(options)` - Create asset resolver
- `createCodeBlockRenderer(options)` - Create code block renderer
- `createEmbeddedRenderer(options)` - Create embedded content renderer
- `createMermaidRenderer(options)` - Create Mermaid diagram renderer

#### Utilities
- `hastToVue(hastNode, options?)` - Convert HAST to Vue vNodes
- `createUnifiedTokenRenderer(options)` - Create token-based renderer
- `renderToVNodes(hastNode, options?)` - Render HAST root to Vue vNodes
- `getFinalIndent(item)` - Calculate final indentation
- `parseFieldTag(template)` - Parse AIMD field tags

#### Event Keys
- `fieldEventKey` - Event key for field interactions
- `draftEventKey` - Event key for draft changes
- `protocolKey` - Event key for protocol updates
- `reportEventKey` - Event key for report generation
- `bubbleMenuEventKey` - Event key for bubble menu

### HTML Entry (`@airalogy/aimd-renderer/html`)

HTML-specific rendering exports:
- `createHtmlProcessor()`
- `renderToHtml()`
- `renderToHtmlSync()`
- `parseAndExtract()`

### Vue Entry (`@airalogy/aimd-renderer/vue`)

Vue-specific rendering exports:
- `renderToVue()`
- `createRenderer()`
- All component renderers and utilities

## Types

### `RenderResult`
```typescript
interface RenderResult {
  nodes: VNode[]
  fields: ExtractedAimdFields
}
```

### `VueRendererOptions`
```typescript
interface VueRendererOptions {
  renderers?: {
    [key: string]: ElementRenderer
  }
  assetResolver?: AssetResolver
  codeBlockRenderer?: ElementRenderer
  mermaidRenderer?: ElementRenderer
}
```

### `ElementRenderer`
```typescript
type ElementRenderer = (node: AimdNode, context?: RenderContext) => VNode | string
```

## AIMD Elements Supported

The renderer handles all AIMD syntax elements:

- **Variables**: `{{var|name: type}}`
- **Variable Tables**: `{{var_table|table_name, subvars=[col1, col2]}}`
- **Steps**: `{{step|step_name}}`
- **Checks**: `{{check|check_name}}`
- **References**: `{{ref_var|name}}`, `{{ref_step|name}}`
- **Embedded Content**: Code blocks, images, diagrams
- **Mathematical Expressions**: KaTeX/MathML support

## Configuration Options

### ProcessorOptions
- `extractFields?: boolean` - Extract AIMD fields
- `includeMeta?: boolean` - Include metadata in result
- `customRules?: TokenRenderRule[]` - Custom rendering rules
- `assets?: AssetResolverOptions` - Asset resolution options

## Performance

### Sync vs Async

- Use `renderToHtmlSync()` for simple content without external resources
- Use `renderToHtml()` when assets need to be resolved or remote resources are needed

### Caching

Asset renderers support caching to improve performance:

```typescript
const renderer = createAssetRenderer({
  cache: true,
  cacheSize: 100,
})
```

## Integration Examples

### With Vue Components

```vue
<template>
  <div class="aimd-content" v-html="htmlContent" />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { renderToHtml } from '@airalogy/aimd-renderer'

const htmlContent = ref('')

onMounted(async () => {
  htmlContent.value = await renderToHtml(props.content)
})
</script>
```

### With Custom Component Mapping

```typescript
import { createComponentRenderer, renderToVue } from '@airalogy/aimd-renderer'
import CustomVarDisplay from './CustomVarDisplay.vue'

const renderer = createComponentRenderer({
  customMappers: {
    var: (node) => {
      return h(CustomVarDisplay, { field: node })
    }
  }
})

const vNodes = await renderToVue(content, { renderers: renderer })
```

## License

Part of the Airalogy monorepo. All rights reserved.
