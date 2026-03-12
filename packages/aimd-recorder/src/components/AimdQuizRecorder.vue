<script setup lang="ts">
import { computed } from "vue"
import type { AimdQuizField } from "@airalogy/aimd-core/types"
import type { AimdRecorderMessagesInput } from "../locales"
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
  readonly?: boolean
  focusKeyPrefix?: string
  locale?: string
  messages?: AimdRecorderMessagesInput
}>(), {
  readonly: false,
  focusKeyPrefix: undefined,
  locale: undefined,
  messages: undefined,
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
const quizTypeLabel = computed(() => getAimdRecorderQuizTypeLabel(props.quiz.type, resolvedMessages.value))
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
        <span>{{ option.key }}. {{ option.text }}</span>
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
        <span>{{ option.key }}. {{ option.text }}</span>
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
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  cursor: pointer;
  text-align: left;
}

.aimd-quiz-recorder__option span {
  text-align: left;
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
</style>
