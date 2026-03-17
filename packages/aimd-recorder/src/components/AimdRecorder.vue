<script setup lang="ts">
import { computed, defineAsyncComponent, h, nextTick, reactive, ref, watch, type VNode } from "vue"
import type {
  AimdCheckNode,
  AimdClientAssignerField,
  AimdQuizField,
  AimdQuizNode,
  AimdStepNode,
  AimdVarNode,
  AimdVarTableNode,
  ExtractedAimdFields,
} from "@airalogy/aimd-core/types"
import { parseAndExtract, renderToVue } from "@airalogy/aimd-renderer"
import { applyClientAssigners } from "../client-assigner"
import type { AimdComponentRenderer } from "@airalogy/aimd-renderer"
import type { AimdRecorderMessagesInput } from "../locales"
import {
  createAimdRecorderMessages,
  getAimdRecorderScopeLabel,
  resolveAimdRecorderLocale,
} from "../locales"
import type {
  AimdFieldMeta,
  AimdFieldState,
  AimdProtocolRecordData,
  FieldEventPayload,
  TableEventPayload,
} from "../types"
import { createEmptyProtocolRecordData } from "../types"
import {
  applyIncomingRecord,
  cloneRecordData,
  createEmptyVarTableRow,
  ensureDefaultsFromFields,
  getQuizDefaultValue,
  normalizeVarTableRows,
} from "../composables/useRecordState"
import {
  applyVarStackWidth,
  formatDateTimeWithTimezone,
  getVarInputDisplayValue,
  getVarInputKind,
  normalizeDateTimeValueWithTimezone,
  normalizeVarTypeName,
  parseVarInputValue,
  syncAutoWrapTextareaHeight,
  toBooleanValue,
  unwrapStructuredValue,
  type VarInputKind,
} from "../composables/useVarHelpers"
import {
  captureFocusSnapshot,
  restoreFocusSnapshot,
} from "../composables/useFocusManagement"
import type { FocusSnapshot } from "../composables/useFocusManagement"
import { normalizeDnaSequenceValue } from "../composables/useDnaSequence"
import AimdQuizRecorder from "./AimdQuizRecorder.vue"

const AimdDnaSequenceField = defineAsyncComponent(() => import("./AimdDnaSequenceField.vue"))

// ---------------------------------------------------------------------------
// Props & emits
// ---------------------------------------------------------------------------

const props = withDefaults(defineProps<{
  /** AIMD markdown content to render */
  content: string
  /** Current record data (v-model) */
  modelValue?: Partial<AimdProtocolRecordData>
  /** When true all inputs are read-only */
  readonly?: boolean
  /** Used to pre-fill currenttime / username fields */
  currentUserName?: string
  now?: Date | string | number
  locale?: string
  messages?: AimdRecorderMessagesInput

  // ── Extension props ──────────────────────────────────────────────────────

  /**
   * Per-field metadata keyed by "section:fieldName" (e.g. "var:temp").
   * Controls inputType overrides, assigner mode, enum options, etc.
   */
  fieldMeta?: Record<string, AimdFieldMeta>

  /**
   * Per-field runtime state keyed by "section:fieldName".
   * Drives loading / error / validationError styling.
   */
  fieldState?: Record<string, AimdFieldState>

  /**
   * Optional wrapper applied to every rendered field VNode.
   * Receives (fieldKey, fieldType, defaultVNode) and should return a VNode.
   * Use to inject assigner buttons, dependency tags, validation errors, etc.
   */
  wrapField?: (fieldKey: string, fieldType: string, defaultVNode: VNode) => VNode

  /**
   * Renderer overrides keyed by AIMD field type ("var", "step", …).
   * Return null/undefined to fall through to the built-in renderer.
   */
  customRenderers?: Partial<Record<string, AimdComponentRenderer>>

  /**
   * Resolves relative paths / Airalogy file IDs to displayable URLs.
   * Reserved for future file-type field support.
   */
  resolveFile?: (src: string) => string | null
}>(), {
  modelValue: undefined,
  readonly: false,
  currentUserName: undefined,
  now: undefined,
  locale: undefined,
  messages: undefined,
  fieldMeta: undefined,
  fieldState: undefined,
  wrapField: undefined,
  customRenderers: undefined,
  resolveFile: undefined,
})

