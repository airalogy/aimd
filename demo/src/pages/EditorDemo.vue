<script setup lang="ts">
import { ref } from 'vue'
import { AimdEditor } from '@airalogy/aimd-editor'
import { useDemoLocale, useDemoMessages } from '../composables/demoI18n'
import { useSampleContent } from '../composables/sampleContent'

const { locale } = useDemoLocale()
const messages = useDemoMessages()
const content = useSampleContent()
const mode = ref<'source' | 'wysiwyg'>('source')

function onReady(editor: any) {
  console.log('Editor ready:', editor)
}
</script>

<template>
  <div class="demo-page">
    <h2 class="page-title">@airalogy/aimd-editor</h2>
    <p class="page-desc">{{ messages.pages.editor.desc }}</p>

    <AimdEditor
      v-model="content"
      v-model:mode="mode"
      :locale="locale"
      :min-height="500"
      :enable-block-handle="true"
      @ready="onReady"
    />
  </div>
</template>

<style scoped>
.demo-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
</style>
