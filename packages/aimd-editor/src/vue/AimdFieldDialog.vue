<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  AIMD_FIELD_TYPES,
  getDefaultAimdFields,
  buildAimdSyntax,
  type AimdFieldType,
} from './types'

const props = defineProps<{
  visible: boolean
  initialType?: string
  refSuggestions?: string[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'insert', syntax: string): void
}>()

const dialogType = ref(props.initialType || 'var')
const fields = ref<Record<string, string>>(getDefaultAimdFields(dialogType.value))

interface ChoiceOptionItem {
  key: string
  text: string
}

interface BlankItem {
  key: string
  answer: string
}

const quizChoiceOptions = ref<ChoiceOptionItem[]>([])
const quizBlankItems = ref<BlankItem[]>([])
const quizMultipleAnswers = ref<string[]>([])
const draggingChoiceIndex = ref<number | null>(null)
const dragOverChoiceIndex = ref<number | null>(null)
const formError = ref('')

function parseChoiceOptions(input: string): ChoiceOptionItem[] {
  const parts = input.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) {
    return [
      { key: 'A', text: 'Option A' },
      { key: 'B', text: 'Option B' },
    ]
  }

  return parts.map((part, index) => {
    const sepIndex = part.indexOf(':')
    if (sepIndex > 0) {
      const key = part.slice(0, sepIndex).trim() || String.fromCharCode(65 + index)
      const text = part.slice(sepIndex + 1).trim() || `Option ${key}`
      return { key, text }
    }
    const key = String.fromCharCode(65 + index)
    return { key, text: part }
  })
}

function serializeChoiceOptions(items: ChoiceOptionItem[]): string {
  const normalized = items
    .map(item => ({ key: item.key.trim(), text: item.text.trim() }))
    .filter(item => item.key && item.text)

  if (normalized.length === 0) {
    return 'A:Option A, B:Option B'
  }

  return normalized.map(item => `${item.key}:${item.text}`).join(', ')
}

function parseBlankItems(input: string): BlankItem[] {
  const parts = input.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) {
    return [{ key: 'b1', answer: '21%' }]
  }

  return parts.map((part, index) => {
    const sepIndex = part.indexOf(':')
    if (sepIndex > 0) {
      const key = part.slice(0, sepIndex).trim() || `b${index + 1}`
      const answer = part.slice(sepIndex + 1).trim() || ''
      return { key, answer }
    }
    return { key: `b${index + 1}`, answer: part }
  })
}

function serializeBlankItems(items: BlankItem[]): string {
  const normalized = items
    .map(item => ({ key: item.key.trim(), answer: item.answer.trim() }))
    .filter(item => item.key)

  if (normalized.length === 0) {
    return 'b1:21%'
  }

  return normalized.map(item => `${item.key}:${item.answer}`).join(', ')
}

