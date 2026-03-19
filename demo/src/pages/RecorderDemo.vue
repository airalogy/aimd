<script setup lang="ts">
import { computed, ref } from 'vue'
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
const input = useSampleContent()
const recordData = ref<AimdProtocolRecordData>(createEmptyProtocolRecordData())

function resetForm() {
  recordData.value = createEmptyProtocolRecordData()
}

const collectedJson = computed(() => JSON.stringify(recordData.value, null, 2))
</script>

<template>
  <div class="demo-page">
    <h2 class="page-title">@airalogy/aimd-recorder</h2>
    <p class="page-desc">{{ messages.pages.recorder.desc }}</p>

    <div class="demo-layout">
      <div class="panel">
        <h3 class="panel-title">{{ messages.common.aimdSource }}</h3>
        <DemoAimdSourceEditor v-model="input" :min-height="500" />
      </div>

      <div class="panel">
        <div class="panel-title-bar">
          <h3 class="panel-title-text">{{ messages.pages.recorder.inlineFormTitle }}</h3>
          <button class="reset-btn" @click="resetForm">{{ messages.common.reset }}</button>
        </div>

        <div class="form-content">
          <AimdRecorder v-model="recordData" :content="input" :locale="locale" />
        </div>
      </div>
    </div>

    <div class="panel full-width">
      <h3 class="panel-title">{{ messages.common.collectedData }}</h3>
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
  border: 1px solid #e5e9f1;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.panel.full-width {
  width: 100%;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  padding: 12px 16px;
  background: #f8fafd;
  border-bottom: 1px solid #e5e9f1;
  color: #444;
}

.panel-title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #f8fafd;
  border-bottom: 1px solid #e5e9f1;
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

.form-content {
  padding: 18px;
  max-height: 500px;
  overflow: auto;
  background: #f7f9fc;
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

@media (max-width: 960px) {
  .demo-layout {
    grid-template-columns: 1fr;
  }
}
</style>
