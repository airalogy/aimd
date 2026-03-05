# @airalogy/aimd-recorder

`@airalogy/aimd-recorder` 提供记录场景所需的样式与可复用输入控件。

## 安装

```bash
pnpm add @airalogy/aimd-recorder @airalogy/aimd-core
```

## 核心能力

- 通过 `@airalogy/aimd-recorder/styles` 提供记录 UI 样式。
- 导出可复用题目控件 `AimdQuizRecorder`。
- 支持 `choice`、`blank`、`open` 三类作答输入。

## 示例

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
