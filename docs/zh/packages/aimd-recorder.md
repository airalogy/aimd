# @airalogy/aimd-recorder

`@airalogy/aimd-recorder` 提供 AIMD 记录场景的样式与 Vue 录入组件。

> 协议级 AIMD 语法、assigner 语义与校验规则以 Airalogy 文档为准；本页只描述 `@airalogy/aimd-recorder` 如何在前端渲染录入控件并执行本地 recorder 行为。

## 安装

```bash
pnpm add @airalogy/aimd-recorder @airalogy/aimd-core
```

## 核心能力

- 通过 `@airalogy/aimd-recorder/styles` 提供 recorder 样式。
- 提供协议内联录入组件 `AimdRecorder`：
  在 Markdown 渲染位置直接插入 `var / var_table / step / check / quiz` 的记录控件。
- 提供组合式编辑器组件 `AimdRecorderEditor`：
  在同一屏里同时编辑 AIMD 源码并填写 recorder 数据。
- 提供可复用题目控件 `AimdQuizRecorder`（单独使用 quiz 输入时可复用）。
- 内置变量控件支持 `CurrentTime`、`UserName`、`AiralogyMarkdown`、`DNASequence`。
- `AiralogyMarkdown` 在 recorder 中会以横铺内嵌编辑器呈现，默认进入 `源码` 模式，保留完整顶部工具栏，并支持切换到 `所见即所得`；如果它写在一行文字中间，recorder 会自动把它提升成下一行的块级编辑区，而不是普通 textarea。
- 在 recorder/edit 模式下，`ref_var` 如果已经有记录值，会优先以只读内联内容显示该值。
- 前端受限的 `assigner runtime=client` 代码块会在 recorder 中本地执行，用于纯 `var` 计算。

## 协议内联录入示例（推荐）

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

`record` 数据结构：

```json
{
  "var": {},
  "step": {},
  "check": {},
  "quiz": {}
}
```

## Recorder Editor

如果用户需要一边改 AIMD Protocol 结构，一边继续填写 recorder 数据，可以使用 `AimdRecorderEditor`。

```vue
<script setup lang="ts">
import { ref } from "vue"
import {
  AimdRecorderEditor,
  createEmptyProtocolRecordData,
  type AimdProtocolRecordData,
} from "@airalogy/aimd-recorder"

const content = ref(`# Protocol

样本名：{{var|sample_name: str}}
温度：{{var|temperature: float}}
`)
const record = ref<AimdProtocolRecordData>(createEmptyProtocolRecordData())
</script>

<template>
  <AimdRecorderEditor
    v-model="record"
    v-model:content="content"
    locale="zh-CN"
    :show-record-data="true"
    :allow-raw-field-source-editing="false"
  />
</template>
```

`AimdRecorderEditor` 会把编辑器和 recorder 绑定到同一份状态上，同时把 `Recorder`、`Record Data`、`脱离当前 Protocol 的旧数据` 收到右侧同一组 tab 里，避免 AIMD 很长时这些辅助面板被推到页面底部。默认情况下，它会根据当前 editor 在页面中的位置和浏览器剩余可用高度自动调整左右两列，让工作区尽量撑满视口；左右两列都在各自面板内部滚动，因此长协议下仍然保持对齐，这个同高滚动行为也会覆盖 recorder 侧的可视化编辑模式。如果宿主还想保留独立的 `Field 结构编辑` 面板，可以显式传 `:show-field-structure="true"`。内建结构编辑器仍然支持切换 field kind、修改 id、修改内联 `var` 的值类型、新增/删除字段，以及拖拽重排源码片段。

