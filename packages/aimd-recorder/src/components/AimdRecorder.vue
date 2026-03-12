<script setup lang="ts">
import { computed, h, nextTick, reactive, ref, watch, type VNode } from "vue"
import type {
  AimdCheckNode,
  AimdQuizField,
  AimdQuizNode,
  AimdStepNode,
  AimdVarNode,
  AimdVarTableField,
  AimdVarTableNode,
  ExtractedAimdFields,
} from "@airalogy/aimd-core/types"
import { parseAndExtract, renderToVue } from "@airalogy/aimd-renderer"
import type { AimdRecorderMessagesInput } from "../locales"
import {
  createAimdRecorderMessages,
  getAimdRecorderScopeLabel,
  resolveAimdRecorderLocale,
} from "../locales"
import type { AimdProtocolRecordData } from "../types"
import { createEmptyProtocolRecordData } from "../types"
import AimdQuizRecorder from "./AimdQuizRecorder.vue"

const props = withDefaults(defineProps<{
  content: string
  modelValue?: Partial<AimdProtocolRecordData>
  readonly?: boolean
  currentUserName?: string
  now?: Date | string | number
  locale?: string
  messages?: AimdRecorderMessagesInput
}>(), {
  modelValue: undefined,
  readonly: false,
  currentUserName: undefined,
  now: undefined,
  locale: undefined,
  messages: undefined,
})

const emit = defineEmits<{
  (e: "update:modelValue", value: AimdProtocolRecordData): void
  (e: "fields-change", fields: ExtractedAimdFields): void
  (e: "error", message: string): void
}>()

const inlineNodes = ref<VNode[]>([])
const renderError = ref("")
const contentRoot = ref<HTMLElement | null>(null)
const localRecord = reactive<AimdProtocolRecordData>(createEmptyProtocolRecordData())
let buildRequestId = 0
let syncingFromExternal = false
let renderScheduled = false
let recordInitializedDuringRender = false
let pendingFocusSnapshot: FocusSnapshot | null = null
let draggingVarTableRow: VarTableDragState | null = null
let dragOverVarTableRowElement: HTMLTableRowElement | null = null
let draggingVarTableHandleElement: HTMLElement | null = null
let draggingVarTableRowElement: HTMLTableRowElement | null = null
let draggingVarTableTableElement: HTMLTableElement | null = null
let settlingVarTableRowKey: string | null = null
let varTableDropAnimationTimer: ReturnType<typeof setTimeout> | null = null
const varTableRowKeyMap = new WeakMap<object, string>()
let nextVarTableRowKeyId = 0
const resolvedLocale = computed(() => resolveAimdRecorderLocale(props.locale))
const resolvedMessages = computed(() => createAimdRecorderMessages(resolvedLocale.value, props.messages))

const EMPTY_FIELDS: ExtractedAimdFields = {
  var: [],
  var_table: [],
  quiz: [],
  step: [],
  check: [],
  ref_step: [],
  ref_var: [],
  ref_fig: [],
  cite: [],
  fig: [],
}

interface FocusSnapshot {
  key: string
  selectionStart?: number | null
  selectionEnd?: number | null
  selectionDirection?: HTMLInputElement["selectionDirection"]
}

interface VarTableDragState {
  tableName: string
  rowIndex: number
}

function cloneRecordData(value: AimdProtocolRecordData): AimdProtocolRecordData {
  return JSON.parse(JSON.stringify(value))
}

function normalizeStepLike(value: unknown): { checked: boolean, annotation: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { checked: false, annotation: "" }
  }

  const obj = value as Record<string, unknown>
  return {
    checked: Boolean(obj.checked),
    annotation: typeof obj.annotation === "string" ? obj.annotation : "",
  }
}

function normalizeIncomingRecord(value: Partial<AimdProtocolRecordData> | undefined): AimdProtocolRecordData {
  const normalized = createEmptyProtocolRecordData()
  if (!value || typeof value !== "object") {
    return normalized
  }

  if (value.var && typeof value.var === "object") {
    normalized.var = { ...value.var }
  }
  if (value.quiz && typeof value.quiz === "object") {
    normalized.quiz = { ...value.quiz }
  }
  if (value.step && typeof value.step === "object") {
    for (const [key, item] of Object.entries(value.step)) {
      normalized.step[key] = normalizeStepLike(item)
    }
  }
  if (value.check && typeof value.check === "object") {
    for (const [key, item] of Object.entries(value.check)) {
      normalized.check[key] = normalizeStepLike(item)
    }
  }

  return normalized
}

function replaceSection(target: Record<string, unknown>, source: Record<string, unknown>) {
  for (const key of Object.keys(target)) {
    delete target[key]
  }
  Object.assign(target, source)
}

function applyNormalizedRecord(normalized: AimdProtocolRecordData) {
  replaceSection(localRecord.var as Record<string, unknown>, normalized.var)
  replaceSection(localRecord.step as Record<string, unknown>, normalized.step as Record<string, unknown>)
  replaceSection(localRecord.check as Record<string, unknown>, normalized.check as Record<string, unknown>)
  replaceSection(localRecord.quiz as Record<string, unknown>, normalized.quiz)
}

function applyIncomingRecord(value: Partial<AimdProtocolRecordData> | undefined) {
  applyNormalizedRecord(normalizeIncomingRecord(value))
}

function captureFocusSnapshot(): FocusSnapshot | null {
  if (typeof document === "undefined" || !contentRoot.value) {
    return null
  }

  const activeElement = document.activeElement
  if (!(activeElement instanceof HTMLElement) || !contentRoot.value.contains(activeElement)) {
    return null
  }

  const key = activeElement.dataset.recFocusKey
  if (!key) {
    return null
  }

  const snapshot: FocusSnapshot = { key }
  if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
    snapshot.selectionStart = activeElement.selectionStart
    snapshot.selectionEnd = activeElement.selectionEnd
    snapshot.selectionDirection = activeElement.selectionDirection
  }

  return snapshot
}

function restoreFocusSnapshot(snapshot: FocusSnapshot | null) {
  if (!snapshot || !contentRoot.value) {
    return
  }

  const candidates = contentRoot.value.querySelectorAll<HTMLElement>("[data-rec-focus-key]")
  let target: HTMLElement | null = null
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]
    if (candidate?.dataset.recFocusKey === snapshot.key) {
      target = candidate
      break
    }
  }

  if (!target) {
    return
  }

  try {
    target.focus({ preventScroll: true })
  }
  catch {
    target.focus()
  }

  if (
    (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
    && snapshot.selectionStart !== undefined
    && snapshot.selectionEnd !== undefined
  ) {
    try {
      target.setSelectionRange(
        snapshot.selectionStart ?? 0,
        snapshot.selectionEnd ?? 0,
        snapshot.selectionDirection ?? undefined,
      )
    }
    catch {
      // Ignore controls that do not support restoring a selection range.
    }
  }
}

function emitRecordUpdate() {
  if (syncingFromExternal) {
    return
  }
  emit("update:modelValue", cloneRecordData(localRecord))
}

function scheduleInlineRebuild() {
  pendingFocusSnapshot = captureFocusSnapshot() ?? pendingFocusSnapshot
  if (renderScheduled) {
    return
  }
  renderScheduled = true
  Promise.resolve().then(() => {
    renderScheduled = false
    const focusSnapshot = pendingFocusSnapshot
    pendingFocusSnapshot = null
    void rebuildInlineNodes(undefined, focusSnapshot)
  })
}