function parseAnswerKeys(input: string): string[] {
  return input
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

function hydrateQuizDraftsFromFields() {
  if (dialogType.value !== 'quiz') return

  if (fields.value.quizType === 'choice') {
    quizChoiceOptions.value = parseChoiceOptions(fields.value.options || '')
    quizMultipleAnswers.value = parseAnswerKeys(fields.value.answer || '')
  }
  else if (fields.value.quizType === 'blank') {
    quizBlankItems.value = parseBlankItems(fields.value.blanks || '')
  }
}

function ensureChoiceAnswersValid() {
  if (dialogType.value !== 'quiz' || fields.value.quizType !== 'choice') return

  const optionKeys = new Set(
    quizChoiceOptions.value
      .map(option => option.key.trim())
      .filter(Boolean),
  )

  if (fields.value.mode === 'multiple') {
    const normalized = quizMultipleAnswers.value
      .map(key => key.trim())
      .filter(key => key && optionKeys.has(key))
    if (normalized.length !== quizMultipleAnswers.value.length) {
      quizMultipleAnswers.value = normalized
    }
  }
  else {
    const answer = (fields.value.answer || '').trim()
    if (answer && !optionKeys.has(answer)) {
      fields.value.answer = ''
    }
  }
}

function nextChoiceKey(): string {
  const used = new Set(
    quizChoiceOptions.value
      .map(option => option.key.trim().toUpperCase())
      .filter(Boolean),
  )

  for (let i = 0; i < 26; i++) {
    const candidate = String.fromCharCode(65 + i)
    if (!used.has(candidate)) return candidate
  }
  return `K${quizChoiceOptions.value.length + 1}`
}

function addChoiceOption() {
  const key = nextChoiceKey()
  quizChoiceOptions.value.push({ key, text: `Option ${key}` })
}

function removeChoiceOption(index: number) {
  if (quizChoiceOptions.value.length <= 1) return
  quizChoiceOptions.value.splice(index, 1)
}

function startChoiceDrag(index: number) {
  draggingChoiceIndex.value = index
  dragOverChoiceIndex.value = index
}

function onChoiceDragOver(index: number) {
  if (draggingChoiceIndex.value === null) return
  dragOverChoiceIndex.value = index
}

function dropChoiceAt(index: number) {
  const from = draggingChoiceIndex.value
  if (from === null || from === index) {
    draggingChoiceIndex.value = null
    dragOverChoiceIndex.value = null
    return
  }

  const moved = quizChoiceOptions.value.splice(from, 1)[0]
  quizChoiceOptions.value.splice(index, 0, moved)
  draggingChoiceIndex.value = null
  dragOverChoiceIndex.value = null
}

function endChoiceDrag() {
  draggingChoiceIndex.value = null
  dragOverChoiceIndex.value = null
}

function nextBlankKey(): string {
  const used = new Set(
    quizBlankItems.value
      .map(item => item.key.trim().toLowerCase())
      .filter(Boolean),
  )
  let index = 1
  while (used.has(`b${index}`)) {
    index += 1
  }
  return `b${index}`
}

function addBlankItem() {
  quizBlankItems.value.push({ key: nextBlankKey(), answer: '' })
}

function removeBlankItem(index: number) {
  if (quizBlankItems.value.length <= 1) return
  quizBlankItems.value.splice(index, 1)
}

function collectDuplicateValues(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const value of values) {
    if (seen.has(value) && !duplicates.includes(value)) {
      duplicates.push(value)
    }
    seen.add(value)
  }
  return duplicates
}

function extractBlankPlaceholders(stem: string): string[] {
  const keys: string[] = []
  const pattern = /\[\[([^\[\]\s]+)\]\]/g
  for (const match of stem.matchAll(pattern)) {
    keys.push(match[1])
  }
  return keys
}

function validateBlankQuizBeforeInsert(): string | null {
  const blankKeys = quizBlankItems.value
    .map(item => item.key.trim())
    .filter(Boolean)
  if (blankKeys.length === 0) {
    return 'Blank quiz requires at least one non-empty blank key.'
  }

  const duplicateBlankKeys = collectDuplicateValues(blankKeys)
  if (duplicateBlankKeys.length > 0) {
    return `Blank keys must be unique: ${duplicateBlankKeys.join(', ')}`
  }

  const stem = fields.value.stem || ''
  const placeholderKeys = extractBlankPlaceholders(stem)
  if (placeholderKeys.length === 0) {
    return 'Blank quiz stem must contain placeholders like [[b1]].'
  }

  const duplicatePlaceholders = collectDuplicateValues(placeholderKeys)
  if (duplicatePlaceholders.length > 0) {
    return `Stem contains duplicate placeholders: ${duplicatePlaceholders.join(', ')}`
  }

  const blankKeySet = new Set(blankKeys)
  const placeholderSet = new Set(placeholderKeys)
  const unknownPlaceholders = [...placeholderSet].filter(key => !blankKeySet.has(key))
  if (unknownPlaceholders.length > 0) {
    return `Stem contains undefined placeholders: ${unknownPlaceholders.join(', ')}`
  }

  const missingPlaceholders = [...blankKeySet].filter(key => !placeholderSet.has(key))
  if (missingPlaceholders.length > 0) {
    return `Stem is missing placeholders for blank keys: ${missingPlaceholders.join(', ')}`
  }

  return null
}

function validateBeforeInsert(): string | null {
  if (dialogType.value !== 'quiz') return null
  if (fields.value.quizType !== 'blank') return null
  return validateBlankQuizBeforeInsert()
}

