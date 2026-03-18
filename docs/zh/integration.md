# 跨包集成

本指南展示如何在同一个 Vue 3 应用中组合 `@airalogy/aimd-editor`、`@airalogy/aimd-renderer` 与 `@airalogy/aimd-recorder`，构建完整的 AIMD 编写与记录工作流。

## 安装

```bash
pnpm add @airalogy/aimd-core @airalogy/aimd-editor @airalogy/aimd-renderer @airalogy/aimd-recorder
pnpm add vue monaco-editor @vueuse/core naive-ui
```

## Vue 3 基础接入

典型集成一般分为三个阶段：**编辑**、**预览** 与 **记录**。每个阶段分别对应一个 AIMD 包。

```vue
<script setup lang="ts">
import { ref, watch } from "vue"
import { AimdEditor } from "@airalogy/aimd-editor"
import { renderToHtml, parseAndExtract } from "@airalogy/aimd-renderer"
import {
  AimdRecorder,
  createEmptyProtocolRecordData,
  type AimdProtocolRecordData,
} from "@airalogy/aimd-recorder"
import "@airalogy/aimd-recorder/styles"

const content = ref(`# My Protocol

Sample Name: {{var|sample_name: str}}
Temperature: {{var|temperature: float = 25.0}}

{{step|preparation}}
Prepare the workspace.

{{step|measurement}}
Record the measurement.

{{check|safety_check}}
`)

const previewHtml = ref("")
const record = ref<AimdProtocolRecordData>(createEmptyProtocolRecordData())
const activeTab = ref<"edit" | "preview" | "record">("edit")

watch(content, async (value) => {
  const { html } = await renderToHtml(value)
  previewHtml.value = html
}, { immediate: true })
</script>

<template>
  <div class="aimd-app">
    <nav>
      <button @click="activeTab = 'edit'">Edit</button>
      <button @click="activeTab = 'preview'">Preview</button>
      <button @click="activeTab = 'record'">Record</button>
    </nav>

    <AimdEditor
      v-if="activeTab === 'edit'"
      v-model="content"
    />

    <div
      v-if="activeTab === 'preview'"
      v-html="previewHtml"
    />

    <AimdRecorder
      v-if="activeTab === 'record'"
      v-model="record"
      :content="content"
      locale="zh-CN"
    />
  </div>
</template>
```

## 字段提取

通过 renderer 的 `parseAndExtract` 可以拿到内容里的结构化 AIMD 字段元数据。这很适合用来构建侧边栏、校验摘要或进度跟踪。

```ts
import { parseAndExtract } from "@airalogy/aimd-renderer"

const fields = parseAndExtract(content.value)

// fields.var       — 变量 ID 列表
// fields.step      — 步骤 ID 列表
// fields.check     — 检查点 ID 列表
// fields.quiz      — 题目定义列表
// fields.var_table — 带列元数据的表格定义
// fields.fig       — figure 定义列表
```

## 配置项

### Editor 配置

`AimdEditor` 支持以下 props：

```vue
<AimdEditor
  v-model="content"
  locale="zh-CN"
  :messages="customEditorMessages"
/>
```

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `modelValue` | `string` | `""` | AIMD 内容（配合 `v-model`） |
| `locale` | `"en-US" \| "zh-CN"` | 自动判断 | UI 语言 |
| `messages` | `AimdEditorMessagesInput` | 内建文案 | 覆盖部分 UI 文案 |

自定义工具栏 UI 时，可用以下工厂函数构造元数据：

```ts
import {
  createAimdEditorMessages,
  createAimdFieldTypes,
  createMdToolbarItems,
} from "@airalogy/aimd-editor"

const messages = createAimdEditorMessages("zh-CN")
const fieldTypes = createAimdFieldTypes(messages)
const toolbarItems = createMdToolbarItems(messages)
```

### Renderer 配置

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const { html } = await renderToHtml(content, {
  locale: "zh-CN",
  assignerVisibility: "hidden",   // "hidden" | "collapsed" | "expanded"
  mode: "preview",                // "preview" | "edit" | "report"
  math: true,                     // 启用 KaTeX 数学公式
  gfm: true,                      // 启用 GFM 表格、删除线等
  groupStepBodies: true,          // 将步骤后的块级正文归并进步骤容器
  quizPreview: {
    showAnswers: false,           // 预览中是否显示答案
    showRubric: false,            // 是否显示开放题 rubric
  },
})
```

如果你需要把 AIMD 节点映射成宿主应用自己的自定义元素，请配合 `aimdElementRenderers` 和 `createCustomElementAimdRenderer()` 使用。

如果你更希望拿到 Vue vnode 而不是 HTML 字符串：

```ts
import { renderToVue } from "@airalogy/aimd-renderer"

