<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { parseAndExtract } from '@airalogy/aimd-renderer'
import '@airalogy/aimd-recorder/styles'
import { SAMPLE_AIMD } from '../composables/sampleContent'

const input = ref(SAMPLE_AIMD)

// Extracted fields from AIMD
const fields = ref<any>({})

// Reactive record model: { scope: { fieldName: value } }
const recordData = reactive<Record<string, Record<string, any>>>({
  research_variable: {},
  research_step: {},
  research_check: {},
})

// Parse and extract fields
function extractFields() {
  const result = parseAndExtract(input.value)
  fields.value = result

  // Initialize record data for each field
  result.var?.forEach((v: any) => {
    if (!recordData.research_variable[v.name]) {
      const def = v.definition
      const defaultVal = def?.default ?? ''
      recordData.research_variable[v.name] = defaultVal
    }
  })
  result.step?.forEach((s: any) => {
    if (!recordData.research_step[s.name]) {
      recordData.research_step[s.name] = { checked: false, annotation: '' }
    }
  })
  result.check?.forEach((c: any) => {
    if (!recordData.research_check[c.name]) {
      recordData.research_check[c.name] = { checked: false, annotation: '' }
    }
  })
}

watch(input, extractFields, { immediate: true })

// Collected data as JSON
const collectedJson = computed(() => {
  return JSON.stringify(recordData, null, 2)
})

function resetForm() {
  Object.keys(recordData.research_variable).forEach(k => {
    recordData.research_variable[k] = ''
  })
  Object.keys(recordData.research_step).forEach(k => {
    recordData.research_step[k] = { checked: false, annotation: '' }
  })
  Object.keys(recordData.research_check).forEach(k => {
    recordData.research_check[k] = { checked: false, annotation: '' }
  })
}

function getVarType(v: any): string {
  return v.definition?.type || 'str'
}

function getInputType(type: string): string {
  if (type === 'float' || type === 'int' || type === 'integer' || type === 'number') return 'number'
  if (type === 'bool') return 'checkbox'
  return 'text'
}
</script>