watch(() => props.initialType, (t) => {
  if (t) {
    dialogType.value = t
    fields.value = getDefaultAimdFields(t)
    hydrateQuizDraftsFromFields()
    formError.value = ''
  }
})

watch(() => props.visible, (v) => {
  if (v) {
    fields.value = getDefaultAimdFields(dialogType.value)
    hydrateQuizDraftsFromFields()
    formError.value = ''
  }
})

function switchType(type: string) {
  dialogType.value = type
  fields.value = getDefaultAimdFields(type)
  hydrateQuizDraftsFromFields()
  formError.value = ''
}

const preview = computed(() => buildAimdSyntax(dialogType.value, fields.value))

function getTypeInfo(type: string): AimdFieldType {
  return AIMD_FIELD_TYPES.find(f => f.type === type) || { type, label: type, icon: '?', svgIcon: '', desc: '', color: '#666' }
}

const currentType = computed(() => getTypeInfo(dialogType.value))

const suggestions = computed(() => {
  if (!props.refSuggestions) return []
  return props.refSuggestions
})

watch(() => [dialogType.value, fields.value.quizType], ([type, quizType], [prevType, prevQuizType]) => {
  if (type !== 'quiz') return
  if (type !== prevType || quizType !== prevQuizType) {
    hydrateQuizDraftsFromFields()
  }
})

watch(() => fields.value.mode, () => {
  ensureChoiceAnswersValid()
})

watch(quizChoiceOptions, (items) => {
  if (dialogType.value === 'quiz' && fields.value.quizType === 'choice') {
    fields.value.options = serializeChoiceOptions(items)
    ensureChoiceAnswersValid()
  }
}, { deep: true })

watch(quizBlankItems, (items) => {
  if (dialogType.value === 'quiz' && fields.value.quizType === 'blank') {
    fields.value.blanks = serializeBlankItems(items)
  }
}, { deep: true })

watch(quizMultipleAnswers, (answers) => {
  if (dialogType.value === 'quiz' && fields.value.quizType === 'choice' && fields.value.mode === 'multiple') {
    fields.value.answer = answers.join(', ')
  }
}, { deep: true })

watch(fields, () => {
  if (formError.value) {
    formError.value = ''
  }
}, { deep: true })

watch(quizBlankItems, () => {
  if (formError.value) {
    formError.value = ''
  }
}, { deep: true })

function doInsert() {
  const validationError = validateBeforeInsert()
  if (validationError) {
    formError.value = validationError
    return
  }

  formError.value = ''
  emit('insert', buildAimdSyntax(dialogType.value, fields.value))
  emit('update:visible', false)
}

