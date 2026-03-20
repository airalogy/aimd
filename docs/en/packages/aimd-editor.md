# @airalogy/aimd-editor

`@airalogy/aimd-editor` provides Monaco language integration and a Vue AIMD editor with source/WYSIWYG workflows.

## Install

```bash
pnpm add @airalogy/aimd-editor monaco-editor
```

`vue` is required when using the Vue editor APIs from the root entry.

## Entry Points

- `@airalogy/aimd-editor`: root entry. Re-exports the full package API, including Monaco integration and the Vue editor.
- `@airalogy/aimd-editor/monaco`: Monaco language config and theme helpers.
- `@airalogy/aimd-editor/vue`: explicit Vue subpath, kept for compatibility and focused imports.

## Monaco Language Integration

```ts
import * as monaco from "monaco-editor"
import { language, conf, completionItemProvider } from "@airalogy/aimd-editor/monaco"

monaco.languages.register({ id: "aimd" })
monaco.languages.setMonarchTokensProvider("aimd", language)
monaco.languages.setLanguageConfiguration("aimd", conf)
monaco.languages.registerCompletionItemProvider("aimd", completionItemProvider)
```

## Vue Editor

```vue
<script setup lang="ts">
import { ref } from "vue"
import { AimdEditor } from "@airalogy/aimd-editor"

const content = ref("")
</script>

<template>
  <AimdEditor v-model="content" />
</template>
```

To let the editor fill a parent with an explicit height, set `:min-height="0"`. Positive `minHeight` values keep the existing fixed editor-height behavior.

## Localization

The Vue editor includes built-in `en-US` and `zh-CN` UI messages.

If `locale` is omitted, the editor resolves locale from runtime hints in this order:

1. `document.documentElement.lang`
2. `navigator.language`
3. `navigator.languages[0]`

Any `zh*` locale resolves to `zh-CN`. Other locales fall back to `en-US`.

```vue
<script setup lang="ts">
import { AimdEditor } from "@airalogy/aimd-editor"
</script>

<template>
  <AimdEditor locale="zh-CN" />
</template>
```

Use `messages` to override built-in copy:

```vue
<script setup lang="ts">
import { AimdEditor } from "@airalogy/aimd-editor"

const messages = {
  common: {
    insert: "Add",
  },
}
</script>

<template>
  <AimdEditor locale="en-US" :messages="messages" />
</template>
```

## UI Metadata Helpers

If you build your own AIMD toolbar or insertion UI, use the typed helpers from the root entry:

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

Custom var type presets for the insertion dialog can be built with `createAimdVarTypePresets(...)`.
Its job is simple: generate the data for the type preset cards shown in the `var` insertion panel, then pass that data into `AimdEditor` through `varTypePlugins`.

See also:

- [`Type Plugins`](/en/packages/type-plugins)

## Notes

- AIMD syntax keywords remain English, such as `type: choice` and `mode: single`.
- `AIMD_FIELD_TYPES` and `MD_TOOLBAR_ITEMS` are legacy compatibility exports. Prefer the factory helpers for localized UI metadata.

For a full interactive integration, refer to the editor demo in `aimd/demo`.