<template>
  <div class="demo-page">
    <h2 class="page-title">@airalogy/aimd-recorder</h2>
    <p class="page-desc">AIMD 数据记录器 — 解析 AIMD 字段并生成交互式表单，收集填写数据</p>

    <div class="demo-layout">
      <!-- Left: AIMD source -->
      <div class="panel">
        <h3 class="panel-title">AIMD 源文本</h3>
        <textarea v-model="input" class="code-input" spellcheck="false" />
      </div>

      <!-- Right: Interactive form -->
      <div class="panel">
        <div class="panel-title-bar">
          <h3 class="panel-title-text">数据记录表单</h3>
          <button class="reset-btn" @click="resetForm">重置</button>
        </div>

        <div class="form-content">
          <!-- Variables -->
          <div v-if="fields.var?.length" class="form-section">
            <h4 class="section-title">
              <span class="aimd-field__scope">VAR</span>
              变量字段
            </h4>
            <div v-for="v in fields.var" :key="v.name" class="form-field">
              <label class="field-label">
                <span class="aimd-field aimd-field--var" style="margin-right: 8px">
                  <span class="aimd-field__scope">VAR</span>
                  <span class="aimd-field__name">{{ v.name }}</span>
                  <span v-if="v.definition?.type" class="aimd-field__type">: {{ v.definition.type }}</span>
                </span>
              </label>
              <div class="field-input-wrapper">
                <input
                  v-if="getInputType(getVarType(v)) === 'checkbox'"
                  type="checkbox"
                  v-model="recordData.research_variable[v.name]"
                  class="field-checkbox"
                />
                <input
                  v-else
                  :type="getInputType(getVarType(v))"
                  v-model="recordData.research_variable[v.name]"
                  :placeholder="`输入 ${v.name}...`"
                  :step="getVarType(v) === 'float' ? '0.01' : undefined"
                  class="field-input"
                />
              </div>
            </div>
          </div>

          <!-- Variable Tables -->
          <div v-if="fields.var_table?.length" class="form-section">
            <h4 class="section-title">
              <span class="aimd-field__scope aimd-field__scope--var_table">TABLE</span>
              变量表
            </h4>
            <div v-for="vt in fields.var_table" :key="vt.name" class="form-field">
              <div class="aimd-field--var-table">
                <div class="aimd-field__header">
                  <span class="aimd-field__scope">TABLE</span>
                  <span class="aimd-field__name">{{ vt.name }}</span>
                </div>
                <table v-if="vt.columns?.length" class="aimd-field__table-preview">
                  <thead>
                    <tr>
                      <th v-for="col in vt.columns" :key="col">{{ col }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td v-for="col in vt.columns" :key="col">
                        <input class="table-cell-input" :placeholder="col" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Steps -->
          <div v-if="fields.step?.length" class="form-section">
            <h4 class="section-title">
              <span class="aimd-field__scope aimd-field__scope--step">STEP</span>
              实验步骤
            </h4>
            <div v-for="s in fields.step" :key="s.name" class="form-field step-field">
              <div class="step-header">
                <span class="research-step__sequence">Step {{ s.step || '?' }} &gt;</span>
                <span class="step-name">{{ s.name }}</span>
              </div>
              <div class="step-controls">
                <label class="step-check-label">
                  <input
                    type="checkbox"
                    v-model="recordData.research_step[s.name].checked"
                    class="aimd-checkbox"
                  />
                  完成
                </label>
                <input
                  v-model="recordData.research_step[s.name].annotation"
                  placeholder="备注..."
                  class="field-input annotation-input"
                />
              </div>
            </div>
          </div>

          <!-- Checks -->
          <div v-if="fields.check?.length" class="form-section">
            <h4 class="section-title">
              <span class="aimd-field__scope aimd-field__scope--check">CHECK</span>
              质量检查
            </h4>
            <div v-for="c in fields.check" :key="c.name" class="form-field">
              <label class="aimd-field aimd-field--check" style="width: 100%; cursor: pointer">
                <input
                  type="checkbox"
                  v-model="recordData.research_check[c.name].checked"
                  class="aimd-checkbox"
                />
                <span class="aimd-field__label">{{ c.label || c.name }}</span>
              </label>
              <input
                v-model="recordData.research_check[c.name].annotation"
                placeholder="检查备注..."
                class="field-input annotation-input"
                style="margin-top: 4px"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Collected data -->
    <div class="panel full-width">
      <h3 class="panel-title">收集到的数据 (Record Data)</h3>
      <pre class="code-output">{{ collectedJson }}</pre>
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

.panel-title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #fafafa;
  border-bottom: 1px solid #e8e8e8;
}

.panel-title-text {
  font-size: 14px;
  font-weight: 600;
  color: #444;
}

.reset-btn {
  padding: 4px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  color: #666;
  transition: all 0.2s;
}

.reset-btn:hover {
  border-color: #d03050;
  color: #d03050;
}

.code-input {
  width: 100%;
  min-height: 500px;
  padding: 16px;
  border: none;
  outline: none;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
  background: #fff;
  color: #333;
}

.form-content {
  padding: 16px;
  max-height: 500px;
  overflow: auto;
}

.form-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #444;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-field {
  margin-bottom: 12px;
}

.field-label {
  display: block;
  margin-bottom: 4px;
}

.field-input-wrapper {
  width: 100%;
}

.field-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--aimd-border-color, #90caf9);
  border-radius: 0 0 6px 6px;
  outline: none;
  font-size: 14px;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.field-input:focus {
  border-color: var(--aimd-border-color-focus, #4181fd);
  box-shadow: 0 0 0 2px rgba(65, 129, 253, 0.1);
}

.field-checkbox {
  width: 18px;
  height: 18px;
  accent-color: #4181fd;
}

.annotation-input {
  border-radius: 6px;
  border-color: #e0e0e0;
  font-size: 13px;
  padding: 6px 10px;
}

.step-field {
  background: #fff8f0;
  border: 1px solid #ffcc80;
  border-radius: 6px;
  padding: 12px;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.step-name {
  font-weight: 500;
  color: #e65100;
}

.step-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.step-check-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  white-space: nowrap;
}

.table-cell-input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #e0e0e0;
  border-radius: 3px;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
}

.table-cell-input:focus {
  border-color: #4181fd;
}

.code-output {
  padding: 16px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.5;
  overflow: auto;
  max-height: 300px;
  white-space: pre-wrap;
  word-break: break-all;
  color: #333;
  margin: 0;
}
</style>