function close() {
  emit('update:visible', false)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="aimd-dialog-overlay" @click.self="close">
      <div class="aimd-dialog">
        <div class="aimd-dialog-header">
          <span class="aimd-dialog-title">
            <span class="aimd-dialog-icon" :style="{ color: currentType.color }" v-html="currentType.svgIcon" />
            Insert AIMD {{ currentType.label }}
          </span>
          <button class="aimd-dialog-close" @click="close">&times;</button>
        </div>

        <!-- Type selector tabs -->
        <div class="aimd-dialog-type-tabs">
          <button
            v-for="ft in AIMD_FIELD_TYPES"
            :key="ft.type"
            :class="['aimd-type-tab', { active: dialogType === ft.type }]"
            :style="dialogType === ft.type ? { borderColor: ft.color, color: ft.color, background: `${ft.color}14` } : {}"
            @click="switchType(ft.type)"
          >
            <span v-html="ft.svgIcon" class="aimd-type-tab-icon" /> {{ ft.label }}
          </button>
        </div>

        <div class="aimd-dialog-body">
          <!-- var fields -->
          <template v-if="dialogType === 'var'">
            <label class="aimd-field-row">
              <span class="aimd-field-label">Variable ID <em>*</em></span>
              <input v-model="fields.name" placeholder="sample_id" class="aimd-field-input" />
            </label>
            <label class="aimd-field-row">
              <span class="aimd-field-label">Type</span>
              <select v-model="fields.type" class="aimd-field-input">
                <option value="">None</option>
                <option value="str">str</option>
                <option value="int">int</option>
                <option value="float">float</option>
                <option value="bool">bool</option>
                <option value="list">list</option>
                <option value="dict">dict</option>
              </select>
            </label>
            <label class="aimd-field-row">
              <span class="aimd-field-label">Default Value</span>
              <input v-model="fields.default" placeholder="Optional" class="aimd-field-input" />
            </label>
            <label class="aimd-field-row">
              <span class="aimd-field-label">Title</span>
              <input v-model="fields.title" placeholder="Display title (optional)" class="aimd-field-input" />
            </label>
          </template>

          <!-- var_table fields -->
          <template v-if="dialogType === 'var_table'">
            <label class="aimd-field-row">
              <span class="aimd-field-label">Table ID <em>*</em></span>
              <input v-model="fields.name" placeholder="table_id" class="aimd-field-input" />
            </label>
            <label class="aimd-field-row">
              <span class="aimd-field-label">Sub-variable Columns</span>
              <input v-model="fields.subvars" placeholder="col1, col2, col3" class="aimd-field-input" />
              <span class="aimd-field-hint">Comma-separated column names</span>
            </label>
          </template>

          <!-- step fields -->
          <template v-if="dialogType === 'step'">
            <label class="aimd-field-row">
              <span class="aimd-field-label">Step ID <em>*</em></span>
              <input v-model="fields.name" placeholder="step_id" class="aimd-field-input" />
            </label>
            <label class="aimd-field-row">
              <span class="aimd-field-label">Level</span>
              <select v-model="fields.level" class="aimd-field-input">
                <option value="1">1 (Top level)</option>
                <option value="2">2 (Sub-step)</option>
                <option value="3">3 (Sub-sub-step)</option>
              </select>
            </label>
          </template>

          <!-- quiz fields -->
          <template v-if="dialogType === 'quiz'">
            <label class="aimd-field-row">
              <span class="aimd-field-label">Quiz ID <em>*</em></span>
              <input v-model="fields.id" placeholder="quiz_choice_1" class="aimd-field-input" />
            </label>

            <label class="aimd-field-row">
              <span class="aimd-field-label">Question Type</span>
              <select v-model="fields.quizType" class="aimd-field-input">
                <option value="choice">choice</option>
                <option value="blank">blank</option>
                <option value="open">open</option>
              </select>
            </label>

            <label class="aimd-field-row">
              <span class="aimd-field-label">Score</span>
              <input v-model="fields.score" placeholder="Optional, e.g. 5" class="aimd-field-input" />
            </label>

            <label class="aimd-field-row">
              <span class="aimd-field-label">Stem <em>*</em></span>
              <textarea v-model="fields.stem" placeholder="Question stem" class="aimd-field-input aimd-field-textarea" />
              <span v-if="fields.quizType === 'blank'" class="aimd-field-hint">
                Use placeholders in stem like [[b1]], [[b2]] and keep keys consistent with the blanks list.
              </span>
            </label>

            <template v-if="fields.quizType === 'choice'">
              <label class="aimd-field-row">
                <span class="aimd-field-label">Mode</span>
                <select v-model="fields.mode" class="aimd-field-input">
                  <option value="single">single</option>
                  <option value="multiple">multiple</option>
                </select>
              </label>

              <div class="aimd-field-row">
                <span class="aimd-field-label">Options</span>
                <div class="aimd-collection-editor">
                  <div
                    v-for="(option, index) in quizChoiceOptions"
                    :key="`choice-option-${index}`"
                    class="aimd-collection-row aimd-option-row"
                    :class="{ 'aimd-option-row-dragover': dragOverChoiceIndex === index && draggingChoiceIndex !== null && draggingChoiceIndex !== index }"
                    @dragover.prevent="onChoiceDragOver(index)"
                    @drop.prevent="dropChoiceAt(index)"
                  >
                    <span
                      class="aimd-drag-handle"
                      title="Drag to reorder"
                      draggable="true"
                      @dragstart="startChoiceDrag(index)"
                      @dragend="endChoiceDrag"
                    >
                      ⋮⋮
                    </span>
                    <label class="aimd-option-answer-toggle">
                      <input
                        v-if="fields.mode === 'single'"
                        v-model="fields.answer"
                        type="radio"
                        name="aimd-quiz-choice-answer"
                        :value="option.key.trim()"
                        :disabled="!option.key.trim()"
                      />
                      <input
                        v-else
                        v-model="quizMultipleAnswers"
                        type="checkbox"
                        :value="option.key.trim()"
                        :disabled="!option.key.trim()"
                      />
                      <span>{{ fields.mode === 'single' ? 'Answer' : 'Correct' }}</span>
                    </label>
                    <input v-model="option.key" placeholder="A" class="aimd-field-input" />
                    <input v-model="option.text" placeholder="Option text" class="aimd-field-input" />
                    <button
                      type="button"
                      class="aimd-mini-btn"
                      :disabled="quizChoiceOptions.length <= 1"
                      @click="removeChoiceOption(index)"
                    >
                      Remove
                    </button>
                  </div>
                  <button type="button" class="aimd-mini-btn aimd-mini-btn-add" @click="addChoiceOption">
                    + Add option
                  </button>
                </div>
                <span class="aimd-field-hint">Use unique keys (A/B/C), then mark answer directly in each row.</span>
              </div>
            </template>

            <template v-else-if="fields.quizType === 'blank'">
              <div class="aimd-field-row">
                <span class="aimd-field-label">Blanks</span>
                <div class="aimd-collection-editor">
                  <div v-for="(blank, index) in quizBlankItems" :key="`blank-item-${index}`" class="aimd-collection-row">
                    <input v-model="blank.key" placeholder="b1" class="aimd-field-input" />
                    <input v-model="blank.answer" placeholder="Expected answer" class="aimd-field-input" />
                    <button
                      type="button"
                      class="aimd-mini-btn"
                      :disabled="quizBlankItems.length <= 1"
                      @click="removeBlankItem(index)"
                    >
                      Remove
                    </button>
                  </div>
                  <button type="button" class="aimd-mini-btn aimd-mini-btn-add" @click="addBlankItem">
                    + Add blank
                  </button>
                </div>
                <span class="aimd-field-hint">Use keys like b1, b2 and refer to them in stem as [[b1]], [[b2]].</span>
              </div>
            </template>

            <template v-else>
              <label class="aimd-field-row">
                <span class="aimd-field-label">Rubric</span>
                <textarea v-model="fields.rubric" placeholder="Optional rubric" class="aimd-field-input aimd-field-textarea" />
              </label>
            </template>
          </template>

          <!-- check fields -->
          <template v-if="dialogType === 'check'">
            <label class="aimd-field-row">
              <span class="aimd-field-label">Checkpoint ID <em>*</em></span>
              <input v-model="fields.name" placeholder="check_id" class="aimd-field-input" />
            </label>
          </template>

          <!-- ref_step / ref_var / ref_fig -->
          <template v-if="['ref_step', 'ref_var', 'ref_fig'].includes(dialogType)">
            <label class="aimd-field-row">
              <span class="aimd-field-label">
                {{
                  dialogType === 'ref_step'
                    ? 'Referenced Step ID'
                    : dialogType === 'ref_var'
                      ? 'Referenced Variable ID'
                      : 'Referenced Figure ID'
                }}
                <em>*</em>
              </span>
              <input
                v-model="fields.name"
                :placeholder="dialogType === 'ref_step' ? 'step_id' : dialogType === 'ref_var' ? 'var_id' : 'fig_id'"
                class="aimd-field-input"
                list="aimd-ref-suggestions"
              />
              <datalist id="aimd-ref-suggestions">
                <option v-for="s in suggestions" :key="s" :value="s" />
              </datalist>
              <span v-if="suggestions.length" class="aimd-field-hint">
                Available: {{ suggestions.join(', ') }}
              </span>
            </label>
          </template>

          <!-- cite -->
          <template v-if="dialogType === 'cite'">
            <label class="aimd-field-row">
              <span class="aimd-field-label">Citation ID <em>*</em></span>
              <input v-model="fields.refs" placeholder="ref1, ref2" class="aimd-field-input" />
              <span class="aimd-field-hint">Comma-separated citation IDs</span>
            </label>
          </template>

          <!-- Preview -->
          <div class="aimd-dialog-preview">
            <div class="aimd-preview-header">Preview</div>
            <pre class="aimd-preview-panel"><code class="aimd-preview-code">{{ preview }}</code></pre>
          </div>

          <div v-if="formError" class="aimd-dialog-error">
            {{ formError }}
          </div>
        </div>

        <div class="aimd-dialog-footer">
          <button class="aimd-btn aimd-btn-cancel" @click="close">Cancel</button>
          <button class="aimd-btn aimd-btn-primary" @click="doInsert">Insert</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
.aimd-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(2px);
}

