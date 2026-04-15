<script setup lang="ts">
import { computed } from "vue"
import {
  gradeScaleQuizLocally,
  isScaleQuizAnswerComplete,
} from "@airalogy/aimd-core"
import {
  type AimdQuizField,
  type AimdQuizGradeResult,
} from "@airalogy/aimd-core/types"
import type { AimdRecorderMessagesInput } from "../locales"
import type { AimdChoiceOptionExplanationMode, AimdScaleGradeDisplayMode } from "../types"
import {
  createAimdRecorderMessages,
  getAimdRecorderQuizTypeLabel,
  getAimdRecorderScopeLabel,
} from "../locales"

interface StemTextSegment {
  type: "text"
  value: string
}

interface StemBlankSegment {
  type: "blank"
  key: string
}

type StemSegment = StemTextSegment | StemBlankSegment

const props = withDefaults(defineProps<{
  quiz: AimdQuizField
  modelValue: unknown
  grade?: AimdQuizGradeResult | null
  submitted?: boolean
  readonly?: boolean
  focusKeyPrefix?: string
  locale?: string
  messages?: AimdRecorderMessagesInput
  choiceOptionExplanationMode?: AimdChoiceOptionExplanationMode
  scaleGradeDisplayMode?: AimdScaleGradeDisplayMode
}>(), {
  grade: null,
  submitted: false,
  readonly: false,
  focusKeyPrefix: undefined,
  locale: undefined,
  messages: undefined,
  choiceOptionExplanationMode: "hidden",
  scaleGradeDisplayMode: "hidden",
})

const emit = defineEmits<{
  (e: "update:modelValue", value: unknown): void
}>()

const BLANK_PLACEHOLDER_PATTERN = /\[\[([^\[\]\s]+)\]\]/g

const stemSegments = computed<StemSegment[]>(() => {
  const stem = props.quiz.stem || ""
  if (props.quiz.type !== "blank") {
    return [{ type: "text", value: stem }]
  }

  const segments: StemSegment[] = []
  let lastIndex = 0

  for (const match of stem.matchAll(BLANK_PLACEHOLDER_PATTERN)) {
    const start = match.index ?? 0
    if (start > lastIndex) {
      segments.push({
        type: "text",
        value: stem.slice(lastIndex, start),
      })
    }
    segments.push({
      type: "blank",
      key: match[1],
    })
    lastIndex = start + match[0].length
  }

  if (lastIndex < stem.length) {
    segments.push({
      type: "text",
      value: stem.slice(lastIndex),
    })
  }

  return segments.length > 0
    ? segments
    : [{ type: "text", value: stem }]
})

const singleChoiceValue = computed<string>({
  get() {
    return typeof props.modelValue === "string" ? props.modelValue : ""
  },
  set(value) {
    emit("update:modelValue", value)
  },
})

const multipleChoiceValue = computed<string[]>(() => {
  if (!Array.isArray(props.modelValue)) {
    return []
  }
  return props.modelValue.filter((item): item is string => typeof item === "string")
})

const selectedChoiceKeys = computed<string[]>(() => {
  if (props.quiz.type !== "choice") {
    return []
  }

  if (props.quiz.mode === "single") {
    return singleChoiceValue.value ? [singleChoiceValue.value] : []
  }

  return multipleChoiceValue.value
})

function isMultipleChecked(key: string): boolean {
  return multipleChoiceValue.value.includes(key)
}

function toggleMultipleChoice(key: string, checked: boolean): void {
  const current = multipleChoiceValue.value
  const next = checked
    ? [...new Set([...current, key])]
    : current.filter(item => item !== key)
  emit("update:modelValue", next)
}

function asBlankValueMap(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {}
  }

  const result: Record<string, string> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") {
      result[key] = item
    }
  }
  return result
}

function getBlankValue(key: string): string {
  return asBlankValueMap(props.modelValue)[key] || ""
}

function setBlankValue(key: string, value: string): void {
  const next = {
    ...asBlankValueMap(props.modelValue),
    [key]: value,
  }
  emit("update:modelValue", next)
}

function asScaleValueMap(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {}
  }

  const result: Record<string, string> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") {
      result[key] = item
    }
  }
  return result
}

function getScaleItemValue(key: string): string {
  return asScaleValueMap(props.modelValue)[key] || ""
}

function setScaleItemValue(key: string, value: string): void {
  const next = {
    ...asScaleValueMap(props.modelValue),
    [key]: value,
  }
  emit("update:modelValue", next)
}

