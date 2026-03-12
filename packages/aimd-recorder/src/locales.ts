import { getAimdRendererQuizTypeLabel as getSharedRendererQuizTypeLabel } from "@airalogy/aimd-renderer"

export type AimdRecorderLocale = "en-US" | "zh-CN"

export const DEFAULT_AIMD_RECORDER_LOCALE: AimdRecorderLocale = "en-US"

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (...args: any[]) => any
    ? T[K]
    : T[K] extends Array<infer U>
      ? Array<DeepPartial<U>>
      : T[K] extends object
        ? DeepPartial<T[K]>
        : T[K]
}

export interface AimdRecorderMessages {
  scope: {
    var: string
    quiz: string
    step: string
    check: string
    table: string
  }
  quiz: {
    types: {
      choice: string
      singleChoice: string
      multipleChoice: string
      blank: string
      open: string
    }
    score: (score: string | number) => string
    openPlaceholder: string
  }
  step: {
    annotationPlaceholder: string
  }
  check: {
    annotationPlaceholder: string
  }
  table: {
    actionColumn: string
    dragDisabled: string
    dragReorder: string
    deleteRow: string
    addRow: string
  }
  common: {
    emptyContent: string
  }
}

export type AimdRecorderMessagesInput = DeepPartial<AimdRecorderMessages>

export interface AimdRecorderI18nOptions {
  locale?: AimdRecorderLocale | string
  messages?: AimdRecorderMessagesInput
}

function detectRuntimeLocale(): string | undefined {
  if (typeof document !== "undefined") {
    const htmlLang = document.documentElement?.lang?.trim()
    if (htmlLang) {
      return htmlLang
    }
  }

  if (typeof navigator !== "undefined") {
    if (navigator.language) {
      return navigator.language
    }
    if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
      return navigator.languages[0]
    }
  }

  return undefined
}

const EN_US_MESSAGES: AimdRecorderMessages = {
  scope: {
    var: "var",
    quiz: "quiz",
    step: "step",
    check: "check",
    table: "table",
  },
  quiz: {
    types: {
      choice: "choice",
      singleChoice: "Single choice",
      multipleChoice: "Multiple choice",
      blank: "blank",
      open: "open",
    },
    score: score => `${score} pt`,
    openPlaceholder: "Input your answer...",
  },
  step: {
    annotationPlaceholder: "Notes",
  },
  check: {
    annotationPlaceholder: "Check notes",
  },
  table: {
    actionColumn: "Actions",
    dragDisabled: "Drag is disabled in read-only mode",
    dragReorder: "Drag to reorder rows",
    deleteRow: "Delete",
    addRow: "Add row",
  },
  common: {
    emptyContent: "No renderable protocol content.",
  },
}

const ZH_CN_MESSAGES: AimdRecorderMessages = {
  scope: {
    var: "变量",
    quiz: "题目",
    step: "步骤",
    check: "检查点",
    table: "表格",
  },
  quiz: {
    types: {
      choice: "选择",
      singleChoice: "单选",
      multipleChoice: "多选",
      blank: "填空",
      open: "开放",
    },
    score: score => `${score} 分`,
    openPlaceholder: "请输入答案...",
  },
  step: {
    annotationPlaceholder: "备注",
  },
  check: {
    annotationPlaceholder: "检查备注",
  },
  table: {
    actionColumn: "操作",
    dragDisabled: "只读模式下无法拖拽",
    dragReorder: "拖拽调整行顺序",
    deleteRow: "删除",
    addRow: "添加行",
  },
  common: {
    emptyContent: "没有可渲染的协议内容。",
  },
}

const BASE_MESSAGES: Record<AimdRecorderLocale, AimdRecorderMessages> = {
  "en-US": EN_US_MESSAGES,
  "zh-CN": ZH_CN_MESSAGES,
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function deepMerge<T>(base: T, override?: DeepPartial<T>): T {
  if (!override) {
    return base
  }

  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) }

  for (const key of Object.keys(override) as Array<keyof T>) {
    const overrideValue = override[key]
    if (overrideValue === undefined) {
      continue
    }

    const baseValue = base[key]
    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key as string] = deepMerge(baseValue, overrideValue as any)
      continue
    }

    result[key as string] = overrideValue as T[keyof T]
  }

  return result as T
}

export function resolveAimdRecorderLocale(locale?: string): AimdRecorderLocale {
  const runtimeLocale = locale || detectRuntimeLocale()

  if (runtimeLocale?.toLowerCase().startsWith("zh")) {
    return "zh-CN"
  }

  return DEFAULT_AIMD_RECORDER_LOCALE
}

export function createAimdRecorderMessages(
  locale: string | undefined,
  overrides?: AimdRecorderMessagesInput,
): AimdRecorderMessages {
  const resolvedLocale = resolveAimdRecorderLocale(locale)
  const merged = deepMerge(BASE_MESSAGES[resolvedLocale], overrides)
  const choiceOverride = overrides?.quiz?.types?.choice
  const hasSingleChoiceOverride = overrides?.quiz?.types?.singleChoice !== undefined
  const hasMultipleChoiceOverride = overrides?.quiz?.types?.multipleChoice !== undefined

  if (typeof choiceOverride === "string") {
    if (!hasSingleChoiceOverride) {
      merged.quiz.types.singleChoice = choiceOverride
    }
    if (!hasMultipleChoiceOverride) {
      merged.quiz.types.multipleChoice = choiceOverride
    }
  }

  return merged
}

export function getAimdRecorderScopeLabel(
  scope: string,
  messages: Pick<AimdRecorderMessages, "scope">,
): string {
  switch (scope) {
    case "var":
      return messages.scope.var
    case "quiz":
      return messages.scope.quiz
    case "step":
      return messages.scope.step
    case "check":
      return messages.scope.check
    case "var_table":
      return messages.scope.table
    default:
      return scope
  }
}

export function getAimdRecorderQuizTypeLabel(
  quizType: string | undefined,
  messages: Pick<AimdRecorderMessages, "quiz">,
  quizMode?: string,
): string {
  return getSharedRendererQuizTypeLabel(quizType, quizMode, messages)
}