对于不理解 AIMD 源码的用户，recorder 面板里现在还提供了一个 recorder-aware 的 WYSIWYG 编辑模式。打开标题栏里的切换后，右侧会直接切到一个可落光标的 AIMD 编辑面，其中 `var`、`var_table`、`step`、`check`、`quiz` 会直接显示成真实的 recorder widget，而不是普通小 chip。用户可以继续在这些 widget 周围补充标题、普通 Markdown、列表，也可以把渲染后的 field 拖到任意可落光标的位置；拖动过程中会出现明确的落点提示，方便更精确地放置。贴在 field 本体上的 hover / focus 工具条则继续提供编辑、删除和拖动，不需要跳出当前 widget。如果宿主不希望用户在 recorder 侧直接编辑 raw AIMD，可以设置 `:allow-raw-field-source-editing="false"`，这样字段弹窗里只保留结构化编辑控件。关闭切换后再回到正常 recorder 录入，record 数据状态会继续保留。当当前 AIMD 结构里已经没有某个旧字段 id 时，editor 可以把这些脱离当前 protocol 的旧数据放进单独 tab，方便用户把值迁移到新建 field。

如果宿主希望退回旧的定高模式，可以设置 `:fit-viewport="false"`，并继续通过 `editorMinHeight` / `recorderMinHeight` 控制固定高度。

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

如果使用 `mode: "manual"`，`AimdRecorder` 会通过组件 ref 暴露显式触发方法：

```ts
recorderRef.value?.runClientAssigner("calculate_total_liquid_ml")
recorderRef.value?.runManualClientAssigners()
```

## 宿主字段适配器

当宿主应用希望用自己的组件替换或包裹 recorder 的内建字段，但仍保留 AIMD 解析和记录状态管理时，可以使用 `fieldAdapters`：

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

每个 adapter 都会拿到解析后的 AIMD 节点、当前字段值、完整 record 快照、内建本地化消息，以及 recorder 默认生成的 vnode。`wrapField` 会在 adapter 解析之后继续执行，因此宿主应用仍然可以保留统一的校验外壳或 assigner UI 包裹层。

## 语言

`AiralogyMarkdown` 在 recorder 中会渲染一个横铺内嵌的 AIMD/Markdown 编辑器，默认进入 `源码` 模式，并支持切换到 `所见即所得`；即使字段写在一行文字中间，recorder 也会把它提升成下一行的块级编辑区，因此普通用户和偏源码工作的用户都可以直接在协议上下文里编辑长文本内容。

`DNASequence` 会渲染专用 DNA 录入控件，支持：

- 默认以 `交互式` 模式提供可视化编辑
- 单独提供 `原始结构` 模式处理序列原文和结构化精修
- 可选的顶层序列名称字段，可用于质粒或构建体命名
- 共享工具栏可导入 FASTA / GenBank 序列文件，并将当前值导出为 GenBank `.gbk` 文件
- 交互式空状态下可直接粘贴 DNA 文本
- 可编辑的 IUPAC DNA 序列文本
- 基于 `SeqViz` 的内联可视化序列视图
- 直接拖拽选择范围、点击已有特征聚焦编辑
- `linear` / `circular` 拓扑切换
- 与 GenBank 对齐子集一致的特征注释与多段位置
- 每个片段的 partial 起点 / partial 终点标记
- `gene`、`product`、`label`、`note` 等限定词行编辑
- 面向复杂多段位置和限定词的高级编辑区

`AimdRecorder` 和 `AimdQuizRecorder` 都支持通过 `locale` 切换内建标签：

```vue
<AimdRecorder locale="zh-CN" />
<AimdQuizRecorder :quiz="quiz" locale="zh-CN" />
```

## 进阶

### Type Plugins

如果宿主应用需要的是“某个 type 的专用行为”，而不是整体替换整类字段 UI，那么应该使用 `typePlugins`。

type plugin 可以为单个 AIMD 类型定义初始值、归一化逻辑、显示/解析钩子，甚至完整的自定义 recorder widget。

内建的 `AiralogyMarkdown` widget 也是沿用这条 type plugin 路径实现的，所以如果宿主应用需要不同的源码/所见即所得工作流，仍然可以覆盖官方默认实现。

完整架构说明和端到端示例请参考：

- [`Type Plugins`](/zh/packages/type-plugins)

如果需要微调 recorder 的内建标签，也可以覆盖 `messages`：

```vue
<script setup lang="ts">
import { AimdRecorder } from "@airalogy/aimd-recorder"
</script>

<template>
  <AimdRecorder
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

`AimdProtocolRecorder` 仍然导出为已废弃的兼容别名，但新的使用方式建议直接写 `AimdRecorder`。

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