function markRecordChanged(options?: { rebuild?: boolean }) {
  emitRecordUpdate()
  if (options?.rebuild) {
    scheduleInlineRebuild()
  }
}

function normalizeStepFields(raw: unknown): Array<{ name: string }> {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw
    .map((item) => {
      if (typeof item === "string" && item.trim()) {
        return { name: item.trim() }
      }
      if (item && typeof item === "object" && typeof (item as any).name === "string") {
        return { name: (item as any).name as string }
      }
      return null
    })
    .filter((item): item is { name: string } => item !== null)
}

function normalizeCheckFields(raw: unknown): Array<{ name: string, label?: string }> {
  if (!Array.isArray(raw)) {
    return []
  }

  const normalized: Array<{ name: string, label?: string }> = []
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      const label = item.trim()
      normalized.push({ name: label, label })
      continue
    }

    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>
      if (typeof obj.name === "string") {
        normalized.push({
          name: obj.name,
          label: typeof obj.label === "string" ? obj.label : undefined,
        })
      }
    }
  }

  return normalized
}

function normalizeQuizFields(raw: unknown): AimdQuizField[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.filter((item): item is AimdQuizField => (
    !!item
    && typeof item === "object"
    && typeof (item as any).id === "string"
    && typeof (item as any).type === "string"
    && typeof (item as any).stem === "string"
  ))
}

function normalizeVarTableFields(raw: unknown): AimdVarTableField[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.filter((item): item is AimdVarTableField => (
    !!item
    && typeof item === "object"
    && typeof (item as any).name === "string"
    && Array.isArray((item as any).subvars)
  ))
}

function getQuizDefaultValue(quiz: AimdQuizField): unknown {
  if (quiz.type === "choice") {
    const optionKeys = new Set((quiz.options || []).map(option => option.key))
    if (quiz.mode === "multiple") {
      if (Array.isArray(quiz.default)) {
        return quiz.default.filter((item): item is string => typeof item === "string" && optionKeys.has(item))
      }
      return []
    }

    if (typeof quiz.default === "string" && optionKeys.has(quiz.default)) {
      return quiz.default
    }
    return ""
  }

  if (quiz.type === "blank") {
    const blankKeys = (quiz.blanks || []).map(blank => blank.key)
    if (quiz.default && typeof quiz.default === "object" && !Array.isArray(quiz.default)) {
      const objDefault = quiz.default as Record<string, unknown>
      const normalized: Record<string, string> = {}
      for (const key of blankKeys) {
        const value = objDefault[key]
        normalized[key] = typeof value === "string" ? value : ""
      }
      return normalized
    }

    if (typeof quiz.default === "string" && blankKeys.length === 1) {
      return { [blankKeys[0]]: quiz.default }
    }

    const blankValueMap: Record<string, string> = {}
    for (const key of blankKeys) {
      blankValueMap[key] = ""
    }
    return blankValueMap
  }

  if (typeof quiz.default === "string") {
    return quiz.default
  }
  return ""
}

type VarInputKind = "text" | "number" | "checkbox" | "textarea" | "date" | "datetime" | "time"

function normalizeVarTypeName(type: string | undefined): string {
  return (type || "str").trim().toLowerCase().replace(/[\s_-]/g, "")
}

function getVarInputKind(type: string | undefined): VarInputKind {
  const normalized = normalizeVarTypeName(type)

  if (normalized === "float" || normalized === "int" || normalized === "integer" || normalized === "number") {
    return "number"
  }

  if (normalized === "bool" || normalized === "boolean" || normalized === "checkbox") {
    return "checkbox"
  }

  if (normalized === "date") {
    return "date"
  }

  if (normalized === "datetime" || normalized === "currenttime") {
    return "datetime"
  }

  if (normalized === "time" || normalized === "duration") {
    return "time"
  }

  if (normalized === "md" || normalized === "markdown" || normalized === "airalogymarkdown") {
    return "textarea"
  }

  return "text"
}

function unwrapStructuredValue(value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value) && "value" in value) {
    return (value as { value: unknown }).value
  }
  return value
}

function toBooleanValue(value: unknown): boolean {
  const normalized = unwrapStructuredValue(value)

  if (typeof normalized === "boolean") {
    return normalized
  }
  if (typeof normalized === "number") {
    return normalized !== 0
  }
  if (typeof normalized === "string") {
    const text = normalized.trim().toLowerCase()
    if (text === "" || text === "false" || text === "0" || text === "no" || text === "off") {
      return false
    }
    if (text === "true" || text === "1" || text === "yes" || text === "on") {
      return true
    }
  }
  return Boolean(normalized)
}

function toDateValue(value: unknown): Date | null {
  const normalized = unwrapStructuredValue(value)

  if (normalized instanceof Date) {
    return Number.isNaN(normalized.getTime()) ? null : normalized
  }

  if (typeof normalized === "number") {
    const date = new Date(normalized)
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (typeof normalized === "string" && normalized.trim()) {
    const text = normalized.trim().replace(/\s+/, "T")
    const date = new Date(text)
    return Number.isNaN(date.getTime()) ? null : date
  }

  return null
}

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

function formatTimezoneOffset(date: Date): string {
  const totalMinutes = -date.getTimezoneOffset()
  const sign = totalMinutes >= 0 ? "+" : "-"
  const absMinutes = Math.abs(totalMinutes)
  const hours = Math.floor(absMinutes / 60)
  const minutes = absMinutes % 60
  return `${sign}${pad2(hours)}:${pad2(minutes)}`
}

function formatDateTimeWithTimezone(date: Date): string {
  const year = date.getFullYear()
  const month = pad2(date.getMonth() + 1)
  const day = pad2(date.getDate())
  const hour = pad2(date.getHours())
  const minute = pad2(date.getMinutes())
  return `${year}-${month}-${day}T${hour}:${minute}${formatTimezoneOffset(date)}`
}

function normalizeDateTimeValueWithTimezone(value: unknown): unknown {
  const normalized = unwrapStructuredValue(value)

  if (typeof normalized === "string") {
    const text = normalized.trim()
    if (!text) {
      return ""
    }

    const normalizedText = text.replace(" ", "T")
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(normalizedText)) {
      return normalizedText
    }

    const parsed = new Date(normalizedText)
    return Number.isNaN(parsed.getTime()) ? value : formatDateTimeWithTimezone(parsed)
  }

  if (normalized === null || typeof normalized === "undefined") {
    return ""
  }

  const parsed = toDateValue(normalized)
  return parsed ? formatDateTimeWithTimezone(parsed) : value
}

