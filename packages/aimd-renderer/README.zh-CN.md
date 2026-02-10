# @airalogy/aimd-renderer

> AIMD 渲染引擎 - HTML 和 Vue

## 概述

本包提供用于将 AIMD（Airalogy Markdown）AST 转换为 HTML 和 Vue 虚拟节点的渲染引擎。包含用于解析 AIMD 内容的处理器和不同输出格式的灵活渲染器。

## 功能特性

- 🎨 **HTML 渲染** - 将 AIMD 转换为带有语法高亮的 HTML
- 🖼️ **Vue 渲染** - 为反应式组件生成 Vue 虚拟节点
- 🧩 **模块化渲染器** - 可插拔的代码块、资源等渲染器
- 📝 **自定义渲染规则** - 为 AIMD 元素定义自定义渲染行为
- 🔌 **插件系统** - 使用自定义插件扩展功能
- ⚡ **性能优化** - 针对同步和异步渲染进行了优化

## 安装

```bash
pnpm add @airalogy/aimd-renderer @airalogy/aimd-core
```

## 使用

### 基础 HTML 渲染

```typescript
import { renderToHtml, renderToHtmlSync } from '@airalogy/aimd-renderer'

const content = `
# 研究协议

{{var|sample_name: str}}
{{step|sample_preparation}}
`

// 异步渲染
const { html, fields } = await renderToHtml(content)
console.log(html)
console.log(fields)

// 同步渲染
const { html: htmlSync, fields: fieldsSync } = renderToHtmlSync(content)
```

### Vue 渲染

```typescript
import { renderToVue, createComponentRenderer } from '@airalogy/aimd-renderer'

const content = `...`

// 渲染为 Vue 虚拟节点
const { nodes, fields } = await renderToVue(content, {
  renderers: createComponentRenderer({
    // 自定义组件映射
  })
})
```

### 高级处理器创建

```typescript
import { createRenderer } from '@airalogy/aimd-renderer'

const processor = createRenderer({
  // 自定义渲染选项
  extractFields: true,
  includeMeta: true,
})

const { html, fields } = await processor.toHtml(content)
console.log(html)
console.log(fields)
```

### 自定义资源渲染

```typescript
import { createAssetRenderer } from '@airalogy/aimd-renderer'

const assetRenderer = createAssetRenderer({
  resolveUrl: async (assetPath) => {
    return `/assets/${assetPath}`
  },
  cache: true,
})
```

### 代码块高亮

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

### Mermaid 图表渲染

```typescript
import { createMermaidRenderer } from '@airalogy/aimd-renderer'

const mermaidRenderer = createMermaidRenderer({
  theme: 'default',
  securityLevel: 'loose',
})
```

## 导出

### 主入口 (`@airalogy/aimd-renderer`)

#### 处理函数
- `createHtmlProcessor()` - 创建 HTML 渲染处理器
- `createRenderer()` - 创建带有选项的自定义渲染器
- `defaultRenderer` - 默认 renderer 实例（`createRenderer()` 的结果）
- `renderToHtml(content, options?)` - 渲染为 HTML 字符串（异步）
- `renderToHtmlSync(content, options?)` - 渲染为 HTML 字符串（同步）
- `renderToVue(content, options?)` - 渲染为 Vue 虚拟节点
- `parseAndExtract(content, options?)` - 解析并提取 AIMD 字段

#### 渲染器创建
- `createComponentRenderer(options)` - 创建 Vue 组件渲染器
- `createAssetRenderer(options)` - 创建资源解析器
- `createCodeBlockRenderer(options)` - 创建代码块渲染器
- `createEmbeddedRenderer(options)` - 创建嵌入内容渲染器
- `createMermaidRenderer(options)` - 创建 Mermaid 图表渲染器

#### 工具函数
- `hastToVue(hastNode, options?)` - 将 HAST 转换为 Vue vNodes
- `createUnifiedTokenRenderer(options)` - 创建基于令牌的渲染器
- `renderToVNodes(hastNode, options?)` - 将 HAST 根节点渲染为 Vue vNodes
- `getFinalIndent(item)` - 计算最终缩进
- `parseFieldTag(template)` - 解析 AIMD 字段标签

#### 事件键
- `fieldEventKey` - 字段交互的事件键
- `draftEventKey` - 草稿更改的事件键
- `protocolKey` - 协议更新的事件键
- `reportEventKey` - 报告生成的事件键
- `bubbleMenuEventKey` - 气泡菜单的事件键

### HTML 入口 (`@airalogy/aimd-renderer/html`)

HTML 特定渲染导出：
- `createHtmlProcessor()`
- `renderToHtml()`
- `renderToHtmlSync()`
- `parseAndExtract()`

### Vue 入口 (`@airalogy/aimd-renderer/vue`)

Vue 特定渲染导出：
- `renderToVue()`
- `createRenderer()`
- 所有组件渲染器和工具函数

## 类型

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

## 支持的 AIMD 元素

渲染器处理所有 AIMD 语法元素：

- **变量**: `{{var|name: type}}`
- **变量表**: `{{var_table|table_name, subvars=[col1, col2]}}`
- **步骤**: `{{step|step_name}}`
- **检查**: `{{check|check_name}}`
- **引用**: `{{ref_var|name}}`、`{{ref_step|name}}`
- **嵌入内容**: 代码块、图像、图表
- **数学表达式**: KaTeX/MathML 支持

## 配置选项

### ProcessorOptions
- `extractFields?: boolean` - 提取 AIMD 字段
- `includeMeta?: boolean` - 在结果中包含元数据
- `customRules?: TokenRenderRule[]` - 自定义渲染规则
- `assets?: AssetResolverOptions` - 资源解析选项

## 性能

### 同步 vs 异步

- 对于不需要外部资源的简单内容，使用 `renderToHtmlSync()`
- 当需要解析资源或需要远程资源时，使用 `renderToHtml()`

### 缓存

资源渲染器支持缓存以提高性能：

```typescript
const renderer = createAssetRenderer({
  cache: true,
  cacheSize: 100,
})
```

## 集成示例

### 与 Vue 组件集成

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

### 与自定义组件映射集成

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

## 许可证

Airalogy 单体仓库的一部分。保留所有权利。
