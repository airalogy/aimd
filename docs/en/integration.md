# Cross-Package Integration

This guide shows how to combine `@airalogy/aimd-editor`, `@airalogy/aimd-renderer`, and `@airalogy/aimd-recorder` in a single Vue 3 application to build a full AIMD authoring and recording workflow.

## Install

```bash
pnpm add @airalogy/aimd-core @airalogy/aimd-editor @airalogy/aimd-renderer @airalogy/aimd-recorder
pnpm add vue monaco-editor @vueuse/core naive-ui
```

## Basic Setup with Vue 3

The typical integration has three stages: **edit**, **preview**, and **record**. Each stage maps to one of the AIMD packages.

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

    <!-- Editor: author AIMD content -->
    <AimdEditor
      v-if="activeTab === 'edit'"
      v-model="content"
    />

    <!-- Preview: rendered HTML output -->
    <div
      v-if="activeTab === 'preview'"
      v-html="previewHtml"
    />

    <!-- Recorder: structured data input -->
    <AimdRecorder
      v-if="activeTab === 'record'"
      v-model="record"
      :content="content"
      locale="en-US"
    />
  </div>
</template>
```

## Field Extraction

Use `parseAndExtract` from the renderer to get structured metadata about all AIMD fields in the content. This is useful for building side panels, validation summaries, or progress tracking.

```ts
import { parseAndExtract } from "@airalogy/aimd-renderer"

const fields = parseAndExtract(content.value)

// fields.var       — list of variable IDs
// fields.step      — list of step IDs
// fields.check     — list of checkpoint IDs
// fields.quiz      — list of quiz definitions
// fields.var_table — list of table definitions with column metadata
// fields.fig       — list of figure definitions
```

## Configuration Options

### Editor Options

The `AimdEditor` component accepts several props:

```vue
<AimdEditor
  v-model="content"
  locale="en-US"
  :messages="customEditorMessages"
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `modelValue` | `string` | `""` | AIMD content (use with `v-model`) |
| `locale` | `"en-US" \| "zh-CN"` | auto-detected | UI language |
| `messages` | `AimdEditorMessagesInput` | built-in | Override specific UI labels |

Use the factory helpers to build toolbar metadata for custom UIs:

```ts
import {
  createAimdEditorMessages,
  createAimdFieldTypes,
  createMdToolbarItems,
} from "@airalogy/aimd-editor"

const messages = createAimdEditorMessages("en-US")
const fieldTypes = createAimdFieldTypes(messages)
const toolbarItems = createMdToolbarItems(messages)
```

### Renderer Options

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const { html } = await renderToHtml(content, {
  locale: "en-US",
  assignerVisibility: "hidden",   // "hidden" | "collapsed" | "expanded"
  mode: "preview",                // "preview" | "edit" | "report"
  math: true,                     // enable KaTeX math rendering
  gfm: true,                      // enable GFM tables, strikethrough, etc.
  groupStepBodies: true,          // fold trailing block content into step containers
  quizPreview: {
    showAnswers: false,            // reveal quiz answers in preview
    showRubric: false,             // reveal open-question rubrics
  },
})
```

Use `aimdElementRenderers` together with `createCustomElementAimdRenderer()` when the host preview surface needs to map AIMD nodes into custom elements.

For Vue vnode output instead of HTML strings:

```ts
import { renderToVue } from "@airalogy/aimd-renderer"

const { nodes, fields } = await renderToVue(content, {
  locale: "en-US",
})
```

### Recorder Options

```vue
<AimdRecorder
  v-model="record"
  :content="content"
  locale="en-US"
  current-user-name="Alice"
  :field-meta="fieldMetaMap"
  :field-state="fieldStateMap"
  :messages="customRecorderMessages"
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `modelValue` | `AimdProtocolRecordData` | Record data (use with `v-model`) |
| `content` | `string` | AIMD source content |
| `locale` | `"en-US" \| "zh-CN"` | UI language |
| `currentUserName` | `string` | Auto-fills `UserName` var fields |
| `fieldMeta` | `Record<string, AimdFieldMeta>` | Per-field metadata overrides |
| `fieldState` | `Record<string, AimdFieldState>` | Per-field runtime state |
| `fieldAdapters` | `AimdRecorderFieldAdapters` | Replace or wrap built-in recorder field UIs with host components |
| `messages` | `AimdRecorderMessagesInput` | Override specific recorder labels |

The record data shape:

```ts
interface AimdProtocolRecordData {
  var: Record<string, unknown>
  step: Record<string, AimdStepOrCheckRecordItem>
  check: Record<string, AimdStepOrCheckRecordItem>
  quiz: Record<string, unknown>
}
```

## Event Handling Across Packages

### Field Events from Recorder

The recorder emits events when users interact with fields. Listen for changes using `v-model` or watch the record data:

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

### Vue Injection Keys

The renderer provides Vue injection keys for event coordination between nested components:

```ts
import {
  fieldEventKey,
  protocolKey,
  draftEventKey,
  reportEventKey,
  bubbleMenuEventKey,
} from "@airalogy/aimd-renderer"
```

These are `InjectionKey` symbols used with Vue's `provide` / `inject` to pass event channels down the component tree.

### Client Assigners

Client-side assigners run JavaScript functions that compute derived field values. They are defined in the AIMD content and executed by the recorder.

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

For `mode: "manual"` assigners, trigger execution explicitly:

```ts
const recorderRef = ref<InstanceType<typeof AimdRecorder>>()

recorderRef.value?.runClientAssigner("calculate_total")
recorderRef.value?.runManualClientAssigners()
```

## Shared Localization

All three packages support `en-US` and `zh-CN`. Pass the same locale to each component for a consistent UI:

```vue
<AimdEditor locale="zh-CN" />

<AimdRecorder locale="zh-CN" />
```

```ts
const { html } = await renderToHtml(content, { locale: "zh-CN" })
```

Each package provides its own message factory for fine-grained label customization:

```ts
import { createAimdEditorMessages } from "@airalogy/aimd-editor"
import { createAimdRendererMessages } from "@airalogy/aimd-renderer"
import { createAimdRecorderMessages } from "@airalogy/aimd-recorder"
```

## Math and Styles

The renderer loads KaTeX math styles automatically when using the async `renderToHtml` or `renderToVue` APIs in browser environments. For server-side rendering or manual control, import styles explicitly:

```ts
import "@airalogy/aimd-renderer/styles"
```

The recorder has its own stylesheet:

```ts
import "@airalogy/aimd-recorder/styles"
```

## Full Working Example

See the `demo/` directory in the monorepo for a complete integration that wires all four packages together with routing, live preview, and recording. Run it locally:

```bash
pnpm dev:demo
```
