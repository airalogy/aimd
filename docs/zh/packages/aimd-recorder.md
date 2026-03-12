# @airalogy/aimd-recorder

`@airalogy/aimd-recorder` 提供 AIMD 记录场景的样式与 Vue 录入组件。

## 安装

```bash
pnpm add @airalogy/aimd-recorder @airalogy/aimd-core
```

## 核心能力

- 通过 `@airalogy/aimd-recorder/styles` 提供 recorder 样式。
- 提供协议内联录入组件 `AimdProtocolRecorder`：
  在 Markdown 渲染位置直接插入 `var / var_table / step / check / quiz` 的记录控件。
- 提供可复用题目控件 `AimdQuizRecorder`（单独使用 quiz 输入时可复用）。
- 内置变量控件支持 `CurrentTime`、`UserName`、`AiralogyMarkdown`。

## 协议内联录入示例（推荐）

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

样本名：{{var|sample_name: str}}
记录者：{{var|operator: UserName}}
记录时间：{{var|current_time: CurrentTime}}
实验摘要：{{var|summary: AiralogyMarkdown}}`)
const record = ref<AimdProtocolRecordData>(createEmptyProtocolRecordData())
</script>

<template>
  <AimdProtocolRecorder
    v-model="record"
    :content="content"
    locale="zh-CN"
    current-user-name="张三"
  />
</template>
```

`record` 数据结构：

```json
{
  "var": {},
  "step": {},
  "check": {},
  "quiz": {}
}
```

## 语言

`AimdProtocolRecorder` 和 `AimdQuizRecorder` 都支持通过 `locale` 切换内建标签：

```vue
<AimdProtocolRecorder locale="zh-CN" />
<AimdQuizRecorder :quiz="quiz" locale="zh-CN" />
```

## 进阶

如果需要微调 recorder 的内建标签，也可以覆盖 `messages`：

```vue
<script setup lang="ts">
import { AimdProtocolRecorder } from "@airalogy/aimd-recorder"
</script>

<template>
  <AimdProtocolRecorder
    locale="zh-CN"
    :messages="{
      step: {
        annotationPlaceholder: '步骤备注',
      },
      table: {
        addRow: '新增一行',
      },
    }"
  />
</template>
```

## 仅题目控件示例

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
  stem: "请选择一个选项",
  options: [
    { key: "A", text: "选项 A" },
    { key: "B", text: "选项 B" },
  ],
}
</script>

<template>
  <AimdQuizRecorder v-model="answer" :quiz="quiz" />
</template>
```
