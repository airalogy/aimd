# @airalogy/aimd-recorder

AIMD 记录 UI 组件与样式集合，包含协议内联录入组件与可复用题目作答控件。

内置变量控件支持 `CurrentTime`、`UserName`、`AiralogyMarkdown` 和 `DNASequence`。
在 recorder/edit 模式下，`ref_var` 如果已经有记录值，会优先以只读内联内容显示该值。
前端受限的 `assigner runtime=client` 代码块会在 recorder 中本地执行，用于纯 `var` 计算。

> 协议级 AIMD 语法、assigner 语义与校验规则以 Airalogy 文档为准；`@airalogy/aimd-*` 文档只描述前端 parser、renderer、recorder 如何实现这些规范。

## 安装

```bash
pnpm add @airalogy/aimd-recorder @airalogy/aimd-core
```

## 快速开始

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

样本名：{{var|sample_name: str}}
记录者：{{var|operator: UserName}}
记录时间：{{var|current_time: CurrentTime}}
温度设置：{{var|temperature: float = 25.0}}
实验摘要：{{var|summary: AiralogyMarkdown}}
质粒：{{var|plasmid: DNASequence}}`)
const record = ref<AimdProtocolRecordData>(createEmptyProtocolRecordData())
</script>

<template>
  <AimdRecorder
    v-model="record"
    :content="content"
    locale="zh-CN"
    current-user-name="张三"
  />
</template>
```

`DNASequence` 字段会渲染一个专用 DNA 编辑器，支持：

- 默认以 `交互式` 模式进行可视化编辑
- 单独提供 `原始结构` 模式处理序列原文和结构化精修
- 可选的顶层序列名称字段，可用于质粒或构建体命名
- 共享工具栏可导入 FASTA / GenBank 序列文件，并将当前值导出为 GenBank `.gbk` 文件
- 交互式空状态下可直接粘贴 DNA 文本
- IUPAC DNA 序列输入
- 拓扑切换（`linear` / `circular`）
- GenBank 对齐子集风格的特征编辑
- 多段位置片段（segments）与每段的 partial 标记
- `gene`、`product`、`label`、`note` 等限定词行编辑

通过 `locale` 可以切换 recorder 内建标签（`en-US` / `zh-CN`）。
`AimdProtocolRecorder` 仍保留为已废弃的兼容别名，但新的代码建议直接使用 `AimdRecorder`。

`record` 数据结构：

```json
{
  "var": {},
  "step": {},
  "check": {},
  "quiz": {}
}
```

client assigner 示例：

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

如果使用 `mode: "manual"`，组件会通过 Vue ref 暴露显式触发方法：

```ts
recorderRef.value?.runClientAssigner("calculate_total_liquid_ml")
recorderRef.value?.runManualClientAssigners()
```

## 宿主字段适配器

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

当宿主应用需要替换或包裹内建字段 UI，但仍希望继续复用 AIMD 解析和 recorder record-state 管理时，可以把 `fieldAdapters` 传给 `AimdRecorder`。

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