const openValue = computed<string>({
  get() {
    return typeof props.modelValue === "string" ? props.modelValue : ""
  },
  set(value) {
    emit("update:modelValue", value)
  },
})

function formatScaleOptionLabel(option: NonNullable<AimdQuizField["options"]>[number]): string {
  if (typeof option.points === "number" && Number.isFinite(option.points)) {
    return `${option.text} (${option.points})`
  }
  return option.text
}

const resolvedMessages = computed(() => createAimdRecorderMessages(props.locale, props.messages))
const quizTypeLabel = computed(() => getAimdRecorderQuizTypeLabel(props.quiz.type, resolvedMessages.value, props.quiz.mode))
const resolvedScaleItems = computed(() => (
  props.quiz.type === "scale" && Array.isArray(props.quiz.items) ? props.quiz.items : []
))
const resolvedScaleOptions = computed(() => (
  props.quiz.type === "scale" && Array.isArray(props.quiz.options) ? props.quiz.options : []
))
const isScaleComplete = computed(() => (
  props.quiz.type === "scale" && isScaleQuizAnswerComplete(props.quiz, props.modelValue)
))
const localScaleGrade = computed<AimdQuizGradeResult | null>(() => {
  if (props.quiz.type !== "scale" || !isScaleComplete.value) {
    return null
  }
  return gradeScaleQuizLocally(props.quiz, props.modelValue)
})
const effectiveGrade = computed<AimdQuizGradeResult | null>(() => {
  if (props.grade) {
    return props.grade
  }

  if (props.quiz.type !== "scale") {
    return null
  }

  switch (props.scaleGradeDisplayMode) {
    case "completed":
      return localScaleGrade.value
    case "submitted":
      return props.submitted ? localScaleGrade.value : null
    default:
      return null
  }
})
const gradeStatusTone = computed(() => {
  const status = effectiveGrade.value?.status
  switch (status) {
    case "correct":
      return "correct"
    case "incorrect":
      return "incorrect"
    case "partial":
      return "partial"
    case "scored":
      return "scored"
    case "needs_review":
      return "needs-review"
    case "error":
      return "error"
    default:
      return "ungraded"
  }
})
const gradeStatusLabel = computed(() => {
  const status = effectiveGrade.value?.status
  if (!status) {
    return ""
  }

  switch (status) {
    case "correct":
      return resolvedMessages.value.quiz.status.correct
    case "incorrect":
      return resolvedMessages.value.quiz.status.incorrect
    case "partial":
      return resolvedMessages.value.quiz.status.partial
    case "scored":
      return resolvedMessages.value.quiz.status.scored
    case "needs_review":
      return resolvedMessages.value.quiz.status.needsReview
    case "error":
      return resolvedMessages.value.quiz.status.error
    default:
      return resolvedMessages.value.quiz.status.ungraded
  }
})
const blankGradeResults = computed(() => Array.isArray(effectiveGrade.value?.blank_results) ? effectiveGrade.value.blank_results : [])
const rubricGradeResults = computed(() => Array.isArray(effectiveGrade.value?.rubric_results) ? effectiveGrade.value.rubric_results : [])
const hasResolvedGrade = computed(() => Boolean(effectiveGrade.value && effectiveGrade.value.status !== "ungraded"))
const showGradePanel = computed(() => {
  if (!effectiveGrade.value) {
    return false
  }

  if (
    effectiveGrade.value.status === "ungraded"
    && !effectiveGrade.value.feedback
    && !effectiveGrade.value.review_required
    && !effectiveGrade.value.band
    && blankGradeResults.value.length === 0
    && rubricGradeResults.value.length === 0
  ) {
    return false
  }

  return true
})

function shouldShowChoiceOptionExplanation(optionKey: string, explanation?: string): boolean {
  if (!explanation?.trim()) {
    return false
  }

  if (!selectedChoiceKeys.value.includes(optionKey)) {
    return false
  }

  if (props.choiceOptionExplanationMode === "selected") {
    return true
  }

  if (props.choiceOptionExplanationMode === "submitted") {
    return props.submitted
  }

  if (props.choiceOptionExplanationMode === "graded") {
    return hasResolvedGrade.value
  }

  return false
}
</script>

