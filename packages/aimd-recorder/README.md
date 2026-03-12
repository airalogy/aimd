# @airalogy/aimd-recorder

Reusable recording UI for AIMD, including inline protocol recorder, quiz answer components, and styles.

Built-in variable input types include `CurrentTime`, `UserName`, and `AiralogyMarkdown`.

## Install

```bash
pnpm add @airalogy/aimd-recorder @airalogy/aimd-core
```

## Quick Start

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

Use `locale` to switch built-in recorder labels (`en-US` / `zh-CN`).

`record` shape:

```json
{
  "var": {},
  "step": {},
  "check": {},
  "quiz": {}
}
```

### Quiz Recorder Only

```vue
<script setup lang="ts">
import { ref } from "vue"
import { AimdQuizRecorder } from "@airalogy/aimd-recorder"
import "@airalogy/aimd-recorder/styles"

const answer = ref("")
const quiz = {
  id: "quiz_single_1",
  type: "choice",
  mode: "single",
  stem: "Pick one option",
  options: [
    { key: "A", text: "Option A" },
    { key: "B", text: "Option B" },
  ],
}
</script>

<template>
  <AimdQuizRecorder v-model="answer" :quiz="quiz" locale="en-US" />
</template>
```

## Documentation

- EN: <https://airalogy.github.io/aimd/en/packages/aimd-recorder>
- 中文: <https://airalogy.github.io/aimd/zh/packages/aimd-recorder>
- Source docs: `aimd/docs/en/packages/aimd-recorder.md`, `aimd/docs/zh/packages/aimd-recorder.md`