const emit = defineEmits<{
  /** Full record updated (v-model) */
  (e: "update:modelValue", value: AimdProtocolRecordData): void
  /** Extracted field list changed (content reparsed) */
  (e: "fields-change", fields: ExtractedAimdFields): void
  /** Parse / render error */
  (e: "error", message: string): void

  // ── Granular field events ─────────────────────────────────────────────────
  /** A single field value changed */
  (e: "field-change", payload: FieldEventPayload): void
  /** A field lost focus — use to trigger external validation */
  (e: "field-blur", payload: FieldEventPayload): void

  // ── Assigner events ───────────────────────────────────────────────────────
  /** Host app should run assigner calculation for the given field */
  (e: "assigner-request", payload: FieldEventPayload): void
  /** Host app should cancel an in-flight assigner for the given field */
  (e: "assigner-cancel", payload: FieldEventPayload): void

  // ── Table events ──────────────────────────────────────────────────────────
  /** A table row was added */
  (e: "table-add-row", payload: TableEventPayload): void
  /** A table row was removed */
  (e: "table-remove-row", payload: TableEventPayload): void
}>()

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

const inlineNodes = ref<VNode[]>([])
const renderError = ref("")
const contentRoot = ref<HTMLElement | null>(null)
const localRecord = reactive<AimdProtocolRecordData>(createEmptyProtocolRecordData())
let buildRequestId = 0
let inlineBuildRequestId = 0
let syncingFromExternal = false
let renderScheduled = false
let recordInitializedDuringRender = false
let pendingFocusSnapshot: FocusSnapshot | null = null
let pendingInlineBuildRequestId: number | null = null
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
  client_assigner: [],
  quiz: [],
  step: [],
  check: [],
  ref_step: [],
  ref_var: [],
  ref_fig: [],
  cite: [],
  fig: [],
}

interface VarTableDragState {
  tableName: string
  rowIndex: number
}

interface VarInputDisplayOverride {
  display: string
  expectedValue: unknown
}

const varInputDisplayOverrides = reactive<Record<string, VarInputDisplayOverride>>({})
const clientAssigners = ref<AimdClientAssignerField[]>([])

function emitRecordUpdate() {
  if (syncingFromExternal) return
  emit("update:modelValue", cloneRecordData(localRecord))
}

function runClientAssigners(options?: { triggerIds?: string[] }): boolean {
  if (props.readonly || clientAssigners.value.length === 0) {
    return false
  }

  try {
    return applyClientAssigners(clientAssigners.value, localRecord.var, options).changed
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    emit("error", `Client assigner error: ${message}`)
    return false
  }
}

function applyCurrentClientAssigners(): boolean {
  return runClientAssigners()
}

function triggerClientAssigner(id: string): boolean {
  const changed = runClientAssigners({ triggerIds: [id] })
  if (changed) {
    emitRecordUpdate()
    scheduleInlineRebuild()
  }
  return changed
}

function triggerManualClientAssigners(ids?: string[]): boolean {
  const manualIds = ids?.length
    ? ids
    : clientAssigners.value.filter(assigner => assigner.mode === "manual").map(assigner => assigner.id)
  if (manualIds.length === 0) {
    return false
  }
  const changed = runClientAssigners({ triggerIds: manualIds })
  if (changed) {
    emitRecordUpdate()
    scheduleInlineRebuild()
  }
  return changed
}

function scheduleInlineRebuild() {
  pendingFocusSnapshot = captureFocusSnapshot(contentRoot.value) ?? pendingFocusSnapshot
  pendingInlineBuildRequestId = ++inlineBuildRequestId
  if (renderScheduled) {
    return
  }
  renderScheduled = true
  Promise.resolve().then(() => {
    renderScheduled = false
    const focusSnapshot = pendingFocusSnapshot
    const inlineRequestId = pendingInlineBuildRequestId ?? inlineBuildRequestId
    pendingFocusSnapshot = null
    pendingInlineBuildRequestId = null
    void rebuildInlineNodes(undefined, focusSnapshot, inlineRequestId)
  })
}

function markRecordChanged(options?: { rebuild?: boolean, runClientAssigners?: boolean }) {
  const assignerChanged = options?.runClientAssigners ? applyCurrentClientAssigners() : false
  emitRecordUpdate()
  if (options?.rebuild || assignerChanged) {
    scheduleInlineRebuild()
  }
}

function getAimdId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const obj = value as Record<string, unknown>
  if (typeof obj.id === "string" && obj.id.trim()) {
    return obj.id
  }
  return null
}

function normalizeStepFields(raw: unknown): Array<{ id: string }> {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw
    .map((item) => {
      const id = getAimdId(item)
      if (id) {
        return { id }
      }
      return null
    })
    .filter((item): item is { id: string } => item !== null)
}

