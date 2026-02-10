<script setup lang="ts">
import { ref, reactive, watch, computed, onMounted, onBeforeUnmount, shallowRef, nextTick } from 'vue'
import { useMonaco } from '../composables/useMonaco'
import { renderToHtml, parseAndExtract } from '@airalogy/aimd-renderer'
import '@airalogy/aimd-recorder/styles'
import { SAMPLE_AIMD } from '../composables/sampleContent'

// --- Monaco Editor ---
const editorContainer = ref<HTMLElement | null>(null)
const { monaco, loading, init } = useMonaco()
const editor = shallowRef<any>(null)
const content = ref(SAMPLE_AIMD)

onMounted(async () => {
  await init()
  if (monaco.value && editorContainer.value) {
    editor.value = monaco.value.editor.create(editorContainer.value, {
      value: content.value,
      language: 'aimd',
      theme: 'aimd-light',
      minimap: { enabled: false },
      fontSize: 13,
      lineNumbers: 'on',
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      padding: { top: 8 },
    })

    editor.value.onDidChangeModelContent(() => {
      content.value = editor.value.getValue()
    })
  }
})

onBeforeUnmount(() => {
  editor.value?.dispose()
})

// --- Preview ---
const htmlOutput = ref('')
const fields = ref<any>({})
const renderError = ref('')

// --- Record Data ---
const recordData = reactive<Record<string, Record<string, any>>>({
  research_variable: {},
  research_step: {},
  research_check: {},
})

// Active panel on the right side
const activeRightTab = ref<'preview' | 'form' | 'data'>('preview')

async function processContent() {
  try {
    renderError.value = ''
    const result = await renderToHtml(content.value)
    htmlOutput.value = result.html

    const extracted = parseAndExtract(content.value)
    fields.value = extracted

    // Initialize record data for new fields
    extracted.var?.forEach((v: any) => {
      if (!(v.name in recordData.research_variable)) {
        const def = v.definition
        recordData.research_variable[v.name] = def?.default ?? ''
      }
    })
    extracted.step?.forEach((s: any) => {
      if (!(s.name in recordData.research_step)) {
        recordData.research_step[s.name] = { checked: false, annotation: '' }
      }
    })
    extracted.check?.forEach((c: any) => {
      if (!(c.name in recordData.research_check)) {
        recordData.research_check[c.name] = { checked: false, annotation: '' }
      }
    })
  } catch (e: any) {
    renderError.value = e.message
  }
}

watch(content, processContent, { immediate: true })

const collectedJson = computed(() => JSON.stringify(recordData, null, 2))