<template>
  <div class="aimd-quiz-recorder aimd-field aimd-field--quiz">
    <div class="aimd-quiz__meta">
      <span class="aimd-field__scope">{{ getAimdRecorderScopeLabel('quiz', resolvedMessages) }}</span>
      <span class="aimd-field__name">{{ quiz.id }}</span>
      <span class="aimd-field__type">({{ quizTypeLabel }})</span>
      <span v-if="typeof quiz.score === 'number'" class="aimd-quiz__score">{{ resolvedMessages.quiz.score(quiz.score) }}</span>
    </div>

    <div v-if="quiz.title" class="aimd-quiz__title">
      {{ quiz.title }}
    </div>

    <div class="aimd-quiz__stem">
      <template v-for="(segment, index) in stemSegments" :key="`${quiz.id}-stem-${index}`">
        <template v-if="segment.type === 'text'">
          <span class="aimd-quiz-recorder__stem-text">{{ segment.value }}</span>
        </template>
        <template v-else>
          <input
            class="aimd-quiz-recorder__blank-input"
            type="text"
            :data-rec-focus-key="`${focusKeyPrefix || `quiz:${quiz.id}`}:blank:${segment.key}`"
            :placeholder="segment.key"
            :readonly="readonly"
            :value="getBlankValue(segment.key)"
            @input="setBlankValue(segment.key, ($event.target as HTMLInputElement).value)"
          />
        </template>
      </template>
    </div>

    <div v-if="quiz.description" class="aimd-quiz__description">
      {{ quiz.description }}
    </div>

    <div v-if="quiz.type === 'choice' && quiz.mode === 'single' && quiz.options?.length" class="aimd-quiz-recorder__options">
      <label v-for="option in quiz.options" :key="`${quiz.id}-single-${option.key}`" class="aimd-quiz-recorder__option">
        <input
          v-model="singleChoiceValue"
          type="radio"
          class="aimd-quiz-recorder__choice-input"
          :data-rec-focus-key="`${focusKeyPrefix || `quiz:${quiz.id}`}:single:${option.key}`"
          :name="`${quiz.id}-single`"
          :value="option.key"
          :disabled="readonly"
        />
        <span class="aimd-quiz-recorder__option-content">
          <span class="aimd-quiz-recorder__option-label">{{ option.key }}. {{ option.text }}</span>
          <span
            v-if="shouldShowChoiceOptionExplanation(option.key, option.explanation)"
            class="aimd-quiz-recorder__option-explanation"
          >
            {{ option.explanation }}
          </span>
        </span>
      </label>
    </div>

    <div v-if="quiz.type === 'choice' && quiz.mode === 'multiple' && quiz.options?.length" class="aimd-quiz-recorder__options">
      <label v-for="option in quiz.options" :key="`${quiz.id}-multiple-${option.key}`" class="aimd-quiz-recorder__option">
        <input
          type="checkbox"
          class="aimd-quiz-recorder__choice-input"
          :data-rec-focus-key="`${focusKeyPrefix || `quiz:${quiz.id}`}:multiple:${option.key}`"
          :disabled="readonly"
          :checked="isMultipleChecked(option.key)"
          @change="toggleMultipleChoice(option.key, ($event.target as HTMLInputElement).checked)"
        />
        <span class="aimd-quiz-recorder__option-content">
          <span class="aimd-quiz-recorder__option-label">{{ option.key }}. {{ option.text }}</span>
          <span
            v-if="shouldShowChoiceOptionExplanation(option.key, option.explanation)"
            class="aimd-quiz-recorder__option-explanation"
          >
            {{ option.explanation }}
          </span>
        </span>
      </label>
    </div>

    <textarea
      v-if="quiz.type === 'open'"
      v-model="openValue"
      class="aimd-quiz-recorder__open-input"
      :data-rec-focus-key="`${focusKeyPrefix || `quiz:${quiz.id}`}:open`"
      :placeholder="resolvedMessages.quiz.openPlaceholder"
      rows="4"
      :readonly="readonly"
    />

    <div
      v-if="quiz.type === 'scale' && resolvedScaleItems.length && resolvedScaleOptions.length && quiz.display === 'list'"
      class="aimd-scale"
    >
      <div
        v-for="item in resolvedScaleItems"
        :key="`${quiz.id}-scale-list-${item.key}`"
        class="aimd-scale__list-item"
      >
        <div class="aimd-scale__item-stem">
          {{ item.stem }}
        </div>
        <div class="aimd-scale__item-options">
          <label
            v-for="option in resolvedScaleOptions"
            :key="`${quiz.id}-scale-list-${item.key}-${option.key}`"
            class="aimd-scale__option"
          >
            <input
              type="radio"
              class="aimd-quiz-recorder__choice-input"
              :data-rec-focus-key="`${focusKeyPrefix || `quiz:${quiz.id}`}:scale:${item.key}:${option.key}`"
              :name="`${quiz.id}-scale-${item.key}`"
              :value="option.key"
              :checked="getScaleItemValue(item.key) === option.key"
              :disabled="readonly"
              @change="setScaleItemValue(item.key, option.key)"
            />
            <span>{{ formatScaleOptionLabel(option) }}</span>
          </label>
        </div>
      </div>
    </div>

    <div
      v-if="quiz.type === 'scale' && resolvedScaleItems.length && resolvedScaleOptions.length && quiz.display !== 'list'"
      class="aimd-scale"
    >
      <table class="aimd-scale__table">
        <thead>
          <tr>
            <th class="aimd-scale__item-header">Item</th>
            <th v-for="option in resolvedScaleOptions" :key="`${quiz.id}-scale-head-${option.key}`">
              {{ formatScaleOptionLabel(option) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in resolvedScaleItems" :key="`${quiz.id}-scale-row-${item.key}`">
            <th class="aimd-scale__item-stem" scope="row">
              {{ item.stem }}
            </th>
            <td v-for="option in resolvedScaleOptions" :key="`${quiz.id}-scale-cell-${item.key}-${option.key}`" class="aimd-scale__cell">
              <label class="aimd-scale__cell-label">
                <input
                  type="radio"
                  class="aimd-quiz-recorder__choice-input"
                  :data-rec-focus-key="`${focusKeyPrefix || `quiz:${quiz.id}`}:scale:${item.key}:${option.key}`"
                  :name="`${quiz.id}-scale-${item.key}`"
                  :value="option.key"
                  :checked="getScaleItemValue(item.key) === option.key"
                  :disabled="readonly"
                  @change="setScaleItemValue(item.key, option.key)"
                />
              </label>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="effectiveGrade && showGradePanel" :class="['aimd-quiz__grade-panel', `aimd-quiz__grade-panel--${gradeStatusTone}`]">
      <div class="aimd-quiz__grade-meta">
        <span :class="['aimd-quiz__grade-status', `aimd-quiz__grade-status--${gradeStatusTone}`]">{{ gradeStatusLabel }}</span>
        <span :class="['aimd-quiz__grade-score', `aimd-quiz__grade-score--${gradeStatusTone}`]">
          {{ resolvedMessages.quiz.gradedScore(effectiveGrade.earned_score, effectiveGrade.max_score) }}
        </span>
      </div>

      <div v-if="effectiveGrade.band" class="aimd-quiz__grade-band">
        <strong>{{ resolvedMessages.quiz.classification }}:</strong> {{ effectiveGrade.band.label }}
      </div>

      <div v-if="effectiveGrade.band?.interpretation" class="aimd-quiz__grade-band">
        <strong>{{ resolvedMessages.quiz.interpretation }}:</strong> {{ effectiveGrade.band.interpretation }}
      </div>

      <div v-if="effectiveGrade.review_required" class="aimd-quiz__grade-review">
        {{ resolvedMessages.quiz.reviewRequired }}
      </div>

      <div v-if="effectiveGrade.feedback" class="aimd-quiz__grade-feedback">
        <strong>{{ resolvedMessages.quiz.feedback }}:</strong> {{ effectiveGrade.feedback }}
      </div>

      <ul v-if="blankGradeResults.length" class="aimd-quiz__grade-list">
        <li v-for="item in blankGradeResults" :key="`${quiz.id}-grade-blank-${item.key}`">
          {{ item.key }} · {{ resolvedMessages.quiz.gradedScore(item.earned_score, item.max_score) }}
        </li>
      </ul>

      <ul v-if="rubricGradeResults.length" class="aimd-quiz__grade-list">
        <li v-for="item in rubricGradeResults" :key="`${quiz.id}-grade-rubric-${item.id}`">
          {{ item.id }} · {{ resolvedMessages.quiz.gradedScore(item.earned_score, item.max_score) }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.aimd-quiz-recorder {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  text-align: left;
}

.aimd-quiz__meta,
.aimd-quiz__stem {
  text-align: left;
}

.aimd-quiz__meta {
  gap: 4px;
  justify-content: flex-start;
}

.aimd-quiz-recorder__stem-text {
  white-space: pre-wrap;
}

.aimd-quiz__title {
  font-size: 16px;
  font-weight: 700;
  color: #3b2f2f;
}

.aimd-quiz__stem {
  margin-top: 0;
  line-height: 1.45;
}

.aimd-quiz__description {
  font-size: 13px;
  line-height: 1.45;
  color: #6d4c41;
  white-space: pre-wrap;
}

.aimd-quiz-recorder__options {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 0;
}

.aimd-quiz-recorder__option {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 6px;
  cursor: pointer;
  text-align: left;
}

.aimd-quiz-recorder__option-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.aimd-quiz-recorder__option-label {
  text-align: left;
}

.aimd-quiz-recorder__option-explanation {
  color: #667085;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
}

.aimd-quiz-recorder__choice-input {
  width: 16px;
  height: 16px;
  accent-color: #4181fd;
}

.aimd-quiz-recorder__open-input,
.aimd-quiz-recorder__blank-input {
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 14px;
  line-height: 1.4;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.aimd-quiz-recorder__open-input {
  width: 100%;
  resize: vertical;
  text-align: left;
}

.aimd-quiz-recorder__blank-input {
  display: inline-flex;
  min-width: 84px;
  margin: 0 2px;
  text-align: left;
  vertical-align: baseline;
}

.aimd-quiz-recorder__open-input:focus,
.aimd-quiz-recorder__blank-input:focus {
  border-color: #4181fd;
  box-shadow: 0 0 0 2px rgba(65, 129, 253, 0.1);
}

.aimd-scale {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.aimd-scale__table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.aimd-scale__table th,
.aimd-scale__table td {
  border: 1px solid #f1d8a7;
  padding: 8px 10px;
  text-align: center;
  vertical-align: middle;
}

.aimd-scale__table thead th {
  background: #fff4d6;
  font-size: 12px;
  font-weight: 600;
}

.aimd-scale__item-header,
.aimd-scale__item-stem {
  text-align: left;
}

.aimd-scale__item-stem {
  width: 34%;
  font-weight: 500;
  line-height: 1.4;
}

.aimd-scale__cell-label,
.aimd-scale__option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.aimd-scale__list-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #f1d8a7;
  border-radius: 8px;
  background: #fffdf7;
}

.aimd-scale__item-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
}

.aimd-scale__option {
  justify-content: flex-start;
}

.aimd-quiz__grade-panel {
  --aimd-quiz-grade-accent: #667085;
  --aimd-quiz-grade-border: #d0d5dd;
  --aimd-quiz-grade-bg: #f8fafc;
  margin-top: 4px;
  padding: 10px 12px;
  border: 1px solid var(--aimd-quiz-grade-border);
  border-left: 4px solid var(--aimd-quiz-grade-accent);
  border-radius: 8px;
  background: var(--aimd-quiz-grade-bg);
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.aimd-quiz__grade-panel--correct {
  --aimd-quiz-grade-accent: #15803d;
  --aimd-quiz-grade-border: #bbf7d0;
  --aimd-quiz-grade-bg: #f0fdf4;
}

.aimd-quiz__grade-panel--incorrect {
  --aimd-quiz-grade-accent: #b42318;
  --aimd-quiz-grade-border: #fecaca;
  --aimd-quiz-grade-bg: #fef3f2;
}

.aimd-quiz__grade-panel--partial {
  --aimd-quiz-grade-accent: #b54708;
  --aimd-quiz-grade-border: #fed7aa;
  --aimd-quiz-grade-bg: #fffaeb;
}

.aimd-quiz__grade-panel--scored {
  --aimd-quiz-grade-accent: #175cd3;
  --aimd-quiz-grade-border: #bfd4fe;
  --aimd-quiz-grade-bg: #f5f8ff;
}

.aimd-quiz__grade-panel--needs-review {
  --aimd-quiz-grade-accent: #175cd3;
  --aimd-quiz-grade-border: #bfdbfe;
  --aimd-quiz-grade-bg: #eff8ff;
}

.aimd-quiz__grade-panel--error {
  --aimd-quiz-grade-accent: #b42318;
  --aimd-quiz-grade-border: #fda4af;
  --aimd-quiz-grade-bg: #fff1f2;
}

.aimd-quiz__grade-panel--ungraded {
  --aimd-quiz-grade-accent: #667085;
  --aimd-quiz-grade-border: #d0d5dd;
  --aimd-quiz-grade-bg: #f8fafc;
}

.aimd-quiz__grade-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.aimd-quiz__grade-status {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  color: var(--aimd-quiz-grade-accent);
  background: color-mix(in srgb, var(--aimd-quiz-grade-accent) 12%, white);
  font-weight: 600;
}

.aimd-quiz__grade-score {
  color: var(--aimd-quiz-grade-accent);
  font-weight: 600;
}

.aimd-quiz__grade-band {
  color: #344054;
}

.aimd-quiz__grade-list {
  margin: 0;
  padding-left: 18px;
}
</style>