function normalizeCheckFields(raw: unknown): Array<{ id: string, label?: string }> {
  if (!Array.isArray(raw)) {
    return []
  }

  const normalized: Array<{ id: string, label?: string }> = []
  for (const item of raw) {
    const id = getAimdId(item)
    if (!id) {
      continue
    }

    const obj = item && typeof item === "object" && !Array.isArray(item)
      ? item as Record<string, unknown>
      : null
    normalized.push({
      id,
      label: typeof obj?.label === "string" ? obj.label : id,
    })
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

function getVarInitialDisplayOverride(node: AimdVarNode, type: string | undefined): VarInputDisplayOverride | null {
  const raw = node.definition?.defaultRaw?.trim()
  if (!raw) {
    return null
  }

  const normalizedType = normalizeVarTypeName(type)
  if (normalizedType === "int" || normalizedType === "integer") {
    return null
  }

  if (getVarInputKind(type) !== "number" || typeof node.definition?.default !== "number") {
    return null
  }

  if (!raw.includes(".") || String(node.definition.default) === raw) {
    return null
  }

  return {
    display: raw,
    expectedValue: node.definition.default,
  }
}

function getVarDisplayValue(id: string, value: unknown, kind: VarInputKind): string | number {
  const override = varInputDisplayOverrides[id]
  const normalized = unwrapStructuredValue(value)

  if (override) {
    if (kind === "number" && Object.is(normalized, override.expectedValue)) {
      return override.display
    }
    delete varInputDisplayOverrides[id]
  }

  return getVarInputDisplayValue(value, kind)
}

function clearVarInputDisplayOverride(id: string) {
  if (id in varInputDisplayOverrides) {
    delete varInputDisplayOverrides[id]
  }
}

function resolveNowDate(): Date {
  if (props.now instanceof Date) return Number.isNaN(props.now.getTime()) ? new Date() : props.now
  if (typeof props.now === "string" || typeof props.now === "number") {
    const d = new Date(props.now)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}

function getVarInitialValue(node: AimdVarNode, type: string | undefined): unknown {
  const normalizedType = normalizeVarTypeName(type)
  if (node.definition && Object.prototype.hasOwnProperty.call(node.definition, "default")) {
    if (normalizedType === "dnasequence") {
      return normalizeDnaSequenceValue(node.definition.default)
    }
    return node.definition.default
  }
  const inputKind = getVarInputKind(type)
  if (inputKind === "checkbox") return false
  if (inputKind === "dna") return normalizeDnaSequenceValue(undefined)
  if (normalizedType === "currenttime") return formatDateTimeWithTimezone(resolveNowDate())
  if (normalizedType === "username" && typeof props.currentUserName === "string") return props.currentUserName
  return ""
}

function getVarPlaceholder(node: AimdVarNode): string | undefined {
  const title = node.definition?.kwargs?.title
  return typeof title === "string" && title.trim() ? title.trim() : undefined
}

// ---------------------------------------------------------------------------
// Table helpers
// ---------------------------------------------------------------------------

function getVarTableColumns(node: AimdVarTableNode): string[] {
  if (Array.isArray(node.columns) && node.columns.length > 0) return node.columns
  const subvars = node.definition?.subvars
  if (subvars && typeof subvars === "object") return Object.keys(subvars)
  return []
}

function ensureVarTableRows(tableName: string, columns: string[]): Record<string, string>[] {
  const normalized = normalizeVarTableRows(localRecord.var[tableName], columns)
  localRecord.var[tableName] = normalized
  return normalized
}

function addVarTableRow(tableName: string, columns: string[]) {
  const rows = ensureVarTableRows(tableName, columns)
  rows.push(createEmptyVarTableRow(columns))
  markRecordChanged({ rebuild: true, runClientAssigners: true })
  emit("table-add-row", { tableName, columns })
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
  markRecordChanged({ rebuild: true, runClientAssigners: true })
}

function removeVarTableRow(tableName: string, rowIndex: number, columns: string[]) {
  const rows = ensureVarTableRows(tableName, columns)
  if (rows.length <= 1) return
  rows.splice(rowIndex, 1)
  markRecordChanged({ rebuild: true, runClientAssigners: true })
  emit("table-remove-row", { tableName, rowIndex, columns })
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

// ---------------------------------------------------------------------------
// Extension helpers
// ---------------------------------------------------------------------------

function maybeWrap(fieldKey: string, fieldType: string, vnode: VNode): VNode {
  return props.wrapField ? props.wrapField(fieldKey, fieldType, vnode) : vnode
}

function fieldStateClasses(fieldKey: string): string[] {
  const state = props.fieldState?.[fieldKey]
  const cls: string[] = []
  if (state?.validationError) cls.push("aimd-rec-inline--error")
  if (state?.loading) cls.push("aimd-rec-inline--loading")
  return cls
}

function isFieldDisabled(fieldKey: string): boolean {
  if (props.readonly) return true
  const meta = props.fieldMeta?.[fieldKey]
  const state = props.fieldState?.[fieldKey]
  return !!(meta?.disabled || state?.disabled || meta?.assigner?.mode === "auto_force")
}

// ---------------------------------------------------------------------------
// Inline field renderers
// ---------------------------------------------------------------------------

function renderInlineVar(node: AimdVarNode): VNode {
  const id = node.id
  const fieldKey = `var:${id}`

  // 1. Custom renderer override
  if (props.customRenderers?.var) {
    const custom = props.customRenderers.var(node, {} as any, [])
    if (custom) return maybeWrap(fieldKey, "var", custom as VNode)
  }

  const type = node.definition?.type || "str"
  const normalizedType = normalizeVarTypeName(type)
  const inputKind = getVarInputKind(type)
  const isIntegerInput = normalizedType === "int" || normalizedType === "integer"
  const usesDecimalTextInput = inputKind === "number" && !isIntegerInput
  const meta = props.fieldMeta?.[fieldKey]

  // 2. Initialise value
  if (!(id in localRecord.var)) {
    localRecord.var[id] = getVarInitialValue(node, type)
    const initialDisplayOverride = getVarInitialDisplayOverride(node, type)
    if (initialDisplayOverride) {
      varInputDisplayOverrides[id] = initialDisplayOverride
    }
    recordInitializedDuringRender = true
  }
  if (inputKind === "datetime") {
    const norm = normalizeDateTimeValueWithTimezone(localRecord.var[id])
    if (norm !== localRecord.var[id]) {
      localRecord.var[id] = norm
      recordInitializedDuringRender = true
    }
  }
  if (inputKind === "dna") {
    const normalizedValue = normalizeDnaSequenceValue(localRecord.var[id])
    if (JSON.stringify(normalizedValue) !== JSON.stringify(localRecord.var[id])) {
      localRecord.var[id] = normalizedValue
      recordInitializedDuringRender = true
    }
  }

  const htmlInputType = inputKind === "datetime"
    ? "datetime-local"
    : (usesDecimalTextInput ? "text" : inputKind)
  const placeholder = meta?.placeholder ?? getVarPlaceholder(node)
  const displayValue = getVarDisplayValue(id, localRecord.var[id], inputKind)
  const disabled = isFieldDisabled(fieldKey)
  const extraClasses = fieldStateClasses(fieldKey)

  function onVarChange(rawValue: string) {
    clearVarInputDisplayOverride(id)
    const parsed = parseVarInputValue(rawValue, type, inputKind)
    localRecord.var[id] = parsed
    markRecordChanged({ runClientAssigners: true })
    emit("field-change", { section: "var", fieldKey: id, value: parsed })
  }

  function onVarBlur() {
    emit("field-blur", { section: "var", fieldKey: id })
  }

  // 3. Enum select (from fieldMeta override)
  const enumOptions = meta?.enumOptions ?? []
  if (enumOptions.length) {
    return maybeWrap(fieldKey, "var", h("span", {
      class: ["aimd-rec-inline aimd-rec-inline--var-stacked aimd-field-wrapper", ...extraClasses],
    }, [
      h("span", { class: "aimd-field aimd-field--no-style aimd-field__label" }, [
        h("span", { class: "aimd-field__scope aimd-field__scope--var" }, "var"),
        h("span", { class: "aimd-field__id" }, id),
      ]),
      h("select", {
        "data-rec-focus-key": `var:${id}`,
        class: "aimd-rec-inline__input aimd-rec-inline__input--stacked aimd-rec-inline__select",
        disabled,
        value: localRecord.var[id],
        onChange: (e: Event) => onVarChange((e.target as HTMLSelectElement).value),
        onBlur: onVarBlur,
      }, enumOptions.map(opt => h("option", { key: String(opt.value), value: opt.value }, opt.label))),
    ]))
  }

  // 4. Default stacked widget
  const renderStackedVar = (control: VNode, variantClass?: string): VNode =>
    h("span", {
      class: ["aimd-rec-inline aimd-rec-inline--var-stacked aimd-field-wrapper aimd-field-wrapper--inline", variantClass, ...extraClasses],
    }, [
      h("span", { class: "aimd-field aimd-field--no-style aimd-field__label" }, [
        h("span", { class: "aimd-field__scope aimd-field__scope--var" }, getAimdRecorderScopeLabel("var", resolvedMessages.value)),
        h("span", { class: "aimd-field__id" }, id),
      ]),
      control,
    ])

  if (inputKind === "dna") {
    return maybeWrap(fieldKey, "var", h(AimdDnaSequenceField, {
      class: extraClasses,
      varId: id,
      modelValue: localRecord.var[id],
      disabled,
      placeholder,
      messages: resolvedMessages.value,
      "onUpdate:modelValue": (value: unknown) => {
        localRecord.var[id] = value
        markRecordChanged({ runClientAssigners: true })
        emit("field-change", { section: "var", fieldKey: id, value })
      },
      onBlur: onVarBlur,
    }))
  }

  if (inputKind === "checkbox") {
    return maybeWrap(fieldKey, "var", renderStackedVar(
      h("span", { class: "aimd-rec-inline__checkbox-row" }, [
        h("input", {
          "data-rec-focus-key": `var:${id}`,
          type: "checkbox",
          disabled,
          checked: toBooleanValue(localRecord.var[id]),
          onVnodeMounted: (vnode: any) => applyVarStackWidth(vnode.el as HTMLElement, inputKind),
          onVnodeUpdated: (vnode: any) => applyVarStackWidth(vnode.el as HTMLElement, inputKind),
          onChange: (event: Event) => {
            const val = (event.target as HTMLInputElement).checked
            localRecord.var[id] = val
            markRecordChanged({ runClientAssigners: true })
            emit("field-change", { section: "var", fieldKey: id, value: val })
          },
          onBlur: onVarBlur,
        }),
      ]),
      "aimd-rec-inline--var-stacked--checkbox",
    ))
  }

  if (inputKind === "textarea") {
    return maybeWrap(fieldKey, "var", renderStackedVar(
      h("textarea", {
        "data-rec-focus-key": `var:${id}`,
        class: "aimd-rec-inline__textarea aimd-rec-inline__textarea--stacked",
        disabled,
        placeholder,
        value: displayValue,
        onVnodeMounted: (vnode: any) => applyVarStackWidth(vnode.el as HTMLElement, inputKind),
        onVnodeUpdated: (vnode: any) => applyVarStackWidth(vnode.el as HTMLElement, inputKind),
        onInput: (event: Event) => onVarChange((event.target as HTMLTextAreaElement).value),
        onBlur: onVarBlur,
      }),
      "aimd-rec-inline--var-stacked--textarea",
    ))
  }

  if (inputKind === "text") {
    return maybeWrap(fieldKey, "var", renderStackedVar(
      h("textarea", {
        "data-rec-focus-key": `var:${id}`,
        class: "aimd-rec-inline__textarea aimd-rec-inline__textarea--stacked aimd-rec-inline__textarea--stacked-text",
        rows: 1,
        disabled,
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
          const el = event.target as HTMLTextAreaElement
          onVarChange(el.value)
          applyVarStackWidth(el, inputKind)
          syncAutoWrapTextareaHeight(el)
        },
        onBlur: onVarBlur,
      }),
    ))
  }

  // number / date / datetime / time
  return maybeWrap(fieldKey, "var", renderStackedVar(
    h("input", {
      "data-rec-focus-key": `var:${id}`,
      class: "aimd-rec-inline__input aimd-rec-inline__input--stacked",
      type: htmlInputType,
      inputmode: inputKind === "number" ? (isIntegerInput ? "numeric" : "decimal") : undefined,
      disabled,
      placeholder,
      step: inputKind === "number"
        ? (isIntegerInput ? "1" : undefined)
        : (inputKind === "time" ? "1" : undefined),
      value: displayValue,
      onVnodeMounted: (vnode: any) => applyVarStackWidth(vnode.el as HTMLElement, inputKind),
      onVnodeUpdated: (vnode: any) => applyVarStackWidth(vnode.el as HTMLElement, inputKind),
      onInput: (event: Event) => onVarChange((event.target as HTMLInputElement).value),
      onBlur: onVarBlur,
    }),
  ))
}

function renderInlineVarTable(node: AimdVarTableNode): VNode {
  const tableName = node.id
  const fieldKey = `var_table:${tableName}`
  const columns = getVarTableColumns(node)
  const rows = ensureVarTableRows(tableName, columns)
  const disabled = isFieldDisabled(fieldKey)

  function isColumnDisabled(col: string): boolean {
    if (disabled) return true
    return !!(props.fieldMeta?.[`var_table:${tableName}:${col}`]?.disabled)
  }

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
            (() => {
              const colState = props.fieldState?.[`var_table:${tableName}:${column}`]
              const cellClass = colState?.validationError
                ? "aimd-rec-table-cell-input aimd-rec-table-cell-input--error"
                : "aimd-rec-table-cell-input"
              return h("input", {
                "data-rec-focus-key": `var_table:${tableName}:${rowIndex}:${column}`,
                class: cellClass,
                disabled: isColumnDisabled(column),
                placeholder: column,
                value: row[column] ?? "",
                onInput: (event: Event) => {
                  row[column] = (event.target as HTMLInputElement).value
                  markRecordChanged({ runClientAssigners: true })
                  emit("field-change", {
                    section: "var_table",
                    fieldKey: `${tableName}:${column}`,
                    value: row[column],
                  })
                },
                onBlur: () => emit("field-blur", { section: "var_table", fieldKey: `${tableName}:${column}` }),
              })
            })(),
          ])),
          h("td", { class: "aimd-rec-inline-table__action-cell" }, [
            h("button", {
              type: "button",
              class: "aimd-rec-inline-table__row-btn",
              disabled: disabled || rows.length <= 1,
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
        disabled,
        onClick: () => addVarTableRow(tableName, columns),
      }, `+ ${resolvedMessages.value.table.addRow}`),
    ]),
  ])
}

