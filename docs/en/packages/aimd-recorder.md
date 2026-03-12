# @airalogy/aimd-recorder

`@airalogy/aimd-recorder` provides AIMD recorder styles and reusable data-input components.

## Install

```bash
pnpm add @airalogy/aimd-recorder @airalogy/aimd-core
```

## Main Capabilities

- Recorder UI styles via `@airalogy/aimd-recorder/styles`.
- Inline protocol recorder component: `AimdProtocolRecorder` (render + input in-place).
- Reusable quiz answer component: `AimdQuizRecorder`.
- Built-in var input handling for `CurrentTime`, `UserName`, `AiralogyMarkdown`.
- Input handling for `choice`, `blank`, and `open` quiz types.

## Example

```vue
<script setup lang="ts">
import { ref } from "vue"
import {
  AimdProtocolRecorder,
  createEmptyProtocolRecordData,
  type AimdProtocolRecordData,
} from "@airalogy/aimd-recorder"
import "@airalogy/aimd-recorder/styles"

const content = ref(`# Protocol

Sample: {{var|sample_name: str}}
Operator: {{var|operator: UserName}}
Record Time: {{var|current_time: CurrentTime}}
Notes: {{var|notes: AiralogyMarkdown}}`)
const record = ref<AimdProtocolRecordData>(createEmptyProtocolRecordData())
</script>

<template>
  <AimdProtocolRecorder
    v-model="record"
    :content="content"
    locale="en-US"
    current-user-name="Alice"
  />
</template>
```

`record` shape:

```json
{
  "var": {},
  "step": {},
  "check": {},
  "quiz": {}
}
```

## Locale

Both `AimdProtocolRecorder` and `AimdQuizRecorder` accept `locale` to switch built-in recorder labels:

```vue
<AimdProtocolRecorder locale="zh-CN" />
<AimdQuizRecorder :quiz="quiz" locale="zh-CN" />
```

## Advanced

If you need to fine-tune built-in recorder labels, override `messages`:

```vue
<script setup lang="ts">
import { AimdProtocolRecorder } from "@airalogy/aimd-recorder"
</script>

<template>
  <AimdProtocolRecorder
    locale="en-US"
    :messages="{
      step: {
        annotationPlaceholder: 'Step notes',
      },
      table: {
        addRow: 'Append row',
      },
    }"
  />
</template>
```
