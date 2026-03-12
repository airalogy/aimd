import type {
  AimdQuizBlank,
  AimdQuizMode,
  AimdQuizNode,
  AimdQuizOption,
  AimdQuizType,
} from "../types/nodes"
import type { AimdQuizField } from "../types/aimd"
import { parseDocument } from "yaml"

const BLANK_PLACEHOLDER_PATTERN = /\[\[([^\[\]\s]+)\]\]/g

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseQuizYamlMapping(content: string): Record<string, unknown> {
  const normalized = content.replace(/\r\n?/g, "\n")

  const document = parseDocument(normalized, {
    prettyErrors: true,
    uniqueKeys: true,
    merge: false,
    schema: "core",
    maxAliasCount: 32,
  } as any)

  if (document.errors.length > 0) {
    const firstError = document.errors[0]
    throw new Error(`Invalid quiz YAML: ${firstError.message}`)
  }

  const value = document.toJSON()
  if (!isPlainObject(value)) {
    throw new Error("quiz block must be a YAML mapping/object")
  }

  return value
}

function normalizeQuizType(value: unknown): AimdQuizType {
  if (typeof value !== "string") {
    throw new Error("quiz type is required (choice, blank, open)")
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === "choice" || normalized === "blank" || normalized === "open") {
    return normalized
  }
  throw new Error("Invalid quiz type, expected one of: choice, blank, open")
}

function normalizeChoiceMode(value: unknown): AimdQuizMode {
  if (typeof value !== "string") {
    throw new Error("choice quiz requires mode (single or multiple)")
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === "single" || normalized === "multiple") {
    return normalized
  }
  throw new Error("Invalid choice mode, expected one of: single, multiple")
}

