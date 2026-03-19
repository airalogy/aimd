# @airalogy/aimd-recorder

Reusable recording UI for AIMD, including inline protocol recorder, quiz answer components, and styles.

Built-in variable input types include `CurrentTime`, `UserName`, `AiralogyMarkdown`, and `DNASequence`.
`AiralogyMarkdown` now uses a full-width embedded AIMD/Markdown editor in recorder mode, opens in `Source` mode by default, keeps the full top toolbar, and still supports switching to `WYSIWYG` instead of a plain textarea.
In recorder/edit mode, `ref_var` references display current var values as readonly inline content when available.
Frontend-only `assigner runtime=client` blocks are executed locally for pure var computations.

> Protocol-level AIMD syntax, assigner semantics, and validation rules are normative in Airalogy docs. `@airalogy/aimd-*` docs describe how the frontend parser, renderer, and recorder implement those rules.

## Install

```bash
pnpm add @airalogy/aimd-recorder @airalogy/aimd-core
```

## Quick Start

```vue
<script setup lang="ts">
import { ref } from "vue"
import {
  AimdRecorder,
  createEmptyProtocolRecordData,
  type AimdProtocolRecordData,
} from "@airalogy/aimd-recorder"
import "@airalogy/aimd-recorder/styles"

const content = ref(`# Protocol

Sample: {{var|sample_name: str}}
Operator: {{var|operator: UserName}}
Record Time: {{var|current_time: CurrentTime}}
Temperature: {{var|temperature: float = 25.0}}
Notes: {{var|notes: AiralogyMarkdown}}
Plasmid: {{var|plasmid: DNASequence}}`)
const record = ref<AimdProtocolRecordData>(createEmptyProtocolRecordData())
</script>

<template>
  <AimdRecorder
    v-model="record"
    :content="content"
    locale="en-US"
    current-user-name="Alice"
  />
</template>
```

`AiralogyMarkdown` fields render a full-width embedded AIMD/Markdown editor with the full top toolbar, default to `Source` mode, and still support switching to `WYSIWYG`. Even when the field is authored mid-sentence, recorder lifts it into its own block row instead of keeping it as a tiny inline control.

`DNASequence` fields render a dedicated DNA editor with:

- a default `Interactive` mode focused on the sequence viewer
- a separate `Raw structure` mode for sequence text and structured cleanup
- an optional top-level sequence name field for plasmid or construct naming
- shared toolbar actions for importing FASTA / GenBank sequence files and exporting the current value as a GenBank `.gbk` file
- interactive onboarding for pasting DNA text
- sequence input using IUPAC DNA letters
- topology toggle (`linear` / `circular`)
- GenBank-aligned feature rows with multi-segment locations
- partial start / partial end flags per segment
- qualifier rows such as `gene`, `product`, `label`, and `note`

Use `locale` to switch built-in recorder labels (`en-US` / `zh-CN`).
`AimdProtocolRecorder` is still available as a deprecated compatibility alias, but new code should use `AimdRecorder`.

`record` shape:

```json
{
  "var": {},
  "step": {},
  "check": {},
  "quiz": {}
}
```

Client assigner example:

````aimd
Water: {{var|water_volume_ml: float}}
Lemon: {{var|lemon_juice_ml: float}}
Total: {{var|total_liquid_ml: float}}

```assigner runtime=client
assigner(
  {
    mode: "auto",
    dependent_fields: ["water_volume_ml", "lemon_juice_ml"],
    assigned_fields: ["total_liquid_ml"],
  },
  function calculate_total_liquid_ml({ water_volume_ml, lemon_juice_ml }) {
    return {
      total_liquid_ml: Math.round((water_volume_ml + lemon_juice_ml) * 100) / 100,
    };
  }
);
```
````

For `mode: "manual"`, the component exposes explicit trigger methods through the Vue ref:

```ts
recorderRef.value?.runClientAssigner("calculate_total_liquid_ml")
recorderRef.value?.runManualClientAssigners()
```

## Host Field Adapters

```ts
import { h } from "vue"

const fieldAdapters = {
  step: ({ node, defaultVNode }) =>
    h("step-card", {
      "step-id": node.id,
      "step-number": node.step,
      title: node.title || node.id,
      level: String(node.level),
    }, () => [defaultVNode]),
}
```

Pass `fieldAdapters` to `AimdRecorder` when the host app needs to replace or wrap built-in recorder field UIs while still using AIMD parsing and record-state management.

If the host app needs per-type behavior instead, use `typePlugins`. A type plugin can define the initial value, normalization, display/parsing hooks, and even a dedicated widget for one specific AIMD type token.

The built-in `AiralogyMarkdown` editor uses this same extension path, so a host plugin can still replace it if needed.

See:

- `aimd/docs/en/packages/type-plugins.md`

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
