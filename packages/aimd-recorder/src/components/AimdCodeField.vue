<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ensureMonacoEnvironment, ensureMonacoLanguageContribution } from '../monaco-code'
import { formatAimdCodeEditorLanguageLabel } from '../code-types'

const props = withDefaults(defineProps<{
  modelValue?: string | number
  language: string
  disabled?: boolean
  title?: string
  description?: string
  fieldId?: string
  typeLabel?: string
}>(), {
  modelValue: '',
  disabled: false,
  title: '',
  description: '',
  fieldId: '',
  typeLabel: '',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'blur'): void
}>()

const editorContainer = ref<HTMLElement | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const draftValue = ref(normalizeCodeFieldValue(props.modelValue))

let monacoModule: typeof import('monaco-editor') | null = null
let monacoEditor: import('monaco-editor').editor.IStandaloneCodeEditor | null = null
let monacoModel: import('monaco-editor').editor.ITextModel | null = null
let isSyncing = false

function resolveLanguageBadge(language: string): string {
  const normalized = language.trim().toLowerCase()
  if (normalized === 'javascript') return 'JS'
  if (normalized === 'typescript') return 'TS'
  if (normalized === 'python') return 'PY'
  if (normalized === 'plaintext' || normalized === 'text') return 'TXT'
  return normalized.slice(0, 6).toUpperCase() || 'CODE'
}

function normalizeCodeFieldValue(value: string | number | undefined): string {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return String(value)
  }

  return ''
}

function emitDraftValue(nextValue: string) {
  if (nextValue === draftValue.value) {
    return
  }

  draftValue.value = nextValue
  emit('update:modelValue', nextValue)
}

async function applyLanguage(language: string) {
  if (!monacoModule || !monacoModel) {
    return
  }

  await ensureMonacoLanguageContribution(language)
  monacoModule.editor.setModelLanguage(monacoModel, language)
}

async function createEditor() {
  if (!editorContainer.value || monacoEditor) {
    return
  }

  loading.value = true
  loadError.value = null

  try {
    ensureMonacoEnvironment()
    monacoModule = await import('monaco-editor')
    await ensureMonacoLanguageContribution(props.language)

    monacoEditor = monacoModule.editor.create(editorContainer.value, {
      value: draftValue.value,
      language: props.language,
      theme: 'vs',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      lineNumbers: 'on',
      wordWrap: 'on',
      tabSize: 2,
      padding: { top: 12, bottom: 12 },
      readOnly: props.disabled,
    })

    monacoModel = monacoEditor.getModel()

    monacoEditor.onDidChangeModelContent(() => {
      if (isSyncing || !monacoEditor) {
        return
      }

      emitDraftValue(monacoEditor.getValue())
    })

    monacoEditor.onDidBlurEditorWidget(() => {
      emit('blur')
    })
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Failed to load Monaco editor.'
  } finally {
    loading.value = false
  }
}

function syncEditorValue(nextValue: string) {
  draftValue.value = nextValue

  if (!monacoEditor || nextValue === monacoEditor.getValue()) {
    return
  }

  isSyncing = true
  monacoEditor.setValue(nextValue)
  isSyncing = false
}

function onFallbackInput(event: Event) {
  emitDraftValue((event.target as HTMLTextAreaElement).value)
}

onMounted(() => {
  void createEditor()
})

onBeforeUnmount(() => {
  monacoEditor?.dispose()
  monacoModel?.dispose()
})

watch(() => props.modelValue, (value) => {
  syncEditorValue(normalizeCodeFieldValue(value))
})

watch(() => props.disabled, (disabled) => {
  monacoEditor?.updateOptions({ readOnly: disabled })
})

watch(() => props.language, async (language) => {
  if (!monacoEditor) {
    return
  }

  await applyLanguage(language)
})
</script>

<template>
  <div class="aimd-code-field" :class="{ 'aimd-code-field--disabled': disabled }">
    <div class="aimd-code-field__header">
      <div class="aimd-code-field__meta">
        <div class="aimd-code-field__title">
          {{ title || fieldId || "Code" }}
        </div>
        <div class="aimd-code-field__submeta">
          <span v-if="fieldId" class="aimd-code-field__submeta-item aimd-code-field__submeta-item--id">
            {{ fieldId }}
          </span>
          <span v-if="typeLabel" class="aimd-code-field__submeta-item">
            {{ typeLabel }}
          </span>
          <span v-if="description" class="aimd-code-field__submeta-item aimd-code-field__submeta-item--description">
            {{ description }}
          </span>
        </div>
      </div>
      <span class="aimd-code-field__language-badge" :title="formatAimdCodeEditorLanguageLabel(language)">
        {{ resolveLanguageBadge(language) }}
      </span>
    </div>

    <div class="aimd-code-field__surface">
      <div v-if="loadError" class="aimd-code-field__fallback-shell">
        <textarea
          class="aimd-code-field__fallback"
          :value="draftValue"
          :disabled="disabled"
          spellcheck="false"
          @input="onFallbackInput"
          @blur="emit('blur')"
        />
      </div>

      <template v-else>
        <div v-if="loading" class="aimd-code-field__loading">Loading code editor…</div>
        <div ref="editorContainer" class="aimd-code-field__editor" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.aimd-code-field {
  position: relative;
  width: 100%;
  min-width: 0;
  border: 1px solid rgba(144, 202, 249, 0.56);
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.07);
}

.aimd-code-field__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(247, 251, 255, 0.82) 100%);
}

.aimd-code-field__meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.aimd-code-field__title {
  color: #0f172a;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.35;
}

.aimd-code-field__submeta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.aimd-code-field__submeta-item {
  color: #667085;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.aimd-code-field__submeta-item--id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  text-transform: none;
  letter-spacing: 0.01em;
}

.aimd-code-field__submeta-item--description {
  text-transform: none;
  letter-spacing: 0;
  font-weight: 500;
}

.aimd-code-field__language-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: flex-start;
  padding: 4px 9px;
  border-radius: 999px;
  border: 1px solid rgba(83, 135, 242, 0.18);
  background: rgba(83, 135, 242, 0.08);
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.aimd-code-field__surface {
  position: relative;
  background: rgba(248, 250, 252, 0.82);
}

.aimd-code-field__loading,
.aimd-code-field__fallback-shell {
  display: flex;
  width: 100%;
  min-height: 260px;
  align-items: stretch;
}

.aimd-code-field__loading {
  position: absolute;
  inset: 0;
  z-index: 1;
  align-items: center;
  justify-content: center;
  color: #667085;
  font-size: 13px;
  background: linear-gradient(180deg, rgba(252, 253, 255, 0.94) 0%, rgba(247, 251, 255, 0.94) 100%);
}

.aimd-code-field__editor {
  width: 100%;
  min-height: 260px;
}

.aimd-code-field__editor :deep(.monaco-editor),
.aimd-code-field__editor :deep(.monaco-editor-background) {
  background: transparent;
}

.aimd-code-field__editor :deep(.margin),
.aimd-code-field__editor :deep(.monaco-editor .margin) {
  background: rgba(241, 245, 249, 0.92);
}

.aimd-code-field__fallback {
  width: 100%;
  min-height: 260px;
  padding: 14px 16px 16px;
  border: 0 none;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
  background: transparent;
  color: #101828;
  font-size: 13px;
  line-height: 1.6;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.aimd-code-field--disabled {
  opacity: 0.98;
}

.aimd-code-field--disabled .aimd-code-field__fallback {
  background: rgba(248, 251, 255, 0.7);
}

.aimd-code-field--disabled .aimd-code-field__language-badge {
  opacity: 0.78;
}
</style>
