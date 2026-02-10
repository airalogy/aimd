# @airalogy/aimd-editor

> AIMD language support for Monaco Editor

## Overview

This package provides AIMD (Airalogy Markdown) editor support.

It has two entry points:

- `@airalogy/aimd-editor` - Monaco Monarch language definition + language configuration + completion provider, plus Shiki token/theme helpers
- `@airalogy/aimd-editor/vue` - Vue components and Milkdown plugins for a full editor experience

## Installation

```bash
pnpm add @airalogy/aimd-editor monaco-editor
```

## Usage

### Monaco Editor (language + completion)

```typescript
import * as monaco from 'monaco-editor'
import { language, conf, completionItemProvider } from '@airalogy/aimd-editor'

monaco.languages.register({ id: 'aimd' })
monaco.languages.setMonarchTokensProvider('aimd', language)
monaco.languages.setLanguageConfiguration('aimd', conf)
monaco.languages.registerCompletionItemProvider('aimd', completionItemProvider)

const editor = monaco.editor.create(document.getElementById('container')!, {
  value: '{{var|sample_name: str}}\n{{step|preparation}}',
  language: 'aimd',
  automaticLayout: true,
})
```

### Shiki (theme helpers)

```typescript
import { createHighlighter } from 'shiki'
import { aimdTheme, createAimdExtendedTheme } from '@airalogy/aimd-editor'

const highlighter = await createHighlighter({
  themes: [aimdTheme],
  langs: ['markdown'],
})

const extended = createAimdExtendedTheme(aimdTheme, 'aimd-extended')
```

### Vue (full editor)

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { AimdEditor } from '@airalogy/aimd-editor/vue'

const content = ref('')
</script>

<template>
  <AimdEditor v-model="content" />
</template>
```

## Features

- ✨ **Syntax Highlighting** - Full syntax highlighting for AIMD syntax
- 🎨 **Themes** - Light and dark themes optimized for AIMD
- 🔧 **Language Configuration** - Auto-closing pairs, brackets, and more
- 📝 **Type Annotations** - Syntax support for type annotations (e.g., `var|name: str`)

## AIMD Syntax Support

The Monaco integration supports all AIMD syntax elements:

- Variables: `{{var|name: type}}`
- Variable Tables: `{{var_table|table_name, subvars=[col1, col2]}}`
- Steps: `{{step|step_name}}`
- Checks: `{{check|check_name}}`
- References: `{{ref_var|name}}`, `{{ref_step|name}}`

## API

### Main Entry (`@airalogy/aimd-editor`)

- `language` - Monaco Monarch language definition
- `conf` - Monaco language configuration
- `completionItemProvider` - Monaco completion provider
- `aimdTokenColors` - Shiki token color settings
- `aimdTheme` - Shiki theme registration
- `createAimdExtendedTheme(baseTheme, name?)` - Extend a base Shiki theme with AIMD tokens
- `AimdToken`, `AimdTokenDefinition`, `AimdSuffix`, `scopeName` - Token helpers

### Vue Entry (`@airalogy/aimd-editor/vue`)

- `AimdEditor` - Vue component (Source / WYSIWYG)
- `AimdFieldDialog` - Field insertion dialog
- `AIMD_FIELD_TYPES` - Built-in AIMD field type definitions (for toolbar / dialogs)
- `MD_TOOLBAR_ITEMS` - Built-in Markdown toolbar items
- `getDefaultAimdFields(type)` - Create default form values for a given field type
- `buildAimdSyntax(type, fields)` - Build AIMD tag string from form values
- `getQuickAimdSyntax(type)` - Quick snippets for each field type
- `aimdMilkdownPlugins` - Combined Milkdown plugin list
- `aimdRemarkPlugin`, `aimdFieldNode`, `aimdFieldView`, `aimdFieldInputRule` - Individual Milkdown plugin exports
- Types: `AimdFieldType`, `MdToolbarItem`, `AimdEditorProps`, `AimdEditorEmits`

### Language Configuration

The language configuration includes:

- **Comments** - `#` for single-line comments
- **Brackets** - Auto-matching for `{{ }}` and `( )`
- **Auto-closing pairs** - Automatic closing of quotes and brackets
- **Surrogate pairs** - Support for unicode characters