function renderInlineStep(node: AimdStepNode): VNode {
  const id = node.id
  const fieldKey = `step:${id}`
  if (!(id in localRecord.step)) {
    localRecord.step[id] = { checked: false, annotation: "" }
  }

  const state = localRecord.step[id]
  const stepNumber = node.step || "?"
  const disabled = isFieldDisabled(fieldKey)
  const extraClasses = fieldStateClasses(fieldKey)

  return maybeWrap(fieldKey, "step", h("span", {
    class: ["aimd-rec-inline aimd-rec-inline--step aimd-field aimd-field--step", ...extraClasses],
  }, [
    h("label", { class: "aimd-rec-inline__check-wrap" }, [
      h("input", {
        "data-rec-focus-key": `step:${id}:checked`,
        type: "checkbox",
        disabled,
        checked: Boolean(state.checked),
        onChange: (event: Event) => {
          state.checked = (event.target as HTMLInputElement).checked
          markRecordChanged()
          emit("field-change", { section: "step", fieldKey: id, value: state.checked })
        },
        onBlur: () => emit("field-blur", { section: "step", fieldKey: id }),
      }),
      h("span", { class: "aimd-field__scope" }, getAimdRecorderScopeLabel("step", resolvedMessages.value)),
      h("span", { class: "aimd-rec-inline__step-num" }, stepNumber),
      h("span", { class: "aimd-field__name" }, id),
    ]),
    h("input", {
      "data-rec-focus-key": `step:${id}:annotation`,
      class: "aimd-rec-inline__input aimd-rec-inline__input--annotation",
      disabled,
      placeholder: resolvedMessages.value.step.annotationPlaceholder,
      value: state.annotation || "",
      onInput: (event: Event) => {
        state.annotation = (event.target as HTMLInputElement).value
        markRecordChanged()
        emit("field-change", { section: "step", fieldKey: `${id}:annotation`, value: state.annotation })
      },
      onBlur: () => emit("field-blur", { section: "step", fieldKey: id }),
    }),
  ]))
}