function formatDateForInput(value: unknown, kind: "date" | "datetime" | "time"): string {
  const normalized = unwrapStructuredValue(value)

  if (typeof normalized === "string" && normalized.trim()) {
    const text = normalized.trim()

    if (kind === "date" && /^\d{4}-\d{2}-\d{2}/.test(text)) {
      return text.slice(0, 10)
    }

    if (kind === "datetime") {
      const normalizedText = text.replace(" ", "T")
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalizedText)) {
        return normalizedText.slice(0, 16)
      }
    }

    if (kind === "time" && /^\d{2}:\d{2}/.test(text)) {
      return text.slice(0, 8)
    }
  }

  const date = toDateValue(normalized)
  if (!date) {
    return ""
  }

  const year = date.getFullYear()
  const month = pad2(date.getMonth() + 1)
  const day = pad2(date.getDate())
  const hour = pad2(date.getHours())
  const minute = pad2(date.getMinutes())
  const second = pad2(date.getSeconds())

  if (kind === "date") {
    return `${year}-${month}-${day}`
  }
  if (kind === "time") {
    return `${hour}:${minute}:${second}`
  }
  return `${year}-${month}-${day}T${hour}:${minute}`
}

function getVarInputDisplayValue(value: unknown, kind: VarInputKind): string | number {
  const normalized = unwrapStructuredValue(value)

  if (kind === "date" || kind === "datetime" || kind === "time") {
    return formatDateForInput(normalized, kind)
  }

  if (kind === "number") {
    return typeof normalized === "number" ? normalized : (typeof normalized === "string" ? normalized : "")
  }

  if (typeof normalized === "string") {
    return normalized
  }

  if (normalized === null || typeof normalized === "undefined") {
    return ""
  }

  return String(normalized)
}

function parseVarInputValue(rawValue: string, type: string | undefined, kind: VarInputKind): unknown {
  const normalizedType = normalizeVarTypeName(type)

  if (kind === "datetime") {
    return normalizeDateTimeValueWithTimezone(rawValue)
  }

  if (kind === "number") {
    const text = rawValue.trim()
    if (!text) {
      return ""
    }
    const parsed = normalizedType === "int" || normalizedType === "integer"
      ? Number.parseInt(text, 10)
      : Number.parseFloat(text)
    return Number.isNaN(parsed) ? rawValue : parsed
  }

  return rawValue
}

function resolveNowDate(): Date {
  if (props.now instanceof Date) {
    return Number.isNaN(props.now.getTime()) ? new Date() : props.now
  }
  if (typeof props.now === "string" || typeof props.now === "number") {
    const date = new Date(props.now)
    if (!Number.isNaN(date.getTime())) {
      return date
    }
  }
  return new Date()
}

function getVarInitialValue(node: AimdVarNode, type: string | undefined): unknown {
  if (node.definition && Object.prototype.hasOwnProperty.call(node.definition, "default")) {
    return node.definition.default
  }

  const normalizedType = normalizeVarTypeName(type)
  const inputKind = getVarInputKind(type)

  if (inputKind === "checkbox") {
    return false
  }

  if (normalizedType === "currenttime") {
    return formatDateTimeWithTimezone(resolveNowDate())
  }

  if (normalizedType === "username" && typeof props.currentUserName === "string") {
    return props.currentUserName
  }

  return ""
}

function getVarPlaceholder(node: AimdVarNode): string | undefined {
  const title = node.definition?.kwargs?.title
  if (typeof title === "string" && title.trim()) {
    return title.trim()
  }
  return undefined
}

function getVarControlMinWidth(inputKind: VarInputKind): number {
  switch (inputKind) {
    case "textarea":
      return 160
    default:
      return 0
  }
}

function getVarControlExtraWidth(inputKind: VarInputKind): number {
  switch (inputKind) {
    case "datetime":
      return 36
    case "date":
      return 32
    case "time":
      return 28
    default:
      return 4
  }
}

function calculateVarStackWidth(name: string, inputKind: VarInputKind): string {
  const labelChars = Math.max(name.length + 7, 10)
  const approximateCharWidth = 8
  const horizontalPadding = 16
  const widthPx = Math.round(labelChars * approximateCharWidth + horizontalPadding)
  const minWidthPx = getVarControlMinWidth(inputKind)
  const finalWidthPx = Math.max(minWidthPx, widthPx)

  return `${finalWidthPx}px`
}

function parsePx(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

let varTextMeasureCanvas: HTMLCanvasElement | null = null

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof window === "undefined") {
    return null
  }

  if (!varTextMeasureCanvas) {
    varTextMeasureCanvas = document.createElement("canvas")
  }

  return varTextMeasureCanvas.getContext("2d")
}

function measureStyledTextWidth(text: string, computed: CSSStyleDeclaration): number {
  const ctx = getMeasureContext()
  if (!ctx) {
    return 0
  }

  const fontSize = computed.fontSize || "16px"
  const fontFamily = computed.fontFamily || "sans-serif"
  const fontWeight = computed.fontWeight || "400"
  const fontStyle = computed.fontStyle || "normal"
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`

  return ctx.measureText(text).width
}

function measureLabelTokenWidth(token: HTMLElement): number {
  if (typeof window === "undefined") {
    return token.scrollWidth
  }

  const computed = window.getComputedStyle(token)
  const text = (token.textContent || "").trim()
  const textWidth = measureStyledTextWidth(text, computed)
  const horizontal =
    parsePx(computed.paddingLeft)
    + parsePx(computed.paddingRight)
    + parsePx(computed.borderLeftWidth)
    + parsePx(computed.borderRightWidth)
    + parsePx(computed.marginLeft)
    + parsePx(computed.marginRight)

  return textWidth + horizontal
}

function measureVarLabelWidth(wrapper: HTMLElement): number {
  const scope = wrapper.querySelector(".aimd-field__scope--var") as HTMLElement | null
  const id = wrapper.querySelector(".aimd-field__id") as HTMLElement | null
  if (scope && id) {
    return measureLabelTokenWidth(scope) + measureLabelTokenWidth(id) + 4
  }

  const fallbackLabel = wrapper.querySelector(".aimd-field__label") as HTMLElement | null
  return fallbackLabel ? fallbackLabel.scrollWidth + 2 : 0
}

function measureSingleLineControlWidth(input: HTMLInputElement | HTMLTextAreaElement): number {
  if (typeof window === "undefined") {
    return input.scrollWidth
  }

  const ctx = getMeasureContext()
  if (!ctx) {
    return input.scrollWidth
  }

  const computed = window.getComputedStyle(input)
  const fontSize = computed.fontSize || "16px"
  const fontFamily = computed.fontFamily || "sans-serif"
  const fontWeight = computed.fontWeight || "400"
  const fontStyle = computed.fontStyle || "normal"
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`

  const text = input.value || input.placeholder || ""
  const textWidth = ctx.measureText(text).width
  const padding = parsePx(computed.paddingLeft) + parsePx(computed.paddingRight)
  return textWidth + padding + 2
}

function syncAutoWrapTextareaHeight(textarea: HTMLTextAreaElement) {
  if (typeof window === "undefined") {
    return
  }

  const isCompactText = textarea.classList.contains("aimd-rec-inline__textarea--stacked-text")
  textarea.style.height = "auto"
  const computed = window.getComputedStyle(textarea)
  const minHeight = isCompactText
    ? (parsePx(computed.getPropertyValue("--rec-var-control-height")) || parsePx(computed.height))
    : (parsePx(computed.minHeight) || parsePx(computed.height))

  if (isCompactText && textarea.value.length === 0) {
    textarea.style.height = `${Math.ceil(minHeight)}px`
    return
  }

  const borderHeight = parsePx(computed.borderTopWidth) + parsePx(computed.borderBottomWidth)
  const nextHeight = Math.max(minHeight, textarea.scrollHeight + borderHeight)
  textarea.style.height = `${Math.ceil(nextHeight)}px`
}