.aimd-dialog {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  width: 520px;
  max-width: 90vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.aimd-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
}

.aimd-dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
  display: flex;
  align-items: center;
  gap: 8px;
}

.aimd-dialog-icon {
  display: flex;
  align-items: center;
}

.aimd-dialog-icon svg {
  width: 20px;
  height: 20px;
}

.aimd-dialog-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 22px;
  color: #999;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.aimd-dialog-close:hover {
  background: #f0f2f5;
  color: #333;
}

.aimd-dialog-type-tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
  padding: 10px 12px;
  gap: 8px;
}

.aimd-type-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
  transition: all 0.15s;
}

.aimd-type-tab:hover {
  color: #374151;
  border-color: #d1d5db;
  background: #f8fafc;
}

.aimd-type-tab-icon {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.aimd-type-tab-icon svg {
  width: 14px;
  height: 14px;
}

.aimd-type-tab.active {
  font-weight: 600;
}

.aimd-dialog-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}

.aimd-field-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.aimd-field-label {
  font-size: 13px;
  font-weight: 500;
  color: #444;
}

.aimd-field-label em {
  color: #dc2626;
  font-style: normal;
}

.aimd-field-input {
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}

.aimd-field-input:focus {
  border-color: #1a73e8;
  box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.1);
}

.aimd-field-textarea {
  min-height: 72px;
  resize: vertical;
}