function renderInlineCheck(node: AimdCheckNode): VNode {
  const id = node.id
  const fieldKey = `check:${id}`
  if (!(id in localRecord.check)) {
    localRecord.check[id] = { checked: false, annotation: "" }
  }

  const state = localRecord.check[id]
  const disabled = isFieldDisabled(fieldKey)
  const extraClasses = fieldStateClasses(fieldKey)

  return maybeWrap(fieldKey, "check", h("span", {
    class: ["aimd-rec-inline aimd-rec-inline--check aimd-field aimd-field--check", ...extraClasses],
  }, [
    h("label", { class: "aimd-rec-inline__check-wrap" }, [
      h("input", {
        "data-rec-focus-key": `check:${id}:checked`,
        type: "checkbox",
        class: "aimd-checkbox",
        disabled,
        checked: Boolean(state.checked),
        onChange: (event: Event) => {
          state.checked = (event.target as HTMLInputElement).checked
          markRecordChanged()
          emit("field-change", { section: "check", fieldKey: id, value: state.checked })
        },
        onBlur: () => emit("field-blur", { section: "check", fieldKey: id }),
      }),
      h("span", { class: "aimd-field__scope" }, getAimdRecorderScopeLabel("check", resolvedMessages.value)),
      h("span", { class: "aimd-field__name" }, node.label || id),
    ]),
    h("input", {
      "data-rec-focus-key": `check:${id}:annotation`,
      class: "aimd-rec-inline__input aimd-rec-inline__input--annotation",
      disabled,
      placeholder: resolvedMessages.value.check.annotationPlaceholder,
      value: state.annotation || "",
      onInput: (event: Event) => {
        state.annotation = (event.target as HTMLInputElement).value
        markRecordChanged()
        emit("field-change", { section: "check", fieldKey: `${id}:annotation`, value: state.annotation })
      },
      onBlur: () => emit("field-blur", { section: "check", fieldKey: id }),
    }),
  ]))
}