function applyVarStackWidth(target: HTMLElement, inputKind: VarInputKind) {
  const wrapper = target.closest(".aimd-rec-inline--var-stacked") as HTMLElement | null
  if (!wrapper || typeof window === "undefined") {
    return
  }

  const labelWidth = measureVarLabelWidth(wrapper)

  const minWidthPx = getVarControlMinWidth(inputKind)
  let controlWidth = 0
  const input = wrapper.querySelector(".aimd-rec-inline__input--stacked, .aimd-rec-inline__textarea--stacked-text") as
    HTMLInputElement | HTMLTextAreaElement | null
  if (input) {
    controlWidth = measureSingleLineControlWidth(input) + getVarControlExtraWidth(inputKind)
  }

  const measuredWidth = Math.max(minWidthPx, labelWidth, controlWidth)
  wrapper.style.width = `${Math.ceil(measuredWidth)}px`
  wrapper.style.maxWidth = "100%"
}

function getVarTableColumns(node: AimdVarTableNode): string[] {
  if (Array.isArray(node.columns) && node.columns.length > 0) {
    return node.columns
  }
  const subvars = node.definition?.subvars
  if (subvars && typeof subvars === "object") {
    return Object.keys(subvars)
  }
  return []
}

function createEmptyVarTableRow(columns: string[]): Record<string, string> {
  const row: Record<string, string> = {}
  for (const column of columns) {
    row[column] = ""
  }
  return row
}

function normalizeVarTableRows(raw: unknown, columns: string[]): Record<string, string>[] {
  if (!Array.isArray(raw)) {
    return [createEmptyVarTableRow(columns)]
  }

  const rows = raw.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return createEmptyVarTableRow(columns)
    }
    const source = item as Record<string, unknown>
    const row: Record<string, string> = {}
    for (const column of columns) {
      const value = source[column]
      row[column] = typeof value === "string" ? value : `${value ?? ""}`
    }
    return row
  })

  if (rows.length === 0) {
    rows.push(createEmptyVarTableRow(columns))
  }

  return rows
}

function ensureVarTableRows(tableName: string, columns: string[]): Record<string, string>[] {
  const normalized = normalizeVarTableRows(localRecord.var[tableName], columns)
  localRecord.var[tableName] = normalized
  return normalized
}

function addVarTableRow(tableName: string, columns: string[]) {
  const rows = ensureVarTableRows(tableName, columns)
  rows.push(createEmptyVarTableRow(columns))
  markRecordChanged({ rebuild: true })
}

function moveVarTableRow(tableName: string, fromIndex: number, toIndex: number, columns: string[]) {
  const rows = ensureVarTableRows(tableName, columns)
  if (
    fromIndex === toIndex
    || fromIndex < 0
    || toIndex < 0
    || fromIndex >= rows.length
    || toIndex >= rows.length
  ) {
    return
  }

  const moved = rows.splice(fromIndex, 1)[0]
  rows.splice(toIndex, 0, moved)
  settlingVarTableRowKey = getVarTableRowKey(moved)
  if (varTableDropAnimationTimer) {
    clearTimeout(varTableDropAnimationTimer)
  }
  varTableDropAnimationTimer = setTimeout(() => {
    settlingVarTableRowKey = null
    varTableDropAnimationTimer = null
    scheduleInlineRebuild()
  }, 520)
  markRecordChanged({ rebuild: true })
}

function removeVarTableRow(tableName: string, rowIndex: number, columns: string[]) {
  const rows = ensureVarTableRows(tableName, columns)
  if (rows.length <= 1) {
    return
  }
  rows.splice(rowIndex, 1)
  markRecordChanged({ rebuild: true })
}

function getVarTableRowKey(row: Record<string, string>): string {
  const existing = varTableRowKeyMap.get(row)
  if (existing) {
    return existing
  }

  const key = `vt-row-${nextVarTableRowKeyId}`
  nextVarTableRowKeyId += 1
  varTableRowKeyMap.set(row, key)
  return key
}

function clearVarTableDragPreview() {
  if (dragOverVarTableRowElement) {
    dragOverVarTableRowElement.classList.remove("aimd-rec-inline-table__row--drag-over")
    dragOverVarTableRowElement = null
  }

  if (draggingVarTableHandleElement) {
    draggingVarTableHandleElement.classList.remove("aimd-rec-inline-table__drag-handle--dragging")
    draggingVarTableHandleElement = null
  }

  if (draggingVarTableRowElement) {
    draggingVarTableRowElement.classList.remove("aimd-rec-inline-table__row--dragging-source")
    draggingVarTableRowElement = null
  }

  if (draggingVarTableTableElement) {
    draggingVarTableTableElement.classList.remove("aimd-rec-inline-table__table--dragging")
    draggingVarTableTableElement = null
  }
}

function startVarTableRowDrag(tableName: string, rowIndex: number, event: DragEvent) {
  if (props.readonly) {
    return
  }

  draggingVarTableRow = { tableName, rowIndex }
  draggingVarTableHandleElement = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  draggingVarTableRowElement = draggingVarTableHandleElement?.closest("tr") as HTMLTableRowElement | null
  draggingVarTableTableElement = draggingVarTableHandleElement?.closest("table") as HTMLTableElement | null
  draggingVarTableHandleElement?.classList.add("aimd-rec-inline-table__drag-handle--dragging")
  draggingVarTableRowElement?.classList.add("aimd-rec-inline-table__row--dragging-source")
  draggingVarTableTableElement?.classList.add("aimd-rec-inline-table__table--dragging")

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", `${tableName}:${rowIndex}`)
  }
}

function updateVarTableDragPreview(target: EventTarget | null) {
  const nextElement = target instanceof HTMLTableRowElement ? target : null
  if (dragOverVarTableRowElement === nextElement) {
    return
  }

  if (dragOverVarTableRowElement) {
    dragOverVarTableRowElement.classList.remove("aimd-rec-inline-table__row--drag-over")
  }

  dragOverVarTableRowElement = nextElement
  dragOverVarTableRowElement?.classList.add("aimd-rec-inline-table__row--drag-over")
}

function handleVarTableRowDragOver(tableName: string, rowIndex: number, event: DragEvent) {
  if (!draggingVarTableRow || draggingVarTableRow.tableName !== tableName) {
    return
  }

  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move"
  }

  if (draggingVarTableRow.rowIndex === rowIndex) {
    updateVarTableDragPreview(null)
    return
  }

  updateVarTableDragPreview(event.currentTarget)
}

function handleVarTableRowDrop(tableName: string, rowIndex: number, columns: string[], event: DragEvent) {
  if (!draggingVarTableRow || draggingVarTableRow.tableName !== tableName) {
    clearVarTableDragPreview()
    draggingVarTableRow = null
    return
  }

  event.preventDefault()
  const { rowIndex: fromIndex } = draggingVarTableRow
  clearVarTableDragPreview()
  draggingVarTableRow = null
  moveVarTableRow(tableName, fromIndex, rowIndex, columns)
}

function endVarTableRowDrag() {
  clearVarTableDragPreview()
  draggingVarTableRow = null
}

