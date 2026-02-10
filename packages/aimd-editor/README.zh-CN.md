# @airalogy/aimd-editor

> Monaco 编辑器的 AIMD 语言支持

## 概述

本包提供 AIMD（Airalogy Markdown）编辑器能力。

它包含两个入口：

- `@airalogy/aimd-editor` - Monaco Monarch 语言定义 + 语言配置 + 补全 provider，以及 Shiki token/theme 辅助
- `@airalogy/aimd-editor/vue` - Vue 组件与 Milkdown 插件，用于完整编辑器体验

## 安装

```bash
pnpm add @airalogy/aimd-editor monaco-editor
```

## 使用

### Monaco Editor（语言 + 补全）

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

### Shiki（主题辅助）

```typescript
import { createHighlighter } from 'shiki'
import { aimdTheme, createAimdExtendedTheme } from '@airalogy/aimd-editor'

const highlighter = await createHighlighter({
  themes: [aimdTheme],
  langs: ['markdown'],
})

const extended = createAimdExtendedTheme(aimdTheme, 'aimd-extended')
```

### Vue（完整编辑器）

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

## 功能特性

- ✨ **语法高亮** - AIMD 语法的完整语法高亮
- 🎨 **主题** - 针对 AIMD 优化的亮色和暗色主题
- 🔧 **语言配置** - 自动关闭对、括号等
- 📝 **类型注释** - 类型注释的语法支持（例如 `var|name: str`）

## AIMD 语法支持

Monaco 集成支持所有 AIMD 语法元素：

- 变量: `{{var|name: type}}`
- 变量表: `{{var_table|table_name, subvars=[col1, col2]}}`
- 步骤: `{{step|step_name}}`
- 检查: `{{check|check_name}}`
- 引用: `{{ref_var|name}}`、`{{ref_step|name}}`

## API

### 主入口（`@airalogy/aimd-editor`）

- `language` - Monaco Monarch 语言定义
- `conf` - Monaco 语言配置
- `completionItemProvider` - Monaco 补全 provider
- `aimdTokenColors` - Shiki token 颜色设置
- `aimdTheme` - Shiki 主题注册
- `createAimdExtendedTheme(baseTheme, name?)` - 基于基础 Shiki theme 扩展 AIMD tokens
- `AimdToken`, `AimdTokenDefinition`, `AimdSuffix`, `scopeName` - Token 辅助

### Vue 入口（`@airalogy/aimd-editor/vue`）

- `AimdEditor` - Vue 组件（Source / WYSIWYG）
- `AimdFieldDialog` - 字段插入对话框
- `AIMD_FIELD_TYPES` - 内置 AIMD 字段类型定义（用于工具栏 / 对话框）
- `MD_TOOLBAR_ITEMS` - 内置 Markdown 工具栏条目
- `getDefaultAimdFields(type)` - 为指定字段类型创建默认表单值
- `buildAimdSyntax(type, fields)` - 根据表单值构建 AIMD 标签字符串
- `getQuickAimdSyntax(type)` - 各字段类型的快速片段
- `aimdMilkdownPlugins` - 组合后的 Milkdown 插件列表
- `aimdRemarkPlugin`、`aimdFieldNode`、`aimdFieldView`、`aimdFieldInputRule` - 单独的 Milkdown 插件导出
- 类型：`AimdFieldType`、`MdToolbarItem`、`AimdEditorProps`、`AimdEditorEmits`

### 语言配置

语言配置包括：

- **注释** - `#` 用于单行注释
- **括号** - `{{ }}` 和 `( )` 的自动匹配
- **自动关闭对** - 引号和括号的自动关闭
- **替代对** - 对 unicode 字符的支持

### 主题配置

可用主题：

- **aimd-light** - 为白天使用优化的亮色主题
- **aimd-dark** - 为夜间使用优化的暗色主题

主题完全可定制，通过 `monaco.editor.defineTheme()` 定义新主题。

## 集成示例

### 基础编辑器设置

```typescript
import * as monaco from 'monaco-editor'
import { language, conf, completionItemProvider } from '@airalogy/aimd-editor'

monaco.languages.register({ id: 'aimd' })
monaco.languages.setMonarchTokensProvider('aimd', language)
monaco.languages.setLanguageConfiguration('aimd', conf)
monaco.languages.registerCompletionItemProvider('aimd', completionItemProvider)

const editor = monaco.editor.create(document.getElementById('editor'), {
  value: '# 研究协议\n\n{{var|sample_name: str}}',
  language: 'aimd',
  automaticLayout: true,
})
```

### Vue 3 集成

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
    value: '# 协议\n{{var|name: str}}',
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

### React 集成

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
      value: '# 协议\n{{var|name: str}}',
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

## 性能考虑

- **延迟加载** - 语言和主题按需注册
- **缓存** - 语法定义由 Monaco 缓存
- **语法高亮** - 使用高效的 TextMate 词法分析
- **内存** - 正确处置编辑器以防止内存泄漏

## 故障排除

### 语言未被识别

如果 AIMD 语言不可用，请确保在创建编辑器之前完成语言注册：

```typescript
// ✅ 正确
monaco.languages.register({ id: 'aimd' })
monaco.languages.setMonarchTokensProvider('aimd', language)
monaco.languages.setLanguageConfiguration('aimd', conf)
const editor = monaco.editor.create(container, { language: 'aimd' })

// ❌ 错误 - 在创建编辑器后注册
const editor = monaco.editor.create(container, { language: 'aimd' })
monaco.languages.setMonarchTokensProvider('aimd', language)
```

## 相关包

- **@airalogy/aimd-core** - 核心 AIMD 解析器和语法定义
- **@airalogy/aimd-renderer** - AIMD 渲染引擎
- **@airalogy/aimd-recorder** - Vue AIMD 编辑器组件
- **@airalogy/components** - 通用 UI 组件

## 开发

### 脚本命令

```bash
# 类型检查
pnpm type-check

# 生产环境构建
pnpm build

# 构建类型声明
pnpm build:types
```

### 依赖

- `monaco-editor` - 编辑器实例（对等依赖）
- `@airalogy/aimd-core` - 核心 AIMD 功能
- `@codingame/monaco-vscode-*` - 语言工具

## 许可证

Airalogy 单体仓库的一部分。保留所有权利。