const fieldCount = computed(() => {
  const f = fields.value
  return (f.var?.length || 0) + (f.var_table?.length || 0) + (f.step?.length || 0) + (f.check?.length || 0)
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

function getInputType(type: string): string {
  if (['float', 'int', 'integer', 'number'].includes(type)) return 'number'
  if (type === 'bool') return 'checkbox'
  return 'text'
}
</script>

<template>
  <div class="demo-page">
    <h2 class="page-title">AIMD 完整工作流</h2>
    <p class="page-desc">编辑 AIMD → 实时预览 → 填写字段值 → 收集数据</p>

    <div class="stats-bar">
      <span class="stat">
        变量: <strong>{{ fields.var?.length || 0 }}</strong>
      </span>
      <span class="stat">
        变量表: <strong>{{ fields.var_table?.length || 0 }}</strong>
      </span>
      <span class="stat">
        步骤: <strong>{{ fields.step?.length || 0 }}</strong>
      </span>
      <span class="stat">
        检查: <strong>{{ fields.check?.length || 0 }}</strong>
      </span>
      <span class="stat">
        引用: <strong>{{ (fields.ref_step?.length || 0) + (fields.ref_var?.length || 0) }}</strong>
      </span>
    </div>

    <div class="main-layout">
      <!-- Left: Monaco Editor -->
      <div class="panel editor-panel">
        <h3 class="panel-title">AIMD 编辑器</h3>
        <div v-if="loading" class="loading">加载编辑器...</div>
        <div ref="editorContainer" class="editor-container" />
      </div>

      <!-- Right: Preview / Form / Data -->
      <div class="panel right-panel">
        <div class="tab-bar">
          <button
            :class="['tab-btn', { active: activeRightTab === 'preview' }]"
            @click="activeRightTab = 'preview'"
          >
            渲染预览
          </button>
          <button
            :class="['tab-btn', { active: activeRightTab === 'form' }]"
            @click="activeRightTab = 'form'"
          >
            填写数据 ({{ fieldCount }})
          </button>
          <button
            :class="['tab-btn', { active: activeRightTab === 'data' }]"
            @click="activeRightTab = 'data'"
          >
            收集结果
          </button>
        </div>

        <!-- Preview Tab -->
        <div v-if="activeRightTab === 'preview'" class="tab-content">
          <div v-if="renderError" class="error">{{ renderError }}</div>
          <div v-else class="render-preview" v-html="htmlOutput" />
        </div>

        <!-- Form Tab -->
        <div v-if="activeRightTab === 'form'" class="tab-content">
          <div class="form-toolbar">
            <button class="reset-btn" @click="resetForm">重置表单</button>
          </div>

          <div class="form-content">
            <!-- Variables -->
            <div v-for="v in fields.var" :key="'var-' + v.name" class="form-field">
              <label class="field-label">
                <span class="aimd-field aimd-field--var">
                  <span class="aimd-field__scope">VAR</span>
                  <span class="aimd-field__name">{{ v.name }}</span>
                  <span v-if="v.definition?.type" class="aimd-field__type">: {{ v.definition.type }}</span>
                </span>
              </label>
              <input
                v-if="getInputType(v.definition?.type || 'str') === 'checkbox'"
                type="checkbox"
                v-model="recordData.research_variable[v.name]"
                class="field-checkbox"
              />
              <input
                v-else
                :type="getInputType(v.definition?.type || 'str')"
                v-model="recordData.research_variable[v.name]"
                :placeholder="`输入 ${v.name}...`"
                :step="v.definition?.type === 'float' ? '0.01' : undefined"
                class="field-input"
              />
            </div>

            <!-- Variable Tables -->
            <div v-for="vt in fields.var_table" :key="'vt-' + vt.name" class="form-field">
              <div class="aimd-field--var-table">
                <div class="aimd-field__header">
                  <span class="aimd-field__scope">TABLE</span>
                  <span class="aimd-field__name">{{ vt.name }}</span>
                </div>
                <table v-if="vt.columns?.length" class="aimd-field__table-preview">
                  <thead>
                    <tr><th v-for="col in vt.columns" :key="col">{{ col }}</th></tr>
                  </thead>
                  <tbody>
                    <tr><td v-for="col in vt.columns" :key="col"><input class="table-cell-input" :placeholder="col" /></td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Steps -->
            <div v-for="s in fields.step" :key="'step-' + s.name" class="form-field step-field">
              <div class="step-header">
                <span class="research-step__sequence">Step {{ s.step || '?' }} &gt;</span>
                <span class="step-name">{{ s.name }}</span>
              </div>
              <div class="step-controls">
                <label class="step-check-label">
                  <input type="checkbox" v-model="recordData.research_step[s.name].checked" class="aimd-checkbox" />
                  完成
                </label>
                <input v-model="recordData.research_step[s.name].annotation" placeholder="备注..." class="field-input annotation-input" />
              </div>
            </div>

            <!-- Checks -->
            <div v-for="c in fields.check" :key="'check-' + c.name" class="form-field">
              <label class="aimd-field aimd-field--check" style="width: 100%; cursor: pointer">
                <input type="checkbox" v-model="recordData.research_check[c.name].checked" class="aimd-checkbox" />
                <span class="aimd-field__label">{{ c.label || c.name }}</span>
              </label>
              <input v-model="recordData.research_check[c.name].annotation" placeholder="检查备注..." class="field-input annotation-input" style="margin-top: 4px" />
            </div>

            <div v-if="fieldCount === 0" class="empty-state">暂无可填写的字段</div>
          </div>
        </div>

        <!-- Data Tab -->
        <div v-if="activeRightTab === 'data'" class="tab-content">
          <pre class="code-output">{{ collectedJson }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.demo-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a2e;
}

.page-desc {
  color: #666;
  font-size: 14px;
  margin-top: -8px;
}

.stats-bar {
  display: flex;
  gap: 20px;
  padding: 10px 16px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  font-size: 13px;
  color: #666;
}

.stat strong {
  color: #1a73e8;
}

.main-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  min-height: 600px;
}

.panel {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  padding: 10px 16px;
  background: #fafafa;
  border-bottom: 1px solid #e8e8e8;
  color: #444;
  flex-shrink: 0;
}

.editor-container {
  flex: 1;
  min-height: 0;
}

.loading {
  padding: 40px;
  text-align: center;
  color: #888;
}

.tab-bar {
  display: flex;
  border-bottom: 1px solid #e8e8e8;
  background: #fafafa;
  flex-shrink: 0;
}

.tab-btn {
  padding: 10px 16px;
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

.tab-content {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

.render-preview {
  padding: 20px;
  line-height: 1.8;
  font-size: 15px;
}

.render-preview :deep(h1) { font-size: 1.8em; margin: 0.5em 0; }
.render-preview :deep(h2) { font-size: 1.4em; margin: 0.5em 0; color: #333; }
.render-preview :deep(h3) { font-size: 1.2em; margin: 0.4em 0; }
.render-preview :deep(p) { margin: 0.5em 0; }
.render-preview :deep(table) { border-collapse: collapse; margin: 8px 0; font-size: 14px; }
.render-preview :deep(th), .render-preview :deep(td) { border: 1px solid #ddd; padding: 6px 12px; text-align: left; }
.render-preview :deep(th) { background: #f5f5f5; font-weight: 600; }
.render-preview :deep(blockquote) { border-left: 4px solid #dfe2e5; padding: 8px 16px; margin: 8px 0; color: #666; }
.render-preview :deep(ul), .render-preview :deep(ol) { padding-left: 24px; margin: 4px 0; }

.form-toolbar {
  padding: 8px 16px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: flex-end;
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

.form-content {
  padding: 16px;
}

.form-field {
  margin-bottom: 12px;
}

.field-label {
  display: block;
  margin-bottom: 4px;
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
  white-space: pre-wrap;
  word-break: break-all;
  color: #333;
  margin: 0;
}

.error {
  padding: 16px;
  color: #d03050;
  font-size: 13px;
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: #aaa;
  font-size: 14px;
}
</style>
