<script setup lang="ts">
import { ref, watch } from 'vue'
import { remarkAimd } from '@airalogy/aimd-core'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { VFile } from 'vfile'
import { useDemoMessages } from '../composables/demoI18n'
import { useSampleContent } from '../composables/sampleContent'

const messages = useDemoMessages()
const input = useSampleContent()
const astOutput = ref('')
const fieldsOutput = ref('')
const parseError = ref('')

async function parseContent() {
  try {
    parseError.value = ''
    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkAimd)

    const file: VFile = { data: {} } as VFile
    const tree = processor.parse(input.value)
    await processor.run(tree, file)

    astOutput.value = JSON.stringify(tree, null, 2)
    fieldsOutput.value = JSON.stringify(file.data.aimdFields ?? {}, null, 2)
  } catch (e: any) {
    parseError.value = e.message
    astOutput.value = ''
    fieldsOutput.value = ''
  }
}

watch(input, parseContent, { immediate: true })
</script>

<template>
  <div class="demo-page">
    <h2 class="page-title">@airalogy/aimd-core</h2>
    <p class="page-desc">{{ messages.pages.core.desc }}</p>

    <div class="demo-layout">
      <div class="panel">
        <h3 class="panel-title">{{ messages.common.inputAimd }}</h3>
        <textarea
          v-model="input"
          class="code-input"
          spellcheck="false"
        />
      </div>

      <div class="panel">
        <h3 class="panel-title">{{ messages.common.extractedFields }}</h3>
        <div v-if="parseError" class="error">{{ parseError }}</div>
        <pre v-else class="code-output">{{ fieldsOutput }}</pre>
      </div>
    </div>

    <div class="panel full-width">
      <h3 class="panel-title">{{ messages.common.astOutput }}</h3>
      <pre class="code-output ast-output">{{ astOutput }}</pre>
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

.code-input {
  width: 100%;
  min-height: 400px;
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

.code-output {
  padding: 16px;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 12px;
  line-height: 1.5;
  overflow: auto;
  max-height: 400px;
  white-space: pre-wrap;
  word-break: break-all;
  color: #333;
  margin: 0;
}

.ast-output {
  max-height: 300px;
}

.error {
  padding: 16px;
  color: #d03050;
  font-size: 13px;
}

@media (max-width: 960px) {
  .demo-layout {
    grid-template-columns: 1fr;
  }
}
</style>