const { nodes, fields } = await renderToVue(content, {
  locale: "zh-CN",
})
```

### Recorder 配置

```vue
<AimdRecorder
  v-model="record"
  :content="content"
  locale="zh-CN"
  current-user-name="Alice"
  :field-meta="fieldMetaMap"
  :field-state="fieldStateMap"
  :field-adapters="fieldAdapters"
  :messages="customRecorderMessages"
/>
```

| Prop | 类型 | 说明 |
|------|------|------|
| `modelValue` | `AimdProtocolRecordData` | 记录数据（配合 `v-model`） |
| `content` | `string` | AIMD 源内容 |
| `locale` | `"en-US" \| "zh-CN"` | UI 语言 |
| `currentUserName` | `string` | 自动填充 `UserName` 类型变量 |
| `fieldMeta` | `Record<string, AimdFieldMeta>` | 每字段元数据覆盖 |
| `fieldState` | `Record<string, AimdFieldState>` | 每字段运行时状态 |
| `fieldAdapters` | `AimdRecorderFieldAdapters` | 用宿主组件替换或包裹内建字段 UI |
| `messages` | `AimdRecorderMessagesInput` | 覆盖部分 recorder 文案 |

记录数据结构：

```ts
interface AimdProtocolRecordData {
  var: Record<string, unknown>
  step: Record<string, AimdStepOrCheckRecordItem>
  check: Record<string, AimdStepOrCheckRecordItem>
  quiz: Record<string, unknown>
}
```

## 跨包事件处理

### Recorder 字段事件

用户在 recorder 中操作字段时会触发事件。通常用 `v-model` 监听，或者直接 watch 整个 record：

```vue
<script setup lang="ts">
import { watch } from "vue"

watch(record, (newRecord) => {
  console.log("Variables:", newRecord.var)
  console.log("Steps:", newRecord.step)
  console.log("Checks:", newRecord.check)
  console.log("Quizzes:", newRecord.quiz)
}, { deep: true })
</script>
```

### Vue 注入 Key

renderer 暴露了一组 Vue injection key，用于嵌套组件间的事件协作：

```ts
import {
  fieldEventKey,
  protocolKey,
  draftEventKey,
  reportEventKey,
  bubbleMenuEventKey,
} from "@airalogy/aimd-renderer"
```

它们都是 `InjectionKey`，可配合 Vue 的 `provide` / `inject` 传递事件通道。

### Client Assigners

client assigner 会执行 JavaScript 函数，用于计算派生字段值。它们写在 AIMD 内容中，并由 recorder 执行。

```aimd
Water: {{var|water_ml: float}}
Lemon: {{var|lemon_ml: float}}
Total: {{var|total_ml: float}}

```assigner runtime=client
assigner(
  {
    mode: "auto",
    dependent_fields: ["water_ml", "lemon_ml"],
    assigned_fields: ["total_ml"],
  },
  function calculate_total({ water_ml, lemon_ml }) {
    return { total_ml: water_ml + lemon_ml };
  }
);
```

对于 `mode: "manual"` 的 assigner，需要显式触发：

```ts
const recorderRef = ref<InstanceType<typeof AimdRecorder>>()

recorderRef.value?.runClientAssigner("calculate_total")
recorderRef.value?.runManualClientAssigners()
```

## 共享本地化

三个包都支持 `en-US` 与 `zh-CN`。将同一个 locale 传给各组件，可以保证整体 UI 一致：

```vue
<AimdEditor locale="zh-CN" />

<AimdRecorder locale="zh-CN" />
```

```ts
const { html } = await renderToHtml(content, { locale: "zh-CN" })
```

每个包都提供自己的消息工厂函数，可用于更细粒度地覆盖文案：

```ts
import { createAimdEditorMessages } from "@airalogy/aimd-editor"
import { createAimdRendererMessages } from "@airalogy/aimd-renderer"
import { createAimdRecorderMessages } from "@airalogy/aimd-recorder"
```

## 数学公式与样式

在浏览器环境中调用异步 `renderToHtml` 或 `renderToVue` 时，renderer 会自动加载 KaTeX 样式。若你在 SSR 或需要手动控制加载时机，可显式引入：

```ts
import "@airalogy/aimd-renderer/styles"
```

recorder 也有自己的样式入口：

```ts
import "@airalogy/aimd-recorder/styles"
```

## 完整示例

仓库里的 `demo/` 目录提供了一个完整接入示例，串起了这四个包的路由、实时预览和记录流程。本地运行：

```bash
pnpm dev:demo
```