.aimd-field-hint {
  font-size: 11px;
  color: #999;
}

.aimd-collection-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.aimd-collection-row {
  display: grid;
  grid-template-columns: 90px 1fr auto;
  gap: 8px;
  align-items: center;
}

.aimd-option-row {
  grid-template-columns: 26px 96px 90px 1fr auto;
}

.aimd-option-row-dragover {
  background: #eff6ff;
  border-radius: 6px;
}

.aimd-option-answer-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #4b5563;
  font-size: 12px;
  user-select: none;
}

.aimd-option-answer-toggle input {
  margin: 0;
}

.aimd-drag-handle {
  color: #9ca3af;
  cursor: grab;
  user-select: none;
  text-align: center;
  font-size: 14px;
  line-height: 1;
}

.aimd-drag-handle:active {
  cursor: grabbing;
}

.aimd-mini-btn {
  border: 1px solid #d8dee8;
  background: #fff;
  color: #4b5563;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}

.aimd-mini-btn:hover {
  background: #f8fafc;
}

.aimd-mini-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.aimd-mini-btn-add {
  align-self: flex-start;
}

.aimd-dialog-preview {
  padding: 12px 14px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.aimd-preview-header {
  display: block;
  font-size: 12px;
  color: #6b7280;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.aimd-preview-panel {
  display: block;
  width: 100%;
  margin: 0;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid #dbe3ef;
  background: #fff;
  overflow: auto;
  max-height: 280px;
  line-height: 1.5;
}

.aimd-preview-code {
  display: block;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
  color: #2563eb;
  word-break: break-word;
  white-space: pre-wrap;
}

.aimd-dialog-error {
  padding: 10px 12px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
}

.aimd-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid #f0f0f0;
}

.aimd-btn {
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.aimd-btn-cancel {
  border: 1px solid #e0e0e0;
  background: #fff;
  color: #666;
}

.aimd-btn-cancel:hover {
  background: #f5f5f5;
}

.aimd-btn-primary {
  border: none;
  background: #1a73e8;
  color: #fff;
}

.aimd-btn-primary:hover {
  background: #1557b0;
}
</style>
