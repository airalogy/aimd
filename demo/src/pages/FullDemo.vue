<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { renderToHtml, parseAndExtract } from '@airalogy/aimd-renderer'
import {
  AimdRecorder,
  createEmptyProtocolRecordData,
  type AimdProtocolRecordData,
} from '@airalogy/aimd-recorder'
import '@airalogy/aimd-recorder/styles'
import DemoAimdSourceEditor from '../components/DemoAimdSourceEditor.vue'
import { useDemoLocale, useDemoMessages } from '../composables/demoI18n'
import { useSampleContent } from '../composables/sampleContent'
const { locale } = useDemoLocale()
const messages = useDemoMessages()
const content = useSampleContent()

// --- Preview ---
const htmlOutput = ref('')
const fields = ref<any>({})
const renderError = ref('')

// --- Record Data ---
const recordData = ref<AimdProtocolRecordData>(createEmptyProtocolRecordData())

// Active panel on the right side
const activeRightTab = ref<'preview' | 'form' | 'data'>('preview')

async function processContent() {
  try {
    renderError.value = ''
    const result = await renderToHtml(content.value, {
      locale: locale.value,
      assignerVisibility: 'collapsed',
    })
    htmlOutput.value = result.html

    const extracted = parseAndExtract(content.value)
    fields.value = extracted
  } catch (e: any) {
    renderError.value = e.message
  }
}

watch([content, locale], processContent, { immediate: true })

const collectedJson = computed(() => JSON.stringify(recordData.value, null, 2))

const fieldCount = computed(() => {
  const f = fields.value
  return (f.var?.length || 0) + (f.var_table?.length || 0) + (f.quiz?.length || 0) + (f.step?.length || 0) + (f.check?.length || 0)
})

function resetForm() {
  recordData.value = createEmptyProtocolRecordData()
}
</script>

<template>
  <div class="demo-page">
    <h2 class="page-title">{{ messages.pages.full.title }}</h2>
    <p class="page-desc">{{ messages.pages.full.desc }}</p>

    <div class="stats-bar">
      <span class="stat">
        {{ messages.pages.full.stats.var }}: <strong>{{ fields.var?.length || 0 }}</strong>
      </span>
      <span class="stat">
        {{ messages.pages.full.stats.table }}: <strong>{{ fields.var_table?.length || 0 }}</strong>
      </span>
      <span class="stat">
        {{ messages.pages.full.stats.step }}: <strong>{{ fields.step?.length || 0 }}</strong>
      </span>
      <span class="stat">
        {{ messages.pages.full.stats.check }}: <strong>{{ fields.check?.length || 0 }}</strong>
      </span>
      <span class="stat">
        {{ messages.pages.full.stats.refs }}: <strong>{{ (fields.ref_step?.length || 0) + (fields.ref_var?.length || 0) }}</strong>
      </span>
    </div>

    <div class="main-layout">
      <!-- Left: AIMD Editor -->
      <div class="panel editor-panel">
        <h3 class="panel-title">{{ messages.common.aimdSource }}</h3>
        <DemoAimdSourceEditor v-model="content" :min-height="560" />
      </div>

      <!-- Right: Preview / Form / Data -->
      <div class="panel right-panel">
        <div class="tab-bar">
          <button
            :class="['tab-btn', { active: activeRightTab === 'preview' }]"
            @click="activeRightTab = 'preview'"
          >
            {{ messages.pages.full.tabs.preview }}
          </button>
          <button
            :class="['tab-btn', { active: activeRightTab === 'form' }]"
            @click="activeRightTab = 'form'"
          >
            {{ messages.pages.full.tabs.form }} ({{ fieldCount }})
          </button>
          <button
            :class="['tab-btn', { active: activeRightTab === 'data' }]"
            @click="activeRightTab = 'data'"
          >
            {{ messages.pages.full.tabs.data }}
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
            <button class="reset-btn" @click="resetForm">{{ messages.common.resetForm }}</button>
          </div>

          <div class="form-content">
            <AimdRecorder v-model="recordData" :content="content" :locale="locale" />
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

.editor-panel :deep(.demo-aimd-source-editor) {
  flex: 1;
  min-height: 0;
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
</style>