function ensureDefaultsFromFields(fields: ExtractedAimdFields): boolean {
  let changed = false

  for (const vt of normalizeVarTableFields(fields.var_table)) {
    const columns = vt.subvars.map(subvar => subvar.name)
    const rows = localRecord.var[vt.name]
    const normalizedRows = normalizeVarTableRows(rows, columns)
    if (JSON.stringify(normalizedRows) !== JSON.stringify(rows)) {
      localRecord.var[vt.name] = normalizedRows
      changed = true
    }
  }

  for (const step of normalizeStepFields(fields.step)) {
    if (!(step.name in localRecord.step)) {
      localRecord.step[step.name] = { checked: false, annotation: "" }
      changed = true
    }
  }

  for (const check of normalizeCheckFields(fields.check)) {
    if (!(check.name in localRecord.check)) {
      localRecord.check[check.name] = { checked: false, annotation: "" }
      changed = true
    }
  }

  for (const quiz of normalizeQuizFields(fields.quiz)) {
    if (!(quiz.id in localRecord.quiz)) {
      localRecord.quiz[quiz.id] = getQuizDefaultValue(quiz)
      changed = true
    }
  }

  return changed
}

function renderInlineVar(node: AimdVarNode): VNode {
  const id = node.name
  const type = node.definition?.type || "str"
  const normalizedType = normalizeVarTypeName(type)
  const inputKind = getVarInputKind(type)
  if (!(id in localRecord.var)) {
    localRecord.var[id] = getVarInitialValue(node, type)
    recordInitializedDuringRender = true
  }
  if (inputKind === "datetime") {
    const normalizedDateTime = normalizeDateTimeValueWithTimezone(localRecord.var[id])
    if (normalizedDateTime !== localRecord.var[id]) {
      localRecord.var[id] = normalizedDateTime
      recordInitializedDuringRender = true
    }
  }

  const htmlInputType = inputKind === "datetime" ? "datetime-local" : inputKind
  const placeholder = getVarPlaceholder(node)
  const displayValue = getVarInputDisplayValue(localRecord.var[id], inputKind)
  const wrapperStyle = {
    width: calculateVarStackWidth(id, inputKind),
    maxWidth: "100%",
  }

  const renderStackedVar = (control: VNode, variantClass?: string): VNode => {
    return h("span", {
      class: ["aimd-rec-inline aimd-rec-inline--var-stacked aimd-field-wrapper aimd-field-wrapper--inline", variantClass],
      style: wrapperStyle,
    }, [
      h("span", { class: "aimd-field aimd-field--no-style aimd-field__label" }, [
        h("span", { class: "aimd-field__scope aimd-field__scope--var" }, getAimdRecorderScopeLabel("var", resolvedMessages.value)),
        h("span", { class: "aimd-field__id" }, id),
      ]),
      control,
    ])
  }

  if (inputKind === "checkbox") {
    return renderStackedVar(
      h("span", { class: "aimd-rec-inline__checkbox-row" }, [
        h("input", {
          "data-rec-focus-key": `var:${id}`,
          type: "checkbox",
          disabled: props.readonly,
          checked: toBooleanValue(localRecord.var[id]),
          onVnodeMounted: (vnode: any) => applyVarStackWidth(vnode.el as HTMLElement, inputKind),
          onVnodeUpdated: (vnode: any) => applyVarStackWidth(vnode.el as HTMLElement, inputKind),
          onChange: (event: Event) => {
            const target = event.target as HTMLInputElement
            localRecord.var[id] = target.checked
            markRecordChanged()
          },
        }),
      ]),
      "aimd-rec-inline--var-stacked--checkbox",
    )
  }

  if (inputKind === "textarea") {
    return renderStackedVar(
      h("textarea", {
        "data-rec-focus-key": `var:${id}`,
        class: "aimd-rec-inline__textarea aimd-rec-inline__textarea--stacked",
        disabled: props.readonly,
        placeholder,
        value: displayValue,
        onVnodeMounted: (vnode: any) => applyVarStackWidth(vnode.el as HTMLElement, inputKind),
        onVnodeUpdated: (vnode: any) => applyVarStackWidth(vnode.el as HTMLElement, inputKind),
        onInput: (event: Event) => {
          const target = event.target as HTMLTextAreaElement
          localRecord.var[id] = parseVarInputValue(target.value, type, inputKind)
          markRecordChanged()
        },
      }),
      "aimd-rec-inline--var-stacked--textarea",
    )
  }

  if (inputKind === "text") {
    return renderStackedVar(
      h("textarea", {
        "data-rec-focus-key": `var:${id}`,
        class: "aimd-rec-inline__textarea aimd-rec-inline__textarea--stacked aimd-rec-inline__textarea--stacked-text",
        rows: 1,
        disabled: props.readonly,
        placeholder,
        value: displayValue,
        onVnodeMounted: (vnode: any) => {
          const el = vnode.el as HTMLTextAreaElement
          applyVarStackWidth(el, inputKind)
          syncAutoWrapTextareaHeight(el)
        },
        onVnodeUpdated: (vnode: any) => {
          const el = vnode.el as HTMLTextAreaElement
          applyVarStackWidth(el, inputKind)
          syncAutoWrapTextareaHeight(el)
        },
        onInput: (event: Event) => {
          const target = event.target as HTMLTextAreaElement
          localRecord.var[id] = parseVarInputValue(target.value, type, inputKind)
          applyVarStackWidth(target, inputKind)
          syncAutoWrapTextareaHeight(target)
          markRecordChanged()
        },
      }),
    )
  }

  return renderStackedVar(
    h("input", {
      "data-rec-focus-key": `var:${id}`,
      class: "aimd-rec-inline__input aimd-rec-inline__input--stacked",
      type: htmlInputType,
      disabled: props.readonly,
      placeholder,
      step: inputKind === "number"
        ? (normalizedType === "int" || normalizedType === "integer" ? "1" : "any")
        : (inputKind === "time" ? "1" : undefined),
      value: displayValue,
      onVnodeMounted: (vnode: any) => applyVarStackWidth(vnode.el as HTMLElement, inputKind),
      onVnodeUpdated: (vnode: any) => applyVarStackWidth(vnode.el as HTMLElement, inputKind),
      onInput: (event: Event) => {
        const target = event.target as HTMLInputElement
        localRecord.var[id] = parseVarInputValue(target.value, type, inputKind)
        markRecordChanged()
      },
    }),
  )
}

