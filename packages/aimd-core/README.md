# @airalogy/aimd-core

> Core AIMD (Airalogy Markdown) parser and syntax definitions

## Overview

This package provides the core parsing and syntax definition infrastructure for AIMD (Airalogy Markdown), a specialized markdown format designed for research protocols and data collection. It includes a Unified/Remark plugin for parsing, complete TypeScript types, and grammar definitions for syntax highlighting across different editors.

## Features

- 🔍 **AIMD Syntax Parsing** - Unified/Remark plugin for parsing AIMD syntax into AST
- 📝 **Type Definitions** - Complete TypeScript types for all AIMD nodes
- 🎨 **Syntax Highlighting** - TextMate/Shiki grammar definitions for editors
- 🛠️ **Utility Functions** - Helper functions for working with AIMD data and templates
- ⚡ **Rehype Integration** - HTML transformation with custom AIMD handling

## Installation

```bash
pnpm add @airalogy/aimd-core
```

## Usage

### Basic Parsing

```typescript
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { remarkAimd } from '@airalogy/aimd-core'

const processor = unified()
  .use(remarkParse)
  .use(remarkAimd)

const content = `
# Research Protocol

{{var|sample_name: str}}
{{step|sample_preparation}}
{{check|quality_control}}
`

const file = await processor.process(content)
console.log(file.data.aimdFields)
```

### Syntax Highlighting with Shiki

```typescript
import { createHighlighter } from 'shiki'
import { aimdLanguage, aimdSyntaxTheme } from '@airalogy/aimd-core/syntax'

const highlighter = await createHighlighter({
  themes: [aimdSyntaxTheme],
  langs: [aimdLanguage],
})

const html = highlighter.codeToHtml(content, {
  lang: 'aimd',
  theme: 'aimd-theme',
})
```

### Type Usage

```typescript
import type {
  AimdVarNode,
  AimdStepNode,
  ExtractedAimdFields
} from '@airalogy/aimd-core/types'

function processFields(fields: ExtractedAimdFields) {
  fields.var.forEach((varNode: AimdVarNode) => {
    console.log(`Variable: ${varNode.name}`)
  })

  fields.step.forEach((stepNode: AimdStepNode) => {
    console.log(`Step: ${stepNode.name}`)
  })
}
```

### Utility Functions

```typescript
import {
  getSubvarNames,
  getSubvarDef,
  hasSubvars,
  findVarTable,
  isVarTableField,
  toTemplateEnv,
  toLegacyFieldsFormat,
  normalizeSubvars,
  mergeVarTableInfo
} from '@airalogy/aimd-core/utils'

const subvars = [{ name: 'sample_id' }, { name: 'concentration' }]
const names = getSubvarNames(subvars) // ['sample_id', 'concentration']

const varTable = findVarTable(fields, 'sample_table')
const templateEnv = toTemplateEnv(fields)
const normalized = normalizeSubvars(varTable?.subvars)
```

### Rehype Integration

```typescript
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { rehypeAimd } from '@airalogy/aimd-core'

const processor = unified()
  .use(remarkParse)
  .use(remarkAimd)
  .use(remarkRehype)
  .use(rehypeAimd)

const html = processor.processSync(content)
```

## AIMD Syntax

AIMD extends standard Markdown with special field syntax for research protocols:

### Variables

Simple variable declaration:
```aimd
{{var|sample_name: str}}
{{var|temperature: float = 25.0}}
{{var|is_active: bool = true}}
```

Variables with additional metadata:
```aimd
{{var|concentration: float = 1.0, title = "Concentration (M)", unit = "mol/L"}}
{{var|samples: list[str], title = "Sample IDs"}}
```

### Variable Tables

Define tabular data with subvariables:
```aimd
{{var_table|samples, subvars=[sample_id, concentration, volume]}}
```

With metadata:
```aimd
{{var_table|measurements, subvars=[time, value, unit], title = "Measurement Data"}}
```

### Steps

Procedure steps:
```aimd
{{step|sample_preparation}}
{{step|data_analysis}}
{{step|report_generation}}
```

### Checks

Quality checks and verification points:
```aimd
{{check|quality_control}}
{{check|safety_verification}}
```

### References

Reference other AIMD elements:
```aimd
{{ref_var|sample_name}}
{{ref_step|sample_preparation}}
{{ref_fig|figure_1}}
```

### Citations

Insert citations (comma-separated):
```aimd
{{cite|ref_1}}
{{cite|ref_1, ref_2}}
```

### Figures

Define figures via fenced code blocks:
````aimd
```fig
id: fig_1
src: /path/to/image.png
title: Optional title
legend: |
  Optional legend (multiline)
```
````

## Exports

### Main Entry (`@airalogy/aimd-core`)

- `remarkAimd` - Remark plugin for parsing AIMD syntax
- `rehypeAimd` - Rehype plugin for AIMD HTML transformation
- All types, syntax definitions, and utilities

