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
- Combined authoring + recording editor: `AimdRecorderEditor` (edit AIMD source and fill recorder data side by side).
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

## Recorder Editor

Use `AimdRecorderEditor` when the user needs to keep editing the AIMD protocol structure while continuing to fill the recorder on the same screen.

```vue
<script setup lang="ts">
import { ref } from "vue"
import {
  AimdRecorderEditor,
  createEmptyProtocolRecordData,
  type AimdProtocolRecordData,
} from "@airalogy/aimd-recorder"

const content = ref(`# Protocol

Sample: {{var|sample_name: str}}
Temperature: {{var|temperature: float}}
`)
const record = ref<AimdProtocolRecordData>(createEmptyProtocolRecordData())
</script>

<template>
  <AimdRecorderEditor
    v-model="record"
    v-model:content="content"
    locale="en-US"
    :show-record-data="true"
    :allow-raw-field-source-editing="false"
  />
</template>
```

`AimdRecorderEditor` keeps the editor and recorder bound to the same state, and it groups `Recorder`, `Record Data`, and detached-data views into a single right-side tab workspace so those auxiliary panels do not get pushed below a long AIMD document. By default, it also measures the remaining viewport space below the editor and stretches both columns to fill that space as much as possible, with internal scrolling on each side so the columns stay visually aligned; that balanced scroll behavior also applies when the recorder side is switched into visual editing. If the host still wants the separate `Field Structure` helper panel, pass `:show-field-structure="true"`. Its built-in structure editor still covers field-kind switching, id changes, inline `var` value-type changes, add/delete actions, and drag-to-reorder source fragments.

For non-technical users, the recorder panel now also exposes a recorder-aware WYSIWYG AIMD editor. Turn the header toggle on and the right side switches into a caret-based surface where `var`, `var_table`, `step`, `check`, and `quiz` fields render as their real recorder widgets instead of inline chips. Users can keep writing headings, normal Markdown blocks, and lists around those widgets, drag the rendered field nodes to any caret-valid position, and follow the visible drop indicator that appears during dragging for more precise placement. The contextual hover/focus toolbar attached to each rendered field keeps edit, delete, and drag actions on the widget itself. If the host does not want raw AIMD editing in that recorder-side dialog, set `:allow-raw-field-source-editing="false"` so only the structured field controls remain. Turn it off again to return to normal recorder entry; the current record state stays intact. When the current AIMD structure no longer contains a previously recorded field ID, the editor can surface that detached data in a dedicated tab so users can migrate values into newly created fields.

If the host prefers the previous fixed-height behavior, set `:fit-viewport="false"` and continue to size the editor with `editorMinHeight` / `recorderMinHeight`.

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
