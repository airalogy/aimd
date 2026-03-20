# @airalogy/aimd-editor

`@airalogy/aimd-editor` 提供 AIMD 的 Monaco 语言集成，以及支持源码 / WYSIWYG 双模式的 Vue 编辑器。

## 安装

```bash
pnpm add @airalogy/aimd-editor monaco-editor
```

如果通过根入口使用 Vue 编辑器 API，还需要项目本身提供 `vue`。

## 入口

- `@airalogy/aimd-editor`：根入口。重导出整个包的完整 API，包括 Monaco 能力和 Vue 编辑器。
- `@airalogy/aimd-editor/monaco`：Monaco 语言配置与主题能力。
- `@airalogy/aimd-editor/vue`：显式 Vue 子入口，保留兼容和按需导入场景。

## Monaco 语言集成

```ts
import * as monaco from "monaco-editor"
import { language, conf, completionItemProvider } from "@airalogy/aimd-editor/monaco"

monaco.languages.register({ id: "aimd" })
monaco.languages.setMonarchTokensProvider("aimd", language)
monaco.languages.setLanguageConfiguration("aimd", conf)
monaco.languages.registerCompletionItemProvider("aimd", completionItemProvider)
```

## Vue 编辑器

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

如果要让编辑器填满一个已明确高度的父容器，可以设置 `:min-height="0"`。当 `minHeight` 为正数时，会保持现有的固定最小高度行为。

## 国际化

Vue 编辑器内建 `en-US` 和 `zh-CN` 两套 UI 文案。

如果不显式传入 `locale`，编辑器会按下面顺序自动推断：

1. `document.documentElement.lang`
2. `navigator.language`
3. `navigator.languages[0]`

凡是 `zh*` 都会归一化到 `zh-CN`，其他语言回退到 `en-US`。

```vue
<script setup lang="ts">
import { AimdEditor } from "@airalogy/aimd-editor"
</script>

<template>
  <AimdEditor locale="zh-CN" />
</template>
```

也可以通过 `messages` 覆盖内建文案：

```vue
<script setup lang="ts">
import { AimdEditor } from "@airalogy/aimd-editor"

const messages = {
  common: {
    insert: "添加",
  },
}
</script>

<template>
  <AimdEditor locale="zh-CN" :messages="messages" />
</template>
```

## UI Metadata Helper

如果你要自己封装 AIMD 工具栏或插入面板，推荐使用根入口导出的 typed helper：

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

如果希望扩展插入面板中的自定义 `var` 类型预设，可以使用 `createAimdVarTypePresets(...)`。
它的用途很简单：生成“`var` 插入面板里那些类型预设卡片”的数据，然后再通过 `AimdEditor` 的 `varTypePlugins` 传入。

另见：

- [`Type Plugins`](/zh/packages/type-plugins)

## 说明

- AIMD 协议语法关键字保持英文，例如 `type: choice`、`mode: single`。
- `AIMD_FIELD_TYPES` 和 `MD_TOOLBAR_ITEMS` 目前仍保留兼容导出，但更推荐使用 factory helper 生成本地化后的 UI metadata。

完整交互可参考 `aimd/demo` 中的编辑器示例页面。