function normalizeQuizKeyedItems<K extends string>(
  value: unknown,
  sectionName: string,
  requiredFields: readonly ["key", ...K[]],
): Array<Record<"key" | K, string>> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${sectionName} must be a non-empty list`)
  }

  const normalizedItems: Array<Record<"key" | K, string>> = []
  const seenKeys = new Set<string>()

  for (const item of value) {
    if (!isPlainObject(item)) {
      throw new Error(`${sectionName} must be a list of objects`)
    }

    const normalizedItem = {} as Record<"key" | K, string>
    for (const field of requiredFields) {
      const rawField = item[field]
      const normalizedField = rawField === undefined || rawField === null
        ? ""
        : String(rawField).trim()
      if (!normalizedField) {
        throw new Error(`Each ${sectionName} item must include non-empty fields: ${requiredFields.join(", ")}`)
      }
      normalizedItem[field] = normalizedField
    }

    const itemKey = normalizedItem.key
    if (seenKeys.has(itemKey)) {
      throw new Error(`Duplicate key in ${sectionName}: ${itemKey}`)
    }
    seenKeys.add(itemKey)
    normalizedItems.push(normalizedItem)
  }

  return normalizedItems
}

function normalizeChoiceAnswer(
  value: unknown,
  mode: AimdQuizMode,
  optionKeys: string[],
  fieldName: "answer" | "default",
): string | string[] {
  if (mode === "single") {
    if (typeof value !== "string" || !optionKeys.includes(value)) {
      throw new Error(`single choice ${fieldName} must be one option key`)
    }
    return value
  }

  if (!Array.isArray(value)) {
    throw new Error(`multiple choice ${fieldName} must be a list of option keys`)
  }

  const normalized: string[] = []
  for (const item of value) {
    if (typeof item !== "string" || !optionKeys.includes(item)) {
      throw new Error(`multiple choice ${fieldName} must contain only option keys`)
    }
    normalized.push(item)
  }
  return normalized
}

function validateBlankPlaceholders(stem: string, blankKeys: string[]): void {
  const placeholderKeys = [...stem.matchAll(BLANK_PLACEHOLDER_PATTERN)].map(match => match[1])
  if (placeholderKeys.length === 0) {
    throw new Error("blank stem must include placeholders like [[b1]]")
  }

  const duplicates: string[] = []
  const seen = new Set<string>()
  for (const key of placeholderKeys) {
    if (seen.has(key) && !duplicates.includes(key)) {
      duplicates.push(key)
    }
    seen.add(key)
  }
  if (duplicates.length > 0) {
    throw new Error(`blank stem contains duplicate placeholders: ${duplicates.join(", ")}`)
  }

  const unknown = placeholderKeys.filter(key => !blankKeys.includes(key))
  if (unknown.length > 0) {
    throw new Error(`blank stem contains undefined placeholders: ${Array.from(new Set(unknown)).join(", ")}`)
  }

  const missing = blankKeys.filter(key => !seen.has(key))
  if (missing.length > 0) {
    throw new Error(`blank stem is missing placeholders for blank keys: ${missing.join(", ")}`)
  }
}

/**
 * Parse one `quiz` code block payload into AIMD node/field data.
 */
export function parseQuizContent(content: string): { node: AimdQuizNode, field: AimdQuizField } {
  const data = parseQuizYamlMapping(content)

  const idValue = data.id
  if (typeof idValue !== "string" || !idValue.trim()) {
    throw new Error("quiz id is required")
  }
  const id = idValue.trim()

  const quizType = normalizeQuizType(data.type)

  const stemValue = data.stem
  if (typeof stemValue !== "string" || !stemValue.trim()) {
    throw new Error("quiz stem is required")
  }
  const stem = stemValue.trim()

  const scoreValue = data.score
  let score: number | undefined
  if (scoreValue !== undefined) {
    if (typeof scoreValue !== "number" || Number.isNaN(scoreValue) || scoreValue < 0) {
      throw new Error("quiz score must be a non-negative number")
    }
    score = scoreValue
  }

  const field: AimdQuizField = {
    id,
    type: quizType,
    stem,
  }
  const node: AimdQuizNode = {
    type: "aimd",
    fieldType: "quiz",
    id,
    scope: "quiz",
    raw: content,
    quizType,
    stem,
  }

  if (score !== undefined) {
    field.score = score
    node.score = score
  }

  if (quizType === "choice") {
    const mode = normalizeChoiceMode(data.mode)
    const options: AimdQuizOption[] = normalizeQuizKeyedItems(
      data.options,
      "options",
      ["key", "text"] as const,
    )
    const optionKeys = options.map(option => option.key)

    const answerValue = data.answer
    if (answerValue !== undefined) {
      const normalizedAnswer = normalizeChoiceAnswer(answerValue, mode, optionKeys, "answer")
      field.answer = normalizedAnswer
      node.answer = normalizedAnswer
    }

    const defaultValue = data.default
    if (defaultValue !== undefined) {
      const normalizedDefault = normalizeChoiceAnswer(defaultValue, mode, optionKeys, "default")
      field.default = normalizedDefault
      node.default = normalizedDefault
    }

    field.mode = mode
    field.options = options
    node.mode = mode
    node.options = options

    const reservedKeys = new Set([
      "id",
      "type",
      "stem",
      "score",
      "mode",
      "options",
      "answer",
      "default",
    ])
    const extraEntries = Object.entries(data).filter(([key]) => !reservedKeys.has(key))
    if (extraEntries.length > 0) {
      const extra = Object.fromEntries(extraEntries)
      field.extra = extra
      node.extra = extra
    }

    return { node, field }
  }

  if (quizType === "blank") {
    const blanks: AimdQuizBlank[] = normalizeQuizKeyedItems(
      data.blanks,
      "blanks",
      ["key", "answer"] as const,
    )
    const blankKeys = blanks.map(blank => blank.key)
    validateBlankPlaceholders(stem, blankKeys)

    const defaultValue = data.default
    if (defaultValue !== undefined) {
      let normalizedDefault: Record<string, string> | undefined
      if (typeof defaultValue === "string" && blankKeys.length === 1) {
        normalizedDefault = { [blankKeys[0]]: defaultValue }
      }
      else if (isPlainObject(defaultValue)) {
        const parsedDefault: Record<string, string> = {}
        for (const [key, value] of Object.entries(defaultValue)) {
          if (!blankKeys.includes(key)) {
            throw new Error("blank default contains unknown blank keys")
          }
          if (typeof value !== "string") {
            throw new Error("blank default values must be strings")
          }
          parsedDefault[key] = value
        }
        normalizedDefault = parsedDefault
      }
      else {
        throw new Error("blank default must be a dict keyed by blank key")
      }

      field.default = normalizedDefault
      node.default = normalizedDefault
    }

    field.blanks = blanks
    node.blanks = blanks

    const reservedKeys = new Set([
      "id",
      "type",
      "stem",
      "score",
      "blanks",
      "default",
    ])
    const extraEntries = Object.entries(data).filter(([key]) => !reservedKeys.has(key))
    if (extraEntries.length > 0) {
      const extra = Object.fromEntries(extraEntries)
      field.extra = extra
      node.extra = extra
    }

    return { node, field }
  }

  const rubricValue = data.rubric
  if (rubricValue !== undefined) {
    if (typeof rubricValue !== "string") {
      throw new Error("open rubric must be a string")
    }
    field.rubric = rubricValue
    node.rubric = rubricValue
  }

  const defaultValue = data.default
  if (defaultValue !== undefined) {
    if (typeof defaultValue !== "string") {
      throw new Error("open default must be a string")
    }
    field.default = defaultValue
    node.default = defaultValue
  }

  const reservedKeys = new Set([
    "id",
    "type",
    "stem",
    "score",
    "rubric",
    "default",
  ])
  const extraEntries = Object.entries(data).filter(([key]) => !reservedKeys.has(key))
  if (extraEntries.length > 0) {
    const extra = Object.fromEntries(extraEntries)
    field.extra = extra
    node.extra = extra
  }

  return { node, field }
}
