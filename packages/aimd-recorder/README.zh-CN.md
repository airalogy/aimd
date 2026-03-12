# @airalogy/aimd-recorder

AIMD 记录 UI 组件与样式集合，包含协议内联录入组件与可复用题目作答控件。

内置变量控件支持 `CurrentTime`、`UserName`、`AiralogyMarkdown`。

## 安装

```bash
pnpm add @airalogy/aimd-recorder @airalogy/aimd-core
```

## 快速开始

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

通过 `locale` 可以切换 recorder 内建标签（`en-US` / `zh-CN`）。

`record` 数据结构：

```json
{
  "var": {},
  "step": {},
  "check": {},
  "quiz": {}
}
```

### 仅题目控件

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
  <AimdQuizRecorder v-model="answer" :quiz="quiz" locale="zh-CN" />
</template>
```

## 文档

- EN: <https://airalogy.github.io/aimd/en/packages/aimd-recorder>
- 中文: <https://airalogy.github.io/aimd/zh/packages/aimd-recorder>
- 文档源码：`aimd/docs/en/packages/aimd-recorder.md`、`aimd/docs/zh/packages/aimd-recorder.md`
