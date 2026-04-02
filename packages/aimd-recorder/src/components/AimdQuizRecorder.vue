<script setup lang="ts">
import { computed } from "vue"
import type { AimdQuizField, AimdQuizGradeResult } from "@airalogy/aimd-core/types"
import type { AimdRecorderMessagesInput } from "../locales"
import type { AimdChoiceOptionExplanationMode } from "../types"
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
}>(), {
  grade: null,
  submitted: false,
  readonly: false,
  focusKeyPrefix: undefined,
  locale: undefined,
  messages: undefined,
  choiceOptionExplanationMode: "hidden",
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

const openValue = computed<string>({
  get() {
    return typeof props.modelValue === "string" ? props.modelValue : ""
  },
  set(value) {
    emit("update:modelValue", value)
  },
})

const resolvedMessages = computed(() => createAimdRecorderMessages(props.locale, props.messages))
const quizTypeLabel = computed(() => getAimdRecorderQuizTypeLabel(props.quiz.type, resolvedMessages.value, props.quiz.mode))
const gradeStatusTone = computed(() => {
  const status = props.grade?.status
  switch (status) {
    case "correct":
      return "correct"
    case "incorrect":
      return "incorrect"
    case "partial":
      return "partial"
    case "needs_review":
      return "needs-review"
    case "error":
      return "error"
    default:
      return "ungraded"
  }
})
const gradeStatusLabel = computed(() => {
  const status = props.grade?.status
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
    case "needs_review":
      return resolvedMessages.value.quiz.status.needsReview
    case "error":
      return resolvedMessages.value.quiz.status.error
    default:
      return resolvedMessages.value.quiz.status.ungraded
  }
})
const blankGradeResults = computed(() => Array.isArray(props.grade?.blank_results) ? props.grade.blank_results : [])
const rubricGradeResults = computed(() => Array.isArray(props.grade?.rubric_results) ? props.grade.rubric_results : [])
const hasResolvedGrade = computed(() => Boolean(props.grade && props.grade.status !== "ungraded"))
const showGradePanel = computed(() => {
  if (!props.grade) {
    return false
  }

  if (
    props.grade.status === "ungraded"
    && !props.grade.feedback
    && !props.grade.review_required
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

    <div v-if="grade && showGradePanel" :class="['aimd-quiz__grade-panel', `aimd-quiz__grade-panel--${gradeStatusTone}`]">
      <div class="aimd-quiz__grade-meta">
        <span :class="['aimd-quiz__grade-status', `aimd-quiz__grade-status--${gradeStatusTone}`]">{{ gradeStatusLabel }}</span>
        <span :class="['aimd-quiz__grade-score', `aimd-quiz__grade-score--${gradeStatusTone}`]">
          {{ resolvedMessages.quiz.gradedScore(grade.earned_score, grade.max_score) }}
        </span>
      </div>

      <div v-if="grade.review_required" class="aimd-quiz__grade-review">
        {{ resolvedMessages.quiz.reviewRequired }}
      </div>

      <div v-if="grade.feedback" class="aimd-quiz__grade-feedback">
        <strong>{{ resolvedMessages.quiz.feedback }}:</strong> {{ grade.feedback }}
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

.aimd-quiz__stem {
  margin-top: 0;
  line-height: 1.45;
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

.aimd-quiz__grade-list {
  margin: 0;
  padding-left: 18px;
}
</style>
