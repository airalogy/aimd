# @airalogy/aimd-recorder

`@airalogy/aimd-recorder` provides AIMD recorder styles and reusable data-input components.

> Protocol-level AIMD syntax, assigner semantics, and validation rules are normative in Airalogy docs. This page only describes how `@airalogy/aimd-recorder` renders inputs and executes frontend-only recorder behavior.

## Install

```bash
pnpm add @airalogy/aimd-recorder @airalogy/aimd-core
```

## Main Capabilities

- Recorder UI styles via `@airalogy/aimd-recorder/styles`.
- Inline protocol recorder component: `AimdRecorder` (render + input in-place).
- Reusable quiz answer component: `AimdQuizRecorder`.
- Built-in var input handling for `CurrentTime`, `UserName`, `AiralogyMarkdown`, `DNASequence`.
- `AiralogyMarkdown` uses a full-width embedded AIMD/Markdown editor in recorder mode, opens in `Source` mode by default, keeps the full top toolbar, and still supports switching to `WYSIWYG`; when authored mid-sentence, recorder lifts it into its own block row instead of leaving it as a plain textarea-sized inline control.
- Input handling for `choice`, `blank`, and `open` quiz types.
- In recorder/edit mode, `ref_var` references display current var values as readonly inline content when available.
- Frontend-only `assigner runtime=client` blocks run locally for pure var computations.

## Example

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

For `mode: "manual"`, `AimdRecorder` exposes explicit trigger methods through the component ref:

```ts
recorderRef.value?.runClientAssigner("calculate_total_liquid_ml")
recorderRef.value?.runManualClientAssigners()
```

## Locale

`AiralogyMarkdown` renders a full-width embedded AIMD/Markdown editor in recorder mode, opens in `Source` mode by default, and still supports switching to `WYSIWYG`. Even when the field is authored in the middle of a sentence, recorder lifts it into its own block row so long-form content still gets a proper editing surface.

`DNASequence` uses a dedicated recorder widget with:

- a default `Interactive` mode focused on the visual viewer
- a separate `Raw structure` mode for sequence text and structured cleanup
- an optional top-level sequence name field for plasmid or construct naming
- shared toolbar actions for importing FASTA / GenBank sequence files and exporting the current value as a GenBank `.gbk` file
- interactive onboarding for pasting DNA text
- editable IUPAC DNA sequence text
- inline visual sequence viewer backed by `SeqViz`
- drag-to-select range creation and click-to-focus feature selection
- `linear` / `circular` topology
- GenBank-aligned feature annotations with multi-segment locations
- per-segment partial start / partial end flags
- qualifier rows for keys such as `gene`, `product`, `label`, and `note`
- an advanced editor panel for multi-segment and qualifier-heavy cleanup

Both `AimdRecorder` and `AimdQuizRecorder` accept `locale` to switch built-in recorder labels:

```vue
<AimdRecorder locale="zh-CN" />
<AimdQuizRecorder :quiz="quiz" locale="zh-CN" />
```

## Advanced

### Type Plugins

Use `typePlugins` when a host app needs per-type behavior rather than whole-field replacement.

Type plugins can define a custom initial value, normalization logic, display/parsing hooks, and even a fully custom recorder widget for one AIMD type token.

The built-in `AiralogyMarkdown` widget is implemented through this same path, so host apps can still override it with their own renderer if they need a different source/WYSIWYG workflow.

For the architecture and an end-to-end example, see:

- [`Type Plugins`](/en/packages/type-plugins)

If you need to fine-tune built-in recorder labels, override `messages`:

```vue
<script setup lang="ts">
import { AimdRecorder } from "@airalogy/aimd-recorder"
</script>

<template>
  <AimdRecorder
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

### Host Field Adapters

Use `fieldAdapters` when the host application needs to replace or wrap built-in recorder fields with its own components while still keeping AIMD parsing and record state in `AimdRecorder`.

```vue
<script setup lang="ts">
import { h } from "vue"
import { AimdRecorder } from "@airalogy/aimd-recorder"
</script>

<template>
  <AimdRecorder
    :content="content"
    :model-value="record"
    :field-adapters="{
      step: ({ node, defaultVNode }) =>
        h('step-card', {
          'step-id': node.id,
          'step-number': node.step,
          title: node.title || node.id,
          level: String(node.level),
        }, () => [defaultVNode]),
    }"
  />
</template>
```

Each adapter receives the parsed AIMD node, current field value, full record snapshot, built-in localized messages, and the default recorder vnode. `wrapField` still runs after adapter resolution, so host apps can keep global wrappers for validation or assigner chrome.

`AimdProtocolRecorder` is still exported as a deprecated compatibility alias, but new usage should prefer `AimdRecorder`.