function renderInlineVarTable(node: AimdVarTableNode): VNode {
  const tableName = node.name
  const columns = getVarTableColumns(node)
  const rows = ensureVarTableRows(tableName, columns)

  return h("div", { class: "aimd-field aimd-field--var-table aimd-rec-inline-table" }, [
    h("div", { class: "aimd-field__header" }, [
      h("span", { class: "aimd-field__scope" }, getAimdRecorderScopeLabel("var_table", resolvedMessages.value)),
      h("span", { class: "aimd-field__name" }, tableName),
    ]),
    h("table", { class: "aimd-field__table-preview aimd-rec-inline-table__table" }, [
      h("thead", [
        h("tr", [
          h("th", { class: "aimd-rec-inline-table__drag-head" }, ""),
          ...columns.map(column => h("th", column)),
          h("th", { class: "aimd-rec-inline-table__action-head" }, resolvedMessages.value.table.actionColumn),
        ]),
      ]),
      h("tbody", rows.map((row, rowIndex) => {
        const rowKey = getVarTableRowKey(row)
        return h("tr", {
          key: `${tableName}-${rowKey}`,
          class: settlingVarTableRowKey === rowKey ? "aimd-rec-inline-table__row--settling" : "",
          onDragover: (event: DragEvent) => handleVarTableRowDragOver(tableName, rowIndex, event),
          onDrop: (event: DragEvent) => handleVarTableRowDrop(tableName, rowIndex, columns, event),
        }, [
          h("td", { class: "aimd-rec-inline-table__drag-cell" }, [
            h("span", {
              class: [
                "aimd-rec-inline-table__drag-handle",
                props.readonly ? "aimd-rec-inline-table__drag-handle--disabled" : "",
              ],
              title: props.readonly ? resolvedMessages.value.table.dragDisabled : resolvedMessages.value.table.dragReorder,
              draggable: !props.readonly,
              onDragstart: (event: DragEvent) => startVarTableRowDrag(tableName, rowIndex, event),
              onDragend: endVarTableRowDrag,
            }, Array.from({ length: 6 }, (_, dotIndex) => h("span", {
              key: `${rowKey}-drag-dot-${dotIndex}`,
              class: "aimd-rec-inline-table__drag-dot",
            }))),
          ]),
          ...columns.map(column => h("td", { key: `${tableName}-${rowIndex}-${column}` }, [
            h("input", {
              "data-rec-focus-key": `var_table:${tableName}:${rowIndex}:${column}`,
              class: "aimd-rec-table-cell-input",
              disabled: props.readonly,
              placeholder: column,
              value: row[column] ?? "",
              onInput: (event: Event) => {
                row[column] = (event.target as HTMLInputElement).value
                markRecordChanged()
              },
            }),
          ])),
          h("td", { class: "aimd-rec-inline-table__action-cell" }, [
            h("button", {
              type: "button",
              class: "aimd-rec-inline-table__row-btn",
              disabled: props.readonly || rows.length <= 1,
              onClick: () => removeVarTableRow(tableName, rowIndex, columns),
            }, resolvedMessages.value.table.deleteRow),
          ]),
        ])
      })),
    ]),
    h("div", { class: "aimd-rec-inline-table__actions" }, [
      h("button", {
        type: "button",
        class: "aimd-rec-inline-table__add-btn",
        disabled: props.readonly,
        onClick: () => addVarTableRow(tableName, columns),
      }, `+ ${resolvedMessages.value.table.addRow}`),
    ]),
  ])
}

function renderInlineStep(node: AimdStepNode): VNode {
  const name = node.name
  if (!(name in localRecord.step)) {
    localRecord.step[name] = { checked: false, annotation: "" }
  }

  const state = localRecord.step[name]
  const stepNumber = node.step || "?"

  return h("span", { class: "aimd-rec-inline aimd-rec-inline--step aimd-field aimd-field--step" }, [
    h("label", { class: "aimd-rec-inline__check-wrap" }, [
      h("input", {
        "data-rec-focus-key": `step:${name}:checked`,
        type: "checkbox",
        disabled: props.readonly,
        checked: Boolean(state.checked),
        onChange: (event: Event) => {
          state.checked = (event.target as HTMLInputElement).checked
          markRecordChanged()
        },
      }),
      h("span", { class: "aimd-field__scope" }, getAimdRecorderScopeLabel("step", resolvedMessages.value)),
      h("span", { class: "aimd-rec-inline__step-num" }, stepNumber),
      h("span", { class: "aimd-field__name" }, name),
    ]),
    h("input", {
      "data-rec-focus-key": `step:${name}:annotation`,
      class: "aimd-rec-inline__input aimd-rec-inline__input--annotation",
      disabled: props.readonly,
      placeholder: resolvedMessages.value.step.annotationPlaceholder,
      value: state.annotation || "",
      onInput: (event: Event) => {
        state.annotation = (event.target as HTMLInputElement).value
        markRecordChanged()
      },
    }),
  ])
}

function renderInlineCheck(node: AimdCheckNode): VNode {
  const name = node.name
  if (!(name in localRecord.check)) {
    localRecord.check[name] = { checked: false, annotation: "" }
  }

  const state = localRecord.check[name]

  return h("span", { class: "aimd-rec-inline aimd-rec-inline--check aimd-field aimd-field--check" }, [
    h("label", { class: "aimd-rec-inline__check-wrap" }, [
      h("input", {
        "data-rec-focus-key": `check:${name}:checked`,
        type: "checkbox",
        class: "aimd-checkbox",
        disabled: props.readonly,
        checked: Boolean(state.checked),
        onChange: (event: Event) => {
          state.checked = (event.target as HTMLInputElement).checked
          markRecordChanged()
        },
      }),
      h("span", { class: "aimd-field__scope" }, getAimdRecorderScopeLabel("check", resolvedMessages.value)),
      h("span", { class: "aimd-field__name" }, node.label || name),
    ]),
    h("input", {
      "data-rec-focus-key": `check:${name}:annotation`,
      class: "aimd-rec-inline__input aimd-rec-inline__input--annotation",
      disabled: props.readonly,
      placeholder: resolvedMessages.value.check.annotationPlaceholder,
      value: state.annotation || "",
      onInput: (event: Event) => {
        state.annotation = (event.target as HTMLInputElement).value
        markRecordChanged()
      },
    }),
  ])
}

function renderInlineQuiz(node: AimdQuizNode): VNode {
  const quizId = node.name
  const quizField = {
    id: quizId,
    type: node.quizType,
    stem: node.stem,
    mode: node.mode,
    options: node.options,
    blanks: node.blanks,
    default: node.default,
    rubric: node.rubric,
    score: node.score,
    extra: node.extra,
  } as AimdQuizField

  if (!(quizId in localRecord.quiz)) {
    localRecord.quiz[quizId] = getQuizDefaultValue(quizField)
  }

  return h(AimdQuizRecorder, {
    class: "aimd-rec-inline aimd-rec-inline--quiz",
    quiz: quizField,
    modelValue: localRecord.quiz[quizId],
    readonly: props.readonly,
    focusKeyPrefix: `quiz:${quizId}`,
    locale: resolvedLocale.value,
    messages: props.messages,
    "onUpdate:modelValue": (value: unknown) => {
      localRecord.quiz[quizId] = value
      markRecordChanged()
    },
  })
}

async function rebuildInlineNodes(expectedRequestId?: number, focusSnapshot?: FocusSnapshot | null) {
  recordInitializedDuringRender = false
  const rendered = await renderToVue(props.content || "", {
    locale: resolvedLocale.value,
    mode: "edit",
    aimdRenderers: {
      var: node => renderInlineVar(node as AimdVarNode),
      var_table: node => renderInlineVarTable(node as AimdVarTableNode),
      step: node => renderInlineStep(node as AimdStepNode),
      check: node => renderInlineCheck(node as AimdCheckNode),
      quiz: node => renderInlineQuiz(node as AimdQuizNode),
    },
  })

  if (expectedRequestId !== undefined && expectedRequestId !== buildRequestId) {
    return
  }

  inlineNodes.value = rendered.nodes
  await nextTick()
  restoreFocusSnapshot(focusSnapshot ?? null)

  if (recordInitializedDuringRender) {
    emitRecordUpdate()
  }
}

