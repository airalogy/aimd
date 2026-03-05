# @airalogy/aimd-recorder

AIMD 记录 UI 组件与样式集合，包含可复用题目作答控件。

## 安装

```bash
pnpm add @airalogy/aimd-recorder @airalogy/aimd-core
```

## 快速开始

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

## 文档

- EN: <https://airalogy.github.io/aimd/en/packages/aimd-recorder>
- 中文: <https://airalogy.github.io/aimd/zh/packages/aimd-recorder>
- 文档源码：`aimd/docs/en/packages/aimd-recorder.md`、`aimd/docs/zh/packages/aimd-recorder.md`