function renderInlineQuiz(node: AimdQuizNode): VNode {
  const quizId = node.id
  const fieldKey = `quiz:${quizId}`
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

  return maybeWrap(fieldKey, "quiz", h(AimdQuizRecorder, {
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
      emit("field-change", { section: "quiz", fieldKey: quizId, value })
    },
  }))
}

// ---------------------------------------------------------------------------
// Rebuild pipeline
// ---------------------------------------------------------------------------

async function rebuildInlineNodes(
  expectedRequestId?: number,
  focusSnapshot?: FocusSnapshot | null,
  expectedInlineRequestId?: number,
) {
  recordInitializedDuringRender = false
  const rendered = await renderToVue(props.content || "", {
    locale: resolvedLocale.value,
    context: {
      mode: "edit",
      readonly: props.readonly,
      value: localRecord as Record<string, Record<string, unknown>>,
    },
    aimdRenderers: {
      var: node => renderInlineVar(node as AimdVarNode),
      var_table: node => renderInlineVarTable(node as AimdVarTableNode),
      step: node => renderInlineStep(node as AimdStepNode),
      check: node => renderInlineCheck(node as AimdCheckNode),
      quiz: node => renderInlineQuiz(node as AimdQuizNode),
    },
  })

  if (
    (expectedRequestId !== undefined && expectedRequestId !== buildRequestId)
    || (expectedInlineRequestId !== undefined && expectedInlineRequestId !== inlineBuildRequestId)
  ) {
    return
  }

  inlineNodes.value = rendered.nodes
  await nextTick()
  restoreFocusSnapshot(contentRoot.value, focusSnapshot ?? null)

  if (recordInitializedDuringRender) emitRecordUpdate()
}

