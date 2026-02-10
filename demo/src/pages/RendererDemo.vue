<script setup lang="ts">
import { ref, watch, h, type VNode } from 'vue'
import { renderToHtml, renderToVue, parseAndExtract } from '@airalogy/aimd-renderer'
import '@airalogy/aimd-recorder/styles'

const defaultContent = `# 研究协议 Demo

## 变量定义

请输入样本名称：{{var|sample_name: str}}

温度设定：{{var|temperature: float = 25.0}}

浓度参数：{{var|concentration: float = 1.0, title = "浓度 (M)", unit = "mol/L"}}

## 变量表

{{var_table|samples, subvars=[sample_id, concentration, volume]}}

## 实验步骤

{{step|sample_preparation}}
准备样本，确认样本名称 {{ref_var|sample_name}}。

{{step|data_analysis}}
分析数据，检查温度 {{ref_var|temperature}}。

## 质量检查

{{check|quality_control}}
{{check|safety_verification}}

## 引用

参考步骤：{{ref_step|sample_preparation}}

## Markdown 特性

**粗体** *斜体* ~~删除线~~

- 列表项 1
- 列表项 2
  - 嵌套项

| 列 A | 列 B | 列 C |
|------|------|------|
| 1    | 2    | 3    |
| 4    | 5    | 6    |

> 引用块内容

行内公式 $E = mc^2$

$$
\\sum_{i=1}^{n} x_i = x_1 + x_2 + \\cdots + x_n
$$
`

const input = ref(defaultContent)
const htmlOutput = ref('')
const fieldsOutput = ref('')
const vueNodes = ref<VNode[]>([])
const renderError = ref('')
const activeTab = ref<'html' | 'vue' | 'fields'>('html')

async function render() {
  try {
    renderError.value = ''

    const htmlResult = await renderToHtml(input.value)
    htmlOutput.value = htmlResult.html

    const vueResult = await renderToVue(input.value)
    vueNodes.value = vueResult.nodes

    const fields = parseAndExtract(input.value)
    fieldsOutput.value = JSON.stringify(fields, null, 2)
  } catch (e: any) {
    renderError.value = e.message
  }
}

watch(input, render, { immediate: true })
</script>

<template>
  <div class="demo-page">
    <h2 class="page-title">@airalogy/aimd-renderer</h2>
    <p class="page-desc">AIMD 渲染引擎 — 将 AIMD Markdown 渲染为 HTML 和 Vue VNodes</p>

    <div class="demo-layout">
      <div class="panel">
        <h3 class="panel-title">输入 (AIMD Markdown)</h3>
        <textarea
          v-model="input"
          class="code-input"
          spellcheck="false"
        />
      </div>

      <div class="panel">
        <div class="tab-bar">
          <button
            :class="['tab-btn', { active: activeTab === 'html' }]"
            @click="activeTab = 'html'"
          >
            HTML 渲染
          </button>
          <button
            :class="['tab-btn', { active: activeTab === 'vue' }]"
            @click="activeTab = 'vue'"
          >
            Vue VNodes
          </button>
          <button
            :class="['tab-btn', { active: activeTab === 'fields' }]"
            @click="activeTab = 'fields'"
          >
            提取字段
          </button>
        </div>

        <div v-if="renderError" class="error">{{ renderError }}</div>

        <div v-else-if="activeTab === 'html'" class="render-preview" v-html="htmlOutput" />

        <div v-else-if="activeTab === 'vue'" class="render-preview">
          <component :is="() => vueNodes" />
        </div>

        <pre v-else class="code-output">{{ fieldsOutput }}</pre>
      </div>
    </div>

    <div class="panel full-width">
      <h3 class="panel-title">HTML 源码</h3>
      <pre class="code-output html-source">{{ htmlOutput }}</pre>
    </div>
  </div>
</template>

<style scoped>
.demo-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a2e;
}

.page-desc {
  color: #666;
  font-size: 14px;
  margin-top: -12px;
}

.demo-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.panel {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;
}

.panel.full-width {
  width: 100%;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  padding: 12px 16px;
  background: #fafafa;
  border-bottom: 1px solid #e8e8e8;
  color: #444;
}

.tab-bar {
  display: flex;
  border-bottom: 1px solid #e8e8e8;
  background: #fafafa;
}

.tab-btn {
  padding: 10px 20px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: #666;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #333;
  background: #f0f2f5;
}

.tab-btn.active {
  color: #1a73e8;
  border-bottom-color: #1a73e8;
  font-weight: 600;
}

.code-input {
  width: 100%;
  min-height: 500px;
  padding: 16px;
  border: none;
  outline: none;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
  background: #fff;
  color: #333;
}

.render-preview {
  padding: 20px;
  max-height: 500px;
  overflow: auto;
  line-height: 1.8;
  font-size: 15px;
}

.render-preview :deep(h1) { font-size: 1.8em; margin: 0.5em 0; }
.render-preview :deep(h2) { font-size: 1.4em; margin: 0.5em 0; color: #333; }
.render-preview :deep(h3) { font-size: 1.2em; margin: 0.4em 0; }
.render-preview :deep(p) { margin: 0.5em 0; }
.render-preview :deep(table) {
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 14px;
}
.render-preview :deep(th),
.render-preview :deep(td) {
  border: 1px solid #ddd;
  padding: 6px 12px;
  text-align: left;
}
.render-preview :deep(th) {
  background: #f5f5f5;
  font-weight: 600;
}
.render-preview :deep(blockquote) {
  border-left: 4px solid #dfe2e5;
  padding: 8px 16px;
  margin: 8px 0;
  color: #666;
}
.render-preview :deep(ul),
.render-preview :deep(ol) {
  padding-left: 24px;
  margin: 4px 0;
}
.render-preview :deep(code) {
  background: #f0f2f5;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 0.9em;
}

.code-output {
  padding: 16px;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 12px;
  line-height: 1.5;
  overflow: auto;
  max-height: 500px;
  white-space: pre-wrap;
  word-break: break-all;
  color: #333;
  margin: 0;
}

.html-source {
  max-height: 250px;
}

.error {
  padding: 16px;
  color: #d03050;
  font-size: 13px;
}
</style>
