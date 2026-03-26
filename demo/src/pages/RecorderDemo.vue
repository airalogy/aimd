<script setup lang="ts">
import { ref } from 'vue'
import {
  AimdRecorderEditor,
  createEmptyProtocolRecordData,
  type AimdProtocolRecordData,
} from '@airalogy/aimd-recorder'
import '@airalogy/aimd-recorder/styles'
import { useDemoLocale, useDemoMessages } from '../composables/demoI18n'
import { useSampleContent } from '../composables/sampleContent'

const { locale } = useDemoLocale()
const messages = useDemoMessages()
const input = useSampleContent()
const recordData = ref<AimdProtocolRecordData>(createEmptyProtocolRecordData())

function resetForm() {
  recordData.value = createEmptyProtocolRecordData()
}
</script>

<template>
  <div class="demo-page">
    <h2 class="page-title">@airalogy/aimd-recorder</h2>
    <p class="page-desc">{{ messages.pages.recorder.desc }}</p>

    <div class="page-toolbar">
      <button class="reset-btn" @click="resetForm">{{ messages.common.reset }}</button>
    </div>

    <AimdRecorderEditor
      v-model="recordData"
      v-model:content="input"
      :locale="locale"
      :initial-visual-edit-mode="true"
      :show-record-data="true"
      :editor-title="messages.common.aimdSource"
      :recorder-title="messages.pages.recorder.inlineFormTitle"
      :record-data-title="messages.common.collectedData"
    />
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
  margin-top: -12px;
}

.page-toolbar {
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
</style>
