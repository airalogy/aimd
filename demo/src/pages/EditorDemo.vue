<script setup lang="ts">
import { ref } from 'vue'
import { AimdEditor } from '@airalogy/aimd-editor/vue'
import { SAMPLE_AIMD } from '../composables/sampleContent'

const content = ref(SAMPLE_AIMD)
const mode = ref<'source' | 'wysiwyg'>('source')

function onReady(editor: any) {
  console.log('Editor ready:', editor)
}
</script>

<template>
  <div class="demo-page">
    <h2 class="page-title">@airalogy/aimd-editor</h2>
    <p class="page-desc">AIMD Editor &mdash; Source mode &amp; WYSIWYG mode with Markdown and AIMD syntax support</p>

    <AimdEditor
      v-model="content"
      v-model:mode="mode"
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