async function parseAndBuild() {
  const currentRequestId = ++buildRequestId

  try {
    renderError.value = ""
    const extracted = parseAndExtract(props.content || "")
    if (currentRequestId !== buildRequestId) {
      return
    }

    emit("fields-change", extracted)

    const changed = ensureDefaultsFromFields(extracted)
    if (changed) {
      emitRecordUpdate()
    }

    await rebuildInlineNodes(currentRequestId)
  } catch (error) {
    if (currentRequestId !== buildRequestId) {
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    renderError.value = message
    inlineNodes.value = []
    emit("fields-change", EMPTY_FIELDS)
    emit("error", message)
  }
}

watch(
  () => props.modelValue,
  (value) => {
    syncingFromExternal = true
    applyIncomingRecord(value)
    syncingFromExternal = false
    scheduleInlineRebuild()
  },
  { deep: true, immediate: true },
)

watch(
  () => ({
    content: props.content,
    locale: props.locale,
    messages: props.messages,
  }),
  () => {
    void parseAndBuild()
  },
  { immediate: true, deep: true },
)
</script>

<template>
  <div class="aimd-protocol-recorder">
    <div v-if="renderError" class="aimd-protocol-recorder__error">{{ renderError }}</div>

    <div v-else-if="inlineNodes.length" ref="contentRoot" class="aimd-protocol-recorder__content">
      <component :is="() => inlineNodes" />
    </div>

    <div v-else class="aimd-protocol-recorder__empty">{{ resolvedMessages.common.emptyContent }}</div>
  </div>
</template>

<style scoped>
.aimd-protocol-recorder {
  --rec-text: #253041;
  --rec-muted: #667085;
  --rec-border: #e3e8ef;
  --rec-focus: #2f6fed;
  --rec-var-control-height: 30px;
  --rec-var-single-line-height: 1.2;
  --rec-var-text-wrap-line-height: 1.35;
}

.aimd-protocol-recorder__error {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #f4b3c1;
  background: #fff3f6;
  color: #b4234d;
  font-size: 13px;
}

.aimd-protocol-recorder__content {
  padding: 18px 20px;
  border: 1px solid var(--rec-border);
  border-radius: 14px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  color: var(--rec-text);
  line-height: 1.7;
}

.aimd-protocol-recorder__empty {
  padding: 24px;
  border: 1px dashed #d7dbe3;
  border-radius: 8px;
  color: #7b8595;
  text-align: center;
}

.aimd-protocol-recorder__content :deep(h1) {
  margin: 0.45em 0 0.5em;
  font-size: 1.7em;
  line-height: 1.25;
}

.aimd-protocol-recorder__content :deep(h2) {
  margin: 0.8em 0 0.45em;
  font-size: 1.35em;
  line-height: 1.3;
}

.aimd-protocol-recorder__content :deep(h3) {
  margin: 0.7em 0 0.4em;
  font-size: 1.15em;
}

.aimd-protocol-recorder__content :deep(p) {
  margin: 0.45em 0;
  color: var(--rec-text);
}

.aimd-protocol-recorder__content :deep(ul),
.aimd-protocol-recorder__content :deep(ol) {
  margin: 0.35em 0;
  padding-left: 22px;
}

.aimd-protocol-recorder__content :deep(table) {
  border-collapse: collapse;
  margin: 10px 0;
  font-size: 14px;
}

.aimd-protocol-recorder__content :deep(th),
.aimd-protocol-recorder__content :deep(td) {
  border: 1px solid #e2e8f0;
  padding: 6px 10px;
  text-align: left;
}

.aimd-protocol-recorder__content :deep(th) {
  background: #f8fafc;
}

.aimd-protocol-recorder__content :deep(blockquote) {
  margin: 8px 0;
  padding: 8px 12px;
  border-left: 3px solid #d8dee8;
  color: #666;
  background: #fafbfc;
}

.aimd-protocol-recorder__content :deep(code) {
  background: #f0f2f5;
  border-radius: 4px;
  padding: 2px 5px;
}

.aimd-protocol-recorder__content :deep(.aimd-field) {
  border-radius: 10px;
  margin: 6px 0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
}

.aimd-protocol-recorder__content :deep(.aimd-field__scope) {
  border-radius: 6px;
  padding: 1px 7px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.01em;
  text-transform: lowercase;
}

.aimd-protocol-recorder__content :deep(.aimd-field--var) {
  background: #f3f8ff;
  border-color: #c9dcff;
  color: #1c4e90;
}

.aimd-protocol-recorder__content :deep(.aimd-field--var .aimd-field__scope) {
  background: #dceaff;
  color: #255eab;
}

.aimd-protocol-recorder__content :deep(.aimd-field--step) {
  background: #fff9ef;
  border-color: #f4d9a8;
  color: #9a5800;
}

.aimd-protocol-recorder__content :deep(.aimd-field--step .aimd-field__scope) {
  background: #ffe8bf;
  color: #9a5800;
}

.aimd-protocol-recorder__content :deep(.aimd-field--check) {
  background: #f8fafc;
  border-color: #d8dfe8;
  color: #2b3443;
  padding: 3px 8px;
}

.aimd-protocol-recorder__content :deep(.aimd-field--check .aimd-field__scope) {
  background: #e7ecf3;
  color: #4f5f77;
}

.aimd-protocol-recorder__content :deep(.aimd-field--var-table) {
  background: #f3fbf3;
  border: 1px solid #cfe7cf;
  color: #276738;
  border-radius: 12px;
  padding: 10px 12px;
}

.aimd-protocol-recorder__content :deep(.aimd-field--var-table .aimd-field__scope) {
  background: #daf1dc;
  color: #2f7b40;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 5px 3px;
  vertical-align: middle;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-multiline) {
  align-items: flex-start;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked) {
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  margin: 5px 3px;
  width: fit-content;
  min-width: 0;
  max-width: 100%;
  border: 1px solid var(--aimd-border-color, #90caf9);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: none;
  background: #f7fbff;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked--textarea) {
  min-width: 0;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked--checkbox) {
  width: fit-content;
  min-width: 0;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked:focus-within) {
  border-color: var(--aimd-border-color-focus, #4181fd);
  box-shadow: 0 0 0 2px rgba(65, 129, 253, 0.14);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked .aimd-field) {
  margin: 0;
  box-shadow: none;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked .aimd-field--no-style.aimd-field__label) {
  min-height: 30px;
  border-radius: 6px 6px 0 0;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked .aimd-field__scope) {
  align-self: center;
  height: 22px;
  margin-left: 3px;
  padding: 0 7px;
  border-radius: 6px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked .aimd-field__id) {
  display: flex;
  flex: 1;
  align-items: center;
  padding: 0 10px 0 6px;
  font-size: 13px;
  font-weight: 500;
  color: #1565c0;
  white-space: nowrap;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input--stacked) {
  width: 100%;
  min-width: 0;
  height: var(--rec-var-control-height);
  font-family: inherit;
  font-size: inherit;
  line-height: var(--rec-var-single-line-height);
  border: 0 none;
  border-top: 1px solid var(--aimd-border-color, #90caf9);
  border-radius: 0 0 6px 6px;
  margin: 0;
  box-shadow: none;
  padding: 0 10px;
  background: #fff;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input--stacked:focus) {
  border-color: var(--aimd-border-color, #90caf9);
  box-shadow: none;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__textarea--stacked:not(.aimd-rec-inline__textarea--stacked-text)) {
  width: 100%;
  min-width: 0;
  min-height: 82px;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  border: 0 none;
  border-top: 1px solid var(--aimd-border-color, #90caf9);
  border-radius: 0 0 6px 6px;
  margin: 0;
  box-shadow: none;
  padding: 8px 10px;
  background: #fff;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__textarea--stacked:focus) {
  border-color: var(--aimd-border-color, #90caf9);
  box-shadow: none;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__checkbox-row) {
  display: flex;
  align-items: center;
  min-height: 38px;
  padding: 0 10px;
  border-top: 1px solid var(--aimd-border-color, #90caf9);
  background: #fff;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline--step),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--check) {
  gap: 8px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline--quiz) {
  display: block;
  margin: 12px 0;
  padding: 0;
  border: none;
  background: transparent;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline--quiz.aimd-field--quiz) {
  border-radius: 12px;
  border-color: #f6ddb0;
  background: #fffdf6;
  padding: 10px 12px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__check-wrap) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__step-num) {
  font-weight: 600;
  color: #9a5800;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline input[type="checkbox"]),
.aimd-protocol-recorder__content :deep(.aimd-checkbox) {
  width: 16px;
  height: 16px;
  accent-color: var(--rec-focus);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input) {
  height: 30px;
  min-width: 94px;
  padding: 0 10px;
  border: 1px solid #c8d3e1;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
  background: #fff;
  color: var(--rec-text);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input::placeholder) {
  color: #98a2b3;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input:focus) {
  border-color: var(--rec-focus);
  box-shadow: 0 0 0 2px rgba(47, 111, 237, 0.12);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var .aimd-rec-inline__input) {
  width: clamp(120px, 28vw, 280px);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input--annotation) {
  width: clamp(130px, 24vw, 220px);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input.aimd-rec-inline__input--stacked),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__textarea.aimd-rec-inline__textarea--stacked) {
  font-family: inherit;
  font-size: inherit;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__textarea) {
  width: clamp(180px, 34vw, 420px);
  min-height: 78px;
  padding: 8px 10px;
  border: 1px solid #c8d3e1;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.45;
  outline: none;
  resize: vertical;
  box-sizing: border-box;
  color: var(--rec-text);
  background: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__textarea:focus) {
  border-color: var(--rec-focus);
  box-shadow: 0 0 0 2px rgba(47, 111, 237, 0.12);
}

/* Keep stacked var input borderless inside; only outer wrapper should show border/focus */
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input.aimd-rec-inline__input--stacked),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__textarea.aimd-rec-inline__textarea--stacked) {
  width: 100%;
  min-width: 0;
  border: 0 none;
  border-top: 1px solid var(--aimd-border-color, #90caf9);
  border-radius: 0 0 6px 6px;
  box-shadow: none;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__textarea.aimd-rec-inline__textarea--stacked:not(.aimd-rec-inline__textarea--stacked-text)) {
  min-height: 82px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__textarea.aimd-rec-inline__textarea--stacked-text) {
  min-height: 0;
  padding-top: 4px;
  padding-bottom: 4px;
  line-height: var(--rec-var-text-wrap-line-height);
  resize: none;
  overflow-y: hidden;
  overflow-x: hidden;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input.aimd-rec-inline__input--stacked:focus),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__textarea.aimd-rec-inline__textarea--stacked:focus) {
  border-color: transparent;
  border-top-color: var(--aimd-border-color, #90caf9);
  box-shadow: none;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table) {
  display: block;
  width: 100%;
  max-width: none;
  margin: 12px 0 14px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__table) {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  overflow: hidden;
  border-radius: 8px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__table td) {
  vertical-align: middle;
  transition:
    background-color 0.2s ease,
    box-shadow 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.2s ease;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__table th) {
  vertical-align: middle;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-head),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-cell) {
  width: 38px;
  text-align: center;
  vertical-align: middle;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__action-head),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__action-cell) {
  width: 84px;
  text-align: center;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__table--dragging) {
  cursor: grabbing;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__row--dragging-source td) {
  opacity: 0.5;
  transform: scale(0.985);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__row--drag-over td) {
  background: linear-gradient(180deg, #f5f9ff 0%, #edf4ff 100%);
  box-shadow:
    inset 0 0 0 1px rgba(47, 111, 237, 0.18),
    0 10px 24px rgba(47, 111, 237, 0.08);
  transform: translateY(-2px);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__row--settling td) {
  animation: aimd-rec-inline-table-row-settle 0.48s cubic-bezier(0.22, 1, 0.36, 1);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__actions) {
  margin-top: 10px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__add-btn),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__row-btn) {
  border: 1px solid #c8d3e1;
  border-radius: 999px;
  padding: 4px 10px;
  background: #fff;
  color: #334155;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s, color 0.2s;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__add-btn:hover),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__row-btn:hover:not(:disabled)) {
  border-color: #9db1cc;
  background: #f7faff;
  color: #1f4f8f;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__row-btn:disabled),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__add-btn:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle) {
  display: inline-grid;
  grid-template-columns: repeat(2, 3px);
  grid-auto-rows: 3px;
  gap: 3px 3px;
  padding: 5px 7px;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  border-radius: 999px;
  color: #b6c2d1;
  cursor: grab;
  user-select: none;
  transition: background-color 0.2s, color 0.2s, opacity 0.2s, transform 0.2s ease;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-dot) {
  width: 3px;
  height: 3px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.82;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle:hover) {
  background: rgba(47, 111, 237, 0.08);
  color: #6f86a4;
  transform: translateY(-1px);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle:hover .aimd-rec-inline-table__drag-dot) {
  opacity: 1;
  transform: scale(1.08);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle--disabled) {
  opacity: 0.45;
  cursor: not-allowed;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle--disabled:hover) {
  background: transparent;
  color: #b6c2d1;
  transform: none;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle--dragging),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle:active) {
  cursor: grabbing;
  color: #5d7699;
  transform: scale(0.96);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle--dragging .aimd-rec-inline-table__drag-dot),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle:active .aimd-rec-inline-table__drag-dot) {
  transform: scale(0.92);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-table-cell-input) {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 1px solid #d2dbe7;
  border-radius: 7px;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  color: var(--rec-text);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-table-cell-input:focus) {
  border-color: var(--rec-focus);
  box-shadow: 0 0 0 2px rgba(47, 111, 237, 0.1);
}

@keyframes aimd-rec-inline-table-row-settle {
  0% {
    background-color: #deebff;
    box-shadow:
      inset 0 0 0 1px rgba(47, 111, 237, 0.22),
      0 14px 28px rgba(47, 111, 237, 0.14);
    transform: translateY(8px) scale(0.985);
  }

  60% {
    background-color: #edf4ff;
    box-shadow:
      inset 0 0 0 1px rgba(47, 111, 237, 0.12),
      0 8px 18px rgba(47, 111, 237, 0.08);
    transform: translateY(-1px) scale(1);
  }

  100% {
    background-color: transparent;
    box-shadow: none;
    transform: none;
  }
}
</style>