async function parseAndBuild() {
  const currentRequestId = ++buildRequestId
  const currentInlineRequestId = ++inlineBuildRequestId
  try {
    renderError.value = ""
    const extracted = parseAndExtract(props.content || "")
    if (currentRequestId !== buildRequestId) return

    clientAssigners.value = extracted.client_assigner || []
    emit("fields-change", extracted)

    const defaultsChanged = ensureDefaultsFromFields(localRecord, extracted)
    const assignerChanged = applyCurrentClientAssigners()
    if (defaultsChanged || assignerChanged) {
      emitRecordUpdate()
    }

    await rebuildInlineNodes(currentRequestId, undefined, currentInlineRequestId)
  } catch (error) {
    if (currentRequestId !== buildRequestId) {
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    renderError.value = message
    inlineNodes.value = []
    clientAssigners.value = []
    emit("fields-change", EMPTY_FIELDS)
    emit("error", message)
  }
}

// ---------------------------------------------------------------------------
// Watchers
// ---------------------------------------------------------------------------

watch(
  () => props.modelValue,
  (value) => {
    syncingFromExternal = true
    applyIncomingRecord(localRecord, value)
    syncingFromExternal = false
    if (applyCurrentClientAssigners()) {
      emitRecordUpdate()
    }
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

defineExpose({
  runClientAssigner: triggerClientAssigner,
  runManualClientAssigners: triggerManualClientAssigners,
})
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
  --rec-error: #e03050;
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

/* ── Typography ─────────────────────────────────────────────────────────── */
.aimd-protocol-recorder__content :deep(h1) { margin: 0.45em 0 0.5em; font-size: 1.7em; line-height: 1.25; }
.aimd-protocol-recorder__content :deep(h2) { margin: 0.8em 0 0.45em; font-size: 1.35em; line-height: 1.3; }
.aimd-protocol-recorder__content :deep(h3) { margin: 0.7em 0 0.4em; font-size: 1.15em; }
.aimd-protocol-recorder__content :deep(p) { margin: 0.45em 0; color: var(--rec-text); }
.aimd-protocol-recorder__content :deep(ul),
.aimd-protocol-recorder__content :deep(ol) { margin: 0.35em 0; padding-left: 22px; }
.aimd-protocol-recorder__content :deep(table) { border-collapse: collapse; margin: 10px 0; font-size: 14px; }
.aimd-protocol-recorder__content :deep(th),
.aimd-protocol-recorder__content :deep(td) { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; }
.aimd-protocol-recorder__content :deep(th) { background: #f8fafc; }
.aimd-protocol-recorder__content :deep(blockquote) { margin: 8px 0; padding: 8px 12px; border-left: 3px solid #d8dee8; color: #666; background: #fafbfc; }
.aimd-protocol-recorder__content :deep(code) { background: #f0f2f5; border-radius: 4px; padding: 2px 5px; }

/* ── Field base ─────────────────────────────────────────────────────────── */
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

/* ── Field colours ──────────────────────────────────────────────────────── */
.aimd-protocol-recorder__content :deep(.aimd-field--var) { background: #f3f8ff; border-color: #c9dcff; color: #1c4e90; }
.aimd-protocol-recorder__content :deep(.aimd-field--var .aimd-field__scope) { background: #dceaff; color: #255eab; }
.aimd-protocol-recorder__content :deep(.aimd-field--step) { background: #fff9ef; border-color: #f4d9a8; color: #9a5800; }
.aimd-protocol-recorder__content :deep(.aimd-field--step .aimd-field__scope) { background: #ffe8bf; color: #9a5800; }
.aimd-protocol-recorder__content :deep(.aimd-field--check) { background: #f8fafc; border-color: #d8dfe8; color: #2b3443; padding: 3px 8px; }
.aimd-protocol-recorder__content :deep(.aimd-field--check .aimd-field__scope) { background: #e7ecf3; color: #4f5f77; }
.aimd-protocol-recorder__content :deep(.aimd-field--var-table) { background: #f3fbf3; border: 1px solid #cfe7cf; color: #276738; border-radius: 12px; padding: 10px 12px; }
.aimd-protocol-recorder__content :deep(.aimd-field--var-table .aimd-field__scope) { background: #daf1dc; color: #2f7b40; }
/* ── Error & loading ────────────────────────────────────────────────────── */
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--error) { border-color: var(--rec-error) !important; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--error:focus-within) { box-shadow: 0 0 0 2px rgba(224, 48, 80, 0.12); }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--loading) { opacity: 0.6; pointer-events: none; }
.aimd-protocol-recorder__content :deep(.aimd-rec-table-cell-input--error) { border-color: var(--rec-error) !important; }

/* ── Inline layout ──────────────────────────────────────────────────────── */
.aimd-protocol-recorder__content :deep(.aimd-rec-inline) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 5px 3px;
  vertical-align: middle;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-multiline) { align-items: flex-start; }
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
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked--textarea) { min-width: 0; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked--checkbox) { width: fit-content; min-width: 0; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked:focus-within) {
  border-color: var(--aimd-border-color-focus, #4181fd);
  box-shadow: 0 0 0 2px rgba(65, 129, 253, 0.14);
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked .aimd-field) { margin: 0; box-shadow: none; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked .aimd-field--no-style.aimd-field__label) { min-height: 30px; border-radius: 6px 6px 0 0; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked .aimd-field__scope) { align-self: center; height: 22px; margin-left: 3px; padding: 0 7px; border-radius: 6px; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked .aimd-field__id) { display: flex; flex: 1; align-items: center; padding: 0 10px 0 6px; font-size: 13px; font-weight: 500; color: #1565c0; white-space: nowrap; }

/* ── Stacked input controls ─────────────────────────────────────────────── */
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
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input--stacked:focus) { border-color: var(--aimd-border-color, #90caf9); box-shadow: none; }
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
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__textarea--stacked:focus) { border-color: var(--aimd-border-color, #90caf9); box-shadow: none; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__checkbox-row) {
  display: flex;
  align-items: center;
  min-height: 38px;
  padding: 0 10px;
  border-top: 1px solid var(--aimd-border-color, #90caf9);
  background: #fff;
}

/* ── Select ─────────────────────────────────────────────────────────────── */
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__select) { appearance: auto; cursor: pointer; height: var(--rec-var-control-height); padding: 0 8px; background: #fff; }

/* ── Step / check ───────────────────────────────────────────────────────── */
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--step),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--check) { gap: 8px; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--quiz) { display: block; margin: 12px 0; padding: 0; border: none; background: transparent; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--quiz.aimd-field--quiz) { border-radius: 12px; border-color: #f6ddb0; background: #fffdf6; padding: 10px 12px; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__check-wrap) { display: inline-flex; align-items: center; gap: 6px; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__step-num) { font-weight: 600; color: #9a5800; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline input[type="checkbox"]),
.aimd-protocol-recorder__content :deep(.aimd-checkbox) { width: 16px; height: 16px; accent-color: var(--rec-focus); }
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
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input::placeholder) { color: #98a2b3; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input:focus) { border-color: var(--rec-focus); box-shadow: 0 0 0 2px rgba(47, 111, 237, 0.12); }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var .aimd-rec-inline__input) { width: clamp(120px, 28vw, 280px); }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input--annotation) { width: clamp(130px, 24vw, 220px); }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input.aimd-rec-inline__input--stacked),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__textarea.aimd-rec-inline__textarea--stacked) { font-family: inherit; outline: none; }
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