```typescript
import { remarkAimd, rehypeAimd } from '@airalogy/aimd-core'
```

### Parser Export (`@airalogy/aimd-core/parser`)

- `remarkAimd` - Remark plugin
- `rehypeAimd` - Rehype plugin
- `DOM_ATTR_NAME` - DOM attribute constants for AIMD elements

```typescript
import { remarkAimd, DOM_ATTR_NAME } from '@airalogy/aimd-core/parser'
```

### Syntax Export (`@airalogy/aimd-core/syntax`)

- `aimdLanguage` - Language registration for Shiki
- `aimdInjection` - Injection syntax for embedding in other languages
- `aimdSyntaxTheme` - Default syntax highlighting theme
- `AIMD_SCOPES` - Scope name constants for tokenization

```typescript
import { aimdLanguage, aimdSyntaxTheme } from '@airalogy/aimd-core/syntax'
```

### Types Export (`@airalogy/aimd-core/types`)

Complete TypeScript types for AIMD:
- `AimdVarNode` - Variable node
- `AimdVarTableNode` - Variable table node
- `AimdStepNode` - Step node
- `AimdCheckNode` - Check node
- `AimdRefNode` - Reference node
- `ExtractedAimdFields` - Extracted fields structure
- `AimdTemplateEnv` - Template environment
- And more node and field types

```typescript
import type {
  AimdVarNode,
  AimdStepNode,
  ExtractedAimdFields
} from '@airalogy/aimd-core/types'
```

### Utils Export (`@airalogy/aimd-core/utils`)

Utility functions for working with AIMD:
- `normalizeSubvars()` - Normalize subvar formats
- `getSubvarNames()` - Extract subvar names from array
- `getSubvarDef()` - Get a subvar definition by name
- `hasSubvars()` - Whether a table has subvars
- `findVarTable()` - Find var_table by name
- `isVarTableField()` - Whether a given name is a var_table
- `mergeVarTableInfo()` - Merge var_table info into a field record
- `toTemplateEnv()` - Convert fields to template environment
- `toLegacyFieldsFormat()` - Convert to legacy fields format

```typescript
import {
  getSubvarNames,
  findVarTable,
  toTemplateEnv
} from '@airalogy/aimd-core/utils'
```

### Grammar Export (`@airalogy/aimd-core/syntax`)

TextMate grammar for syntax highlighting:
- `aimdLanguage` - For Shiki and other TextMate-based highlighters
- Available in multiple formats:
  - JSON for direct use
  - JavaScript for programmatic access

## Advanced Usage

### Custom Processor Configuration

```typescript
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { remarkAimd } from '@airalogy/aimd-core'

const processor = unified()
  .use(remarkParse)
  .use(remarkAimd, {
    extractFields: true,
    typed: {
      // Optional typed config (passed through to template env consumers)
      // my_type: { ... }
    },
  })
```

### Template Environment Generation

```typescript
import { toTemplateEnv } from '@airalogy/aimd-core/utils'
import type { ExtractedAimdFields } from '@airalogy/aimd-core/types'

const fields: ExtractedAimdFields = { /* ... */ }
const env = toTemplateEnv(fields)

// Use env in template rendering
const rendered = renderTemplate(templateString, env)
```

## Integrations

### With Monaco Editor

See `@airalogy/aimd-editor` for Monaco Editor integration with syntax highlighting.

### With Rendering

See `@airalogy/aimd-renderer` for rendering AIMD to HTML and Vue components.

### With UI Components

See `@airalogy/aimd-recorder` for ready-to-use Vue components for editing AIMD.

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

Core dependencies:
- `unified` - Text processing ecosystem
- `remark-parse` - Markdown parser
- `remark-rehype` - remark to rehype bridge
- `unist-util-visit` - AST visiting utilities

Dev dependencies:
- `shiki` - Syntax highlighting
- `typescript` - Type checking
- `vite` - Build tool

## Architecture

### Parser Pipeline

```
Content (string)
    ↓
remark-parse (Markdown AST)
    ↓
remarkAimd (AIMD nodes in AST)
    ↓
remarkRehype (HTML AST)
    ↓
rehypeAimd (AIMD-specific HTML transformations)
    ↓
HTML output
```

### Node Structure

AIMD nodes are compatible with Unified ecosystem:
- Extend from standard AST nodes
- Include metadata about AIMD elements
- Support custom attributes and data
- Compatible with rehype and other processors

## Contributing

1. Follow TypeScript best practices with strict typing
2. Add comprehensive JSDoc comments for all public APIs
3. Include unit tests for new utilities
4. Maintain backward compatibility or use deprecation warnings
5. Update documentation and README for new features
6. Test with different markdown content

## Performance Considerations

- Parser is optimized for streaming large documents
- AST visiting utilities use efficient traversal
- Type definitions don't impact runtime performance
- Grammar definitions are compiled for syntax highlighting efficiency

## License

Part of the Airalogy monorepo. All rights reserved.