### Theme Configuration

Available themes:

- **aimd-light** - Light theme optimized for daytime use
- **aimd-dark** - Dark theme optimized for nighttime use

Themes are fully customizable by defining new themes with `monaco.editor.defineTheme()`.

## Integration Examples

### Basic Editor Setup

```typescript
import * as monaco from 'monaco-editor'
import { language, conf, completionItemProvider } from '@airalogy/aimd-editor'

monaco.languages.register({ id: 'aimd' })
monaco.languages.setMonarchTokensProvider('aimd', language)
monaco.languages.setLanguageConfiguration('aimd', conf)
monaco.languages.registerCompletionItemProvider('aimd', completionItemProvider)

const editor = monaco.editor.create(document.getElementById('editor'), {
  value: '# Research Protocol\n\n{{var|sample_name: str}}',
  language: 'aimd',
  automaticLayout: true,
})
```

### Vue 3 Integration

```vue
<template>
  <div ref="editorContainer" class="editor-container" />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import * as monaco from 'monaco-editor'
import { language, conf, completionItemProvider } from '@airalogy/aimd-editor'

const editorContainer = ref<HTMLElement>()
let editor: monaco.editor.IStandaloneCodeEditor

onMounted(() => {
  if (!editorContainer.value) return

  monaco.languages.register({ id: 'aimd' })
  monaco.languages.setMonarchTokensProvider('aimd', language)
  monaco.languages.setLanguageConfiguration('aimd', conf)
  monaco.languages.registerCompletionItemProvider('aimd', completionItemProvider)

  editor = monaco.editor.create(editorContainer.value, {
    value: '# Protocol\n{{var|name: str}}',
    language: 'aimd',
    automaticLayout: true,
  })
})
</script>

<style scoped>
.editor-container {
  width: 100%;
  height: 100%;
}
</style>
```

### React Integration

```typescript
import { useEffect, useRef } from 'react'
import * as monaco from 'monaco-editor'
import { language, conf, completionItemProvider } from '@airalogy/aimd-editor'

export function AimdEditor() {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>()

  useEffect(() => {
    if (!containerRef.current) return

    monaco.languages.register({ id: 'aimd' })
    monaco.languages.setMonarchTokensProvider('aimd', language)
    monaco.languages.setLanguageConfiguration('aimd', conf)
    monaco.languages.registerCompletionItemProvider('aimd', completionItemProvider)

    editorRef.current = monaco.editor.create(containerRef.current, {
      value: '# Protocol\n{{var|name: str}}',
      language: 'aimd',
      automaticLayout: true,
    })

    return () => {
      editorRef.current?.dispose()
    }
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
```

## Performance Considerations

- **Lazy Loading** - Language and theme are registered on demand
- **Caching** - Grammar definitions are cached by Monaco
- **Syntax Highlighting** - Uses efficient TextMate tokenization
- **Memory** - Dispose editors properly to prevent memory leaks

## Troubleshooting

### Language Not Recognized

If AIMD language is not available, ensure the AIMD language is registered before creating the editor:

```typescript
// ✅ Correct
monaco.languages.register({ id: 'aimd' })
monaco.languages.setMonarchTokensProvider('aimd', language)
monaco.languages.setLanguageConfiguration('aimd', conf)
const editor = monaco.editor.create(container, { language: 'aimd' })

// ❌ Wrong - register after editor creation
const editor = monaco.editor.create(container, { language: 'aimd' })
monaco.languages.setMonarchTokensProvider('aimd', language)
```

## Related Packages

- **@airalogy/aimd-core** - Core AIMD parser and syntax definitions
- **@airalogy/aimd-renderer** - AIMD rendering engine
- **@airalogy/aimd-recorder** - Vue AIMD editor components
- **@airalogy/components** - General UI components

## Development

### Scripts

```bash
# Type checking
pnpm type-check

# Build for production
pnpm build

# Build type declarations
pnpm build:types
```

### Dependencies

- `monaco-editor` - Editor instance (peer dependency)
- `@airalogy/aimd-core` - Core AIMD functionality
- `@codingame/monaco-vscode-*` - Language utilities

## License

Part of the Airalogy monorepo. All rights reserved.
