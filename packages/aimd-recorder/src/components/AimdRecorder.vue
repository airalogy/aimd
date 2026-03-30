<script setup lang="ts">
import {
  isEnhancedPresentation,
  isCompactPresentation,
  resolveAimdPresentationProfile,
  resolvePresentationAssignerVisibility,
  resolvePresentationStepDetails,
  type AimdPresentationProfileInput,
} from "@airalogy/aimd-presentation"
import { createCssVars, resolveAimdTheme, type AimdThemeInput } from "@airalogy/aimd-theme"
import { Text, computed, defineComponent, h, nextTick, onBeforeUnmount, reactive, ref, watch, type PropType, type VNode, type VNodeChild } from "vue"
import type {
  AimdCheckNode,
  AimdClientAssignerField,
  AimdFigNode,
  AimdQuizField,
  AimdQuizNode,
  AimdStepNode,
  AimdVarNode,
  AimdVarTableNode,
  ExtractedAimdFields,
} from "@airalogy/aimd-core/types"
import { createCodeBlockRenderer, getDefaultCodeBlockHighlighter, parseAndExtract, renderToVue } from "@airalogy/aimd-renderer"
import type { AimdComponentRenderer } from "@airalogy/aimd-renderer"
import type { AimdRecorderMessagesInput } from "../locales"
import {
  createAimdRecorderMessages,
  resolveAimdRecorderLocale,
} from "../locales"
import type {
  AimdFieldMeta,
  AimdFieldState,
  AimdRecorderFieldAdapters,
  AimdTypePlugin,
  AimdProtocolRecordData,
  AimdStepDetailDisplay,
  AimdStepRecordItem,
  FieldEventPayload,
  TableEventPayload,
} from "../types"
import { createEmptyProtocolRecordData } from "../types"
import {
  applyIncomingRecord,
  applyPastedVarTableGrid,
  cloneRecordData,
  ensureDefaultsFromFields,
  getRecordDataSignature,
  getQuizDefaultValue,
  parsePastedVarTableText,
} from "../composables/useRecordState"
import {
  getVarInputKind,
  normalizeVarTypeName,
  normalizeDateTimeValueWithTimezone,
} from "../composables/useVarHelpers"
import {
  captureFocusSnapshot,
  restoreFocusSnapshot,
} from "../composables/useFocusManagement"
import type { FocusSnapshot } from "../composables/useFocusManagement"
import { useClientAssignerRunner } from "../composables/useClientAssignerRunner"
import { resolveAimdRecorderFieldVNode } from "../composables/useFieldAdapters"
import { useVarTableDragDrop, getVarTableColumns } from "../composables/useVarTableDragDrop"
import { useFieldRendering } from "../composables/useFieldRendering"
import {
  createEmptyCheckRecordItem,
  createEmptyStepRecordItem,
  formatStepDuration,
  getProtocolEstimatedDurationMs,
  getProtocolRecordedDurationMs,
  isStepTimerRunning,
  pauseStepTimer,
  resetStepTimer,
  setStepChecked,
  startStepTimer,
} from "../composables/useStepTimers"
import { createAimdTypePlugins } from "../type-plugins"
import AimdVarField from "./AimdVarField.vue"
import AimdVarTableField from "./AimdVarTableField.vue"
import { AimdStepField, AimdCheckField } from "./AimdStepCheckField.vue"
import AimdQuizRecorder from "./AimdQuizRecorder.vue"

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
  presentationProfile?: AimdPresentationProfileInput
  theme?: AimdThemeInput
  /** Controls whether step timer / note details stay expanded */
  stepDetailDisplay?: AimdStepDetailDisplay

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
   * Host-level field adapters with full recorder context.
   * Prefer this over `customRenderers` for new integrations.
   */
  fieldAdapters?: AimdRecorderFieldAdapters

  /**
   * Resolves relative paths / Airalogy file IDs to displayable URLs.
   * Reserved for future file-type field support.
   */
  resolveFile?: (src: string) => string | null

  /**
   * Type-level plugins for custom var types.
   * Plugins can define initialization, normalization, display, parsing, and full custom field widgets.
   */
  typePlugins?: AimdTypePlugin[]
}>(), {
  modelValue: undefined,
  readonly: false,
  currentUserName: undefined,
  now: undefined,
  locale: undefined,
  messages: undefined,
  presentationProfile: undefined,
  theme: undefined,
  stepDetailDisplay: "auto",
  fieldMeta: undefined,
  fieldState: undefined,
  wrapField: undefined,
  customRenderers: undefined,
  fieldAdapters: undefined,
  resolveFile: undefined,
  typePlugins: undefined,
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
const timerNowMs = ref(Date.now())
let protocolTimerTicker: ReturnType<typeof setInterval> | null = null

const resolvedLocale = computed(() => resolveAimdRecorderLocale(props.locale))
const resolvedMessages = computed(() => createAimdRecorderMessages(resolvedLocale.value, props.messages))
const resolvedTypePlugins = computed(() => createAimdTypePlugins(props.typePlugins))
const resolvedPresentationProfile = computed(() => resolveAimdPresentationProfile(props.presentationProfile))
const resolvedTheme = computed(() => resolveAimdTheme(props.theme))
const themeVars = computed(() => createCssVars(resolvedTheme.value))
const enhancedAppearance = computed(() => isEnhancedPresentation(resolvedPresentationProfile.value))
const isCompactDensity = computed(() => isCompactPresentation(resolvedPresentationProfile.value))
const effectiveStepDetailDisplay = computed<AimdStepDetailDisplay>(() => {
  if (props.stepDetailDisplay !== "auto") {
    return props.stepDetailDisplay
  }

  const profileStepDetails = resolvePresentationStepDetails(resolvedPresentationProfile.value)
  return profileStepDetails === "hidden" ? "hidden" : profileStepDetails === "always" ? "always" : "auto"
})

const InlineNodesOutlet = defineComponent({
  name: "AimdRecorderInlineNodesOutlet",
  props: {
    nodes: {
      type: Array as PropType<VNode[]>,
      required: true,
    },
  },
  setup(outletProps) {
    return () => outletProps.nodes
  },
})

function applyFieldAdapter<TFieldType extends "var" | "var_table" | "step" | "check" | "quiz">(
  fieldType: TFieldType,
  fieldKey: string,
  node: any,
  value: unknown,
  defaultVNode: VNode,
): VNode {
  return resolveAimdRecorderFieldVNode(fieldType, fieldKey, node, value, defaultVNode, {
    fieldAdapters: props.fieldAdapters,
    wrapField: props.wrapField,
    readonly: props.readonly,
    locale: resolvedLocale.value,
    messages: resolvedMessages.value,
    record: localRecord,
    fieldMeta: props.fieldMeta,
    fieldState: props.fieldState,
  })
}

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

const extractedFields = ref<ExtractedAimdFields>(EMPTY_FIELDS)
const clientAssigners = ref<AimdClientAssignerField[]>([])
const protocolEstimatedDurationMs = computed(() => getProtocolEstimatedDurationMs(extractedFields.value.step_hierarchy ?? []))
const protocolRecordedDurationMs = computed(() => getProtocolRecordedDurationMs(localRecord.step, timerNowMs.value))
const showProtocolTimingSummary = computed(() => protocolEstimatedDurationMs.value > 0 || protocolRecordedDurationMs.value > 0)
const protocolEstimatedDurationLabel = computed(() => formatStepDuration(protocolEstimatedDurationMs.value, resolvedLocale.value))
const protocolRecordedDurationLabel = computed(() => formatStepDuration(protocolRecordedDurationMs.value, resolvedLocale.value))
const hasRunningStepTimer = computed(() => Object.values(localRecord.step).some(step => isStepTimerRunning(step)))

function syncProtocolTimerTicker() {
  if (protocolTimerTicker) {
    clearInterval(protocolTimerTicker)
    protocolTimerTicker = null
  }

  if (!hasRunningStepTimer.value) {
    return
  }

  protocolTimerTicker = setInterval(() => {
    timerNowMs.value = Date.now()
  }, 1000)
}

function getStepTimerPayload(step: AimdStepRecordItem) {
  return {
    elapsed_ms: step.elapsed_ms,
    timer_started_at_ms: step.timer_started_at_ms,
    started_at_ms: step.started_at_ms,
    ended_at_ms: step.ended_at_ms,
  }
}

function emitRecordUpdate() {
  if (syncingFromExternal) return
  emit("update:modelValue", cloneRecordData(localRecord))
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
  const assignerChanged = options?.runClientAssigners ? assignerRunner.applyCurrentClientAssigners() : false
  emitRecordUpdate()
  if (options?.rebuild || assignerChanged) {
    scheduleInlineRebuild()
  }
}

// ---------------------------------------------------------------------------
// Composables
// ---------------------------------------------------------------------------

const assignerRunner = useClientAssignerRunner({
  readonly: () => props.readonly,
  clientAssigners,
  localRecord,
  onError: (message) => emit("error", message),
  emitRecordUpdate,
  scheduleInlineRebuild,
})

const tableDragDrop = useVarTableDragDrop({
  readonly: () => props.readonly,
  localRecord,
  markRecordChanged,
  scheduleInlineRebuild,
  emitTableAddRow: (payload) => emit("table-add-row", payload),
  emitTableRemoveRow: (payload) => emit("table-remove-row", payload),
})

const fieldRendering = useFieldRendering({
  readonly: () => props.readonly,
  currentUserName: () => props.currentUserName,
  now: () => props.now,
  fieldMeta: () => props.fieldMeta,
  fieldState: () => props.fieldState,
  typePlugins: () => resolvedTypePlugins.value,
  wrapField: () => props.wrapField,
})

// ---------------------------------------------------------------------------
// Inline field renderers
// ---------------------------------------------------------------------------

function renderInlineVar(node: AimdVarNode): VNode {
  const id = node.id
  const fieldKey = `var:${id}`
  const meta = props.fieldMeta?.[fieldKey]

  // 1. Custom renderer override
  if (props.customRenderers?.var) {
    const custom = props.customRenderers.var(node, {} as any, [])
    if (custom) return applyFieldAdapter("var", fieldKey, node, localRecord.var[id], custom as VNode)
  }

  const type = node.definition?.type || "str"
  const typePlugin = fieldRendering.getTypePlugin(fieldKey, type)
  const inputKind = getVarInputKind(type, {
    inputType: meta?.inputType,
    codeLanguage: meta?.codeLanguage,
    typePlugin,
  })
  const placeholder = meta?.placeholder ?? fieldRendering.getVarPlaceholder(node)

  function emitVarChange(value: unknown) {
    fieldRendering.clearVarInputDisplayOverride(id)
    localRecord.var[id] = value
    markRecordChanged({ runClientAssigners: true })
    emit("field-change", { section: "var", fieldKey: id, value })
  }

  function emitVarBlur() {
    emit("field-blur", { section: "var", fieldKey: id })
  }

  // 2. Initialise value
  if (!(id in localRecord.var)) {
    localRecord.var[id] = fieldRendering.getVarInitialValue(node, type, fieldKey)
    const initialDisplayOverride = fieldRendering.getVarInitialDisplayOverride(node, type, fieldKey)
    if (initialDisplayOverride) {
      fieldRendering.setVarInputDisplayOverride(id, initialDisplayOverride)
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
  const normalizedValue = fieldRendering.normalizeVarValue(
    node,
    type,
    fieldKey,
    localRecord.var[id],
    inputKind,
  )
  if (JSON.stringify(normalizedValue) !== JSON.stringify(localRecord.var[id])) {
    localRecord.var[id] = normalizedValue
    recordInitializedDuringRender = true
  }

  const displayValue = fieldRendering.getVarDisplayValue(
    id,
    node,
    type,
    localRecord.var[id],
    inputKind,
    fieldKey,
  )
  const disabled = fieldRendering.isFieldDisabled(fieldKey)
  const extraClasses = fieldRendering.fieldStateClasses(fieldKey)

  if (typePlugin?.renderField) {
    const pluginVNode = typePlugin.renderField({
      type,
      normalizedType: normalizeVarTypeName(type),
      fieldKey,
      node,
      value: localRecord.var[id],
      inputKind,
      fieldMeta: meta,
      currentUserName: props.currentUserName,
      now: props.now,
      readonly: props.readonly,
      disabled,
      enhancedAppearance: enhancedAppearance.value,
      locale: resolvedLocale.value,
      messages: resolvedMessages.value,
      record: localRecord,
      resolveFile: props.resolveFile,
      displayValue,
      extraClasses,
      placeholder,
      fieldState: props.fieldState?.[fieldKey],
      emitChange: emitVarChange,
      emitBlur: emitVarBlur,
    })

    if (pluginVNode) {
      return applyFieldAdapter("var", fieldKey, node, localRecord.var[id], pluginVNode)
    }
  }

  const vnode = h(AimdVarField, {
    node,
    value: localRecord.var[id] as any,
    disabled,
    extraClasses,
    messages: resolvedMessages.value,
    fieldMeta: meta,
    displayValue,
    inputKind,
    typePlugin,
    enhancedAppearance: enhancedAppearance.value,
    initialized: id in localRecord.var,
    onChange: (payload: { id: string, value: unknown, type: string, inputKind: string }) => {
      emitVarChange(payload.value)
    },
    onBlur: () => emitVarBlur(),
  })

  return applyFieldAdapter("var", fieldKey, node, localRecord.var[id], vnode)
}

function renderInlineVarTable(node: AimdVarTableNode): VNode {
  const tableName = node.id
  const fieldKey = `var_table:${tableName}`
  const columns = getVarTableColumns(node)
  const rows = tableDragDrop.ensureVarTableRows(tableName, columns)
  const disabled = fieldRendering.isFieldDisabled(fieldKey)
  const disabledColumns = columns.filter(column => !!props.fieldMeta?.[`var_table:${tableName}:${column}`]?.disabled)

  const vnode = h(AimdVarTableField, {
    node,
    rows,
    columns,
    disabled,
    readonly: props.readonly,
    settlingRowKey: tableDragDrop.getSettlingVarTableRowKey(),
    messages: resolvedMessages.value,
    fieldMeta: props.fieldMeta,
    fieldState: props.fieldState,
    onCellInput: (payload: { tableName: string, column: string, rowIndex: number, value: string, row: Record<string, string> }) => {
      payload.row[payload.column] = payload.value
      markRecordChanged({ runClientAssigners: true })
      emit("field-change", {
        section: "var_table",
        fieldKey: `${payload.tableName}:${payload.column}`,
        value: payload.value,
      })
    },
    onCellPaste: (payload: { tableName: string, column: string, rowIndex: number, text: string }) => {
      const startColumnIndex = columns.indexOf(payload.column)
      if (startColumnIndex < 0) {
        return
      }

      const pastedGrid = parsePastedVarTableText(payload.text)
      const result = applyPastedVarTableGrid(
        rows,
        columns,
        payload.rowIndex,
        startColumnIndex,
        pastedGrid,
        { disabledColumns },
      )

      if (result.rowsAdded === 0 && result.changedCells.length === 0) {
        return
      }

      // Var tables are rendered through rebuilt inline VNodes, so pasted updates
      // need a refresh even when they only overwrite existing cells.
      markRecordChanged({ rebuild: true, runClientAssigners: true })
      for (let index = 0; index < result.rowsAdded; index += 1) {
        emit("table-add-row", { tableName: payload.tableName, columns })
      }
      for (const cell of result.changedCells) {
        emit("field-change", {
          section: "var_table",
          fieldKey: `${payload.tableName}:${cell.column}`,
          value: cell.value,
        })
      }
    },
    onCellBlur: (payload: { tableName: string, column: string }) => {
      emit("field-blur", { section: "var_table", fieldKey: `${payload.tableName}:${payload.column}` })
    },
    onAddRow: (payload: { tableName: string, columns: string[] }) => {
      tableDragDrop.addVarTableRow(payload.tableName, payload.columns)
    },
    onRemoveRow: (payload: { tableName: string, rowIndex: number, columns: string[] }) => {
      tableDragDrop.removeVarTableRow(payload.tableName, payload.rowIndex, payload.columns)
    },
    onDragStart: (payload: { tableName: string, rowIndex: number, event: DragEvent }) => {
      tableDragDrop.startVarTableRowDrag(payload.tableName, payload.rowIndex, payload.event)
    },
    onDragOver: (payload: { tableName: string, rowIndex: number, event: DragEvent }) => {
      tableDragDrop.handleVarTableRowDragOver(payload.tableName, payload.rowIndex, payload.event)
    },
    onDragDrop: (payload: { tableName: string, rowIndex: number, columns: string[], event: DragEvent }) => {
      tableDragDrop.handleVarTableRowDrop(payload.tableName, payload.rowIndex, payload.columns, payload.event)
    },
    onDragEnd: () => {
      tableDragDrop.endVarTableRowDrag()
    },
  })

  return applyFieldAdapter("var_table", fieldKey, node, rows, vnode)
}

function isGroupedStepBodyNode(node: unknown): node is VNode {
  if (!node || typeof node !== "object") {
    return false
  }

  const props = (node as VNode).props as Record<string, unknown> | null | undefined
  if (!props) {
    return false
  }

  const classValue = props.class
  const classNames = Array.isArray(classValue)
    ? classValue
    : typeof classValue === "string"
      ? [classValue]
      : []

  return props["data-aimd-step-body"] === "true"
    || props["data-aimd-step-body"] === true
    || props.dataAimdStepBody === "true"
    || props.dataAimdStepBody === true
    || classNames.some((className) => typeof className === "string" && className.includes("aimd-step-body"))
}

function normalizeStepBodyNodes(bodyNodes: VNodeChild[] = []): VNodeChild[] {
  if (bodyNodes.length === 0) {
    return []
  }

  const groupedBody = bodyNodes.find((child) => isGroupedStepBodyNode(child))
  if (!groupedBody || typeof groupedBody !== "object" || groupedBody === null) {
    return bodyNodes
  }

  const groupedChildren = (groupedBody as VNode).children
  if (Array.isArray(groupedChildren)) {
    return groupedChildren as VNodeChild[]
  }

  if (groupedChildren == null) {
    return []
  }

  return [groupedChildren as VNodeChild]
}

function isGroupedCheckBodyNode(node: unknown): node is VNode {
  if (!node || typeof node !== "object" || !("props" in node)) {
    return false
  }

  const props = (node as VNode).props as Record<string, unknown> | null | undefined
  if (!props) {
    return false
  }

  const classValue = props.class
  const classNames = Array.isArray(classValue)
    ? classValue
    : typeof classValue === "string"
      ? [classValue]
      : []

  return props["data-aimd-check-body"] === "true"
    || props["data-aimd-check-body"] === true
    || props.dataAimdCheckBody === "true"
    || props.dataAimdCheckBody === true
    || classNames.some((className) => typeof className === "string" && className.includes("aimd-check-body"))
}

function normalizeCheckBodyNodes(bodyNodes: VNodeChild[] = []): VNodeChild[] {
  if (bodyNodes.length === 0) {
    return []
  }

  const groupedBody = bodyNodes.find((child) => isGroupedCheckBodyNode(child))
  if (!groupedBody || typeof groupedBody !== "object" || groupedBody === null) {
    return bodyNodes
  }

  const groupedChildren = (groupedBody as VNode).children
  if (Array.isArray(groupedChildren)) {
    return groupedChildren as VNodeChild[]
  }

  if (groupedChildren == null) {
    return []
  }

  return [groupedChildren as VNodeChild]
}

function renderInlineStep(node: AimdStepNode, bodyNodes: VNodeChild[] = []): VNode {
  const id = node.id
  const fieldKey = `step:${id}`
  if (!(id in localRecord.step)) {
    localRecord.step[id] = createEmptyStepRecordItem()
    recordInitializedDuringRender = true
  }

  const state = localRecord.step[id]
  const disabled = fieldRendering.isFieldDisabled(fieldKey)
  const extraClasses = fieldRendering.fieldStateClasses(fieldKey)
  const normalizedBodyNodes = normalizeStepBodyNodes(bodyNodes)

  const vnode = h(AimdStepField, {
    node,
    state,
    bodyNodes: normalizedBodyNodes,
    disabled,
    extraClasses,
    detailDisplay: effectiveStepDetailDisplay.value,
    locale: resolvedLocale.value,
    messages: resolvedMessages.value,
    presentationProfile: resolvedPresentationProfile.value,
    theme: resolvedTheme.value,
    onCheckChange: (payload: { id: string, value: boolean }) => {
      const wasRunning = isStepTimerRunning(state)
      setStepChecked(state, payload.value, Date.now())
      timerNowMs.value = Date.now()
      markRecordChanged()
      emit("field-change", { section: "step", fieldKey: payload.id, value: payload.value })
      if (wasRunning) {
        emit("field-change", { section: "step", fieldKey: `${payload.id}:timer`, value: getStepTimerPayload(state) })
      }
    },
    onAnnotationChange: (payload: { id: string, value: string }) => {
      state.annotation = payload.value
      markRecordChanged()
      emit("field-change", { section: "step", fieldKey: `${payload.id}:annotation`, value: payload.value })
    },
    onTimerStart: (payload: { id: string }) => {
      if (!startStepTimer(state, Date.now())) {
        return
      }
      timerNowMs.value = Date.now()
      markRecordChanged()
      emit("field-change", { section: "step", fieldKey: `${payload.id}:timer`, value: getStepTimerPayload(state) })
    },
    onTimerPause: (payload: { id: string }) => {
      if (!pauseStepTimer(state, Date.now())) {
        return
      }
      timerNowMs.value = Date.now()
      markRecordChanged()
      emit("field-change", { section: "step", fieldKey: `${payload.id}:timer`, value: getStepTimerPayload(state) })
    },
    onTimerReset: (payload: { id: string }) => {
      if (!resetStepTimer(state)) {
        return
      }
      timerNowMs.value = Date.now()
      markRecordChanged()
      emit("field-change", { section: "step", fieldKey: `${payload.id}:timer`, value: getStepTimerPayload(state) })
    },
    onBlur: (payload: { id: string }) => {
      emit("field-blur", { section: "step", fieldKey: payload.id })
    },
  })

  return applyFieldAdapter("step", fieldKey, node, state, vnode)
}

function renderInlineCheck(node: AimdCheckNode, bodyNodes: VNodeChild[] = []): VNode {
  const id = node.id
  const fieldKey = `check:${id}`
  if (!(id in localRecord.check)) {
    localRecord.check[id] = createEmptyCheckRecordItem()
    recordInitializedDuringRender = true
  }

  const state = localRecord.check[id]
  const disabled = fieldRendering.isFieldDisabled(fieldKey)
  const extraClasses = fieldRendering.fieldStateClasses(fieldKey)
  const normalizedBodyNodes = normalizeCheckBodyNodes(bodyNodes)

  const vnode = h(AimdCheckField, {
    node,
    state,
    bodyNodes: normalizedBodyNodes,
    disabled,
    extraClasses,
    messages: resolvedMessages.value,
    presentationProfile: resolvedPresentationProfile.value,
    onCheckChange: (payload: { id: string, value: boolean }) => {
      state.checked = payload.value
      markRecordChanged()
      emit("field-change", { section: "check", fieldKey: payload.id, value: payload.value })
    },
    onAnnotationChange: (payload: { id: string, value: string }) => {
      state.annotation = payload.value
      markRecordChanged()
      emit("field-change", { section: "check", fieldKey: `${payload.id}:annotation`, value: payload.value })
    },
    onBlur: (payload: { id: string }) => {
      emit("field-blur", { section: "check", fieldKey: payload.id })
    },
  })

  return applyFieldAdapter("check", fieldKey, node, state, vnode)
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

  const vnode = h(AimdQuizRecorder, {
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
  })

  return applyFieldAdapter("quiz", fieldKey, node, localRecord.quiz[quizId], vnode)
}

function renderResolvedImage(node: { properties?: Record<string, unknown> }): VNode {
  const properties = node.properties || {}
  const originalSrc = typeof properties.src === "string" ? properties.src : ""
  const resolvedSrc = originalSrc && props.resolveFile
    ? props.resolveFile(originalSrc) ?? originalSrc
    : originalSrc

  return h("img", {
    src: resolvedSrc,
    alt: typeof properties.alt === "string" ? properties.alt : undefined,
    title: typeof properties.title === "string" ? properties.title : undefined,
    class: "aimd-image",
    loading: "lazy",
  })
}

function renderInlineFigure(node: AimdFigNode): VNode {
  const fieldKey = `fig:${node.id}`

  if (props.customRenderers?.fig) {
    const custom = props.customRenderers.fig(node, {} as any, [])
    if (custom) {
      return custom as VNode
    }
  }

  const resolvedSrc = props.resolveFile?.(node.src) ?? node.src
  const captionChildren: VNodeChild[] = []
  const figureLabel = resolvedLocale.value === "zh-CN" ? "图" : "Figure"

  if (node.sequence !== undefined || node.title) {
    const titleText = node.sequence !== undefined
      ? `${figureLabel} ${node.sequence + 1}${node.title ? `. ${node.title}` : ""}`
      : node.title
    captionChildren.push(h("div", { class: "aimd-figure__title" }, titleText))
  }

  if (node.legend) {
    captionChildren.push(h("div", { class: "aimd-figure__legend" }, node.legend))
  }

  return h("figure", {
    class: "aimd-figure",
    "data-aimd-type": "fig",
    "data-aimd-fig-id": node.id,
    "data-aimd-fig-src": resolvedSrc,
    id: `fig-${node.id}`,
  }, [
    h("img", {
      class: "aimd-figure__image",
      src: resolvedSrc,
      alt: node.title || node.id,
      loading: "lazy",
    }),
    captionChildren.length > 0
      ? h("figcaption", { class: "aimd-figure__caption" }, captionChildren)
      : null,
  ])
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
  const codeBlockHighlighter = await getDefaultCodeBlockHighlighter()
  const codeBlockRenderer = createCodeBlockRenderer(
    codeBlockHighlighter,
    resolvedTheme.value.mode === "dark" ? "github-dark" : "github-light",
    resolvedTheme.value,
  )
  const rendered = await renderToVue(props.content || "", {
    locale: resolvedLocale.value,
    groupStepBodies: true,
    groupCheckBodies: true,
    assignerVisibility: resolvePresentationAssignerVisibility(resolvedPresentationProfile.value),
    context: {
      mode: "edit",
      readonly: props.readonly,
      value: localRecord as Record<string, Record<string, unknown>>,
    },
    blockVarTypes: ["AiralogyMarkdown"],
    elementRenderers: {
      pre: codeBlockRenderer,
      ...(props.resolveFile
        ? {
            img: node => renderResolvedImage(node as { properties?: Record<string, unknown> }),
          }
        : {}),
    },
    aimdRenderers: {
      var: node => renderInlineVar(node as AimdVarNode),
      var_table: node => renderInlineVarTable(node as AimdVarTableNode),
      step: (node, _ctx, children) => renderInlineStep(node as AimdStepNode, children),
      check: (node, _ctx, children) => renderInlineCheck(node as AimdCheckNode, children),
      quiz: node => renderInlineQuiz(node as AimdQuizNode),
      fig: node => renderInlineFigure(node as AimdFigNode),
    },
  })

  if (
    (expectedRequestId !== undefined && expectedRequestId !== buildRequestId)
    || (expectedInlineRequestId !== undefined && expectedInlineRequestId !== inlineBuildRequestId)
  ) {
    return
  }

  inlineNodes.value = enhancedAppearance.value ? normalizeRecorderLayoutNodes(rendered.nodes) : rendered.nodes
  await nextTick()
  restoreFocusSnapshot(contentRoot.value, focusSnapshot ?? null)

  if (recordInitializedDuringRender) emitRecordUpdate()
}

function getVNodeClassList(node: VNode): string[] {
  const props = node.props as Record<string, unknown> | null | undefined
  const classValue = props?.class
  if (Array.isArray(classValue)) {
    return classValue.filter((value): value is string => typeof value === "string")
  }
  return typeof classValue === "string" ? [classValue] : []
}

function isVarFieldNode(node: unknown): node is VNode {
  if (!node || typeof node !== "object") {
    return false
  }

  const vnode = node as VNode
  const props = vnode.props as Record<string, unknown> | null | undefined
  const fieldNode = props?.node as Record<string, unknown> | undefined
  if (fieldNode?.fieldType === "var") {
    return true
  }

  return getVNodeClassList(vnode).some((className) => className.includes("aimd-rec-inline--var"))
}

function isTextLikeVNode(node: unknown): node is VNode {
  if (!node || typeof node !== "object") {
    return false
  }

  const vnode = node as VNode
  if (vnode.type === Text) {
    return true
  }

  return typeof vnode.type === "string" && ["span", "strong", "em", "code", "small", "b", "i"].includes(vnode.type)
}

function collectInlineText(node: VNodeChild): string | null {
  if (typeof node === "string" || typeof node === "number") {
    return String(node)
  }

  if (Array.isArray(node)) {
    const parts = node.map(collectInlineText).filter((part): part is string => typeof part === "string")
    return parts.length > 0 ? parts.join("") : null
  }

  if (!isTextLikeVNode(node)) {
    return null
  }

  const children = node.children
  if (typeof children === "string" || typeof children === "number") {
    return String(children)
  }
  if (Array.isArray(children)) {
    const parts = children.map(collectInlineText).filter((part): part is string => typeof part === "string")
    return parts.length > 0 ? parts.join("") : null
  }

  return null
}

function normalizeInlineText(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

const INLINE_METADATA_VAR_TYPES = new Set([
  "username",
  "currenttime",
  "currentrecordid",
])
const FORM_ITEM_INPUT_KINDS = new Set([
  "textarea",
  "dna",
  "code",
])

function isRecorderFormParagraphCandidate(node: VNode): boolean {
  return node.type === "p"
}

function tryTransformParagraphToFormItem(node: VNode): VNode | null {
  if (!isRecorderFormParagraphCandidate(node)) {
    return null
  }

  const rawChildren = Array.isArray(node.children) ? node.children as VNodeChild[] : [node.children as VNodeChild]
  const meaningfulChildren = rawChildren.filter((child) => {
    const text = collectInlineText(child)
    return text == null || normalizeInlineText(text).length > 0
  })

  const fieldChildren = meaningfulChildren.filter(isVarFieldNode)
  if (fieldChildren.length !== 1) {
    return null
  }

  const fieldIndex = meaningfulChildren.findIndex(isVarFieldNode)
  if (fieldIndex < 0) {
    return null
  }

  const textPartsBefore = meaningfulChildren.slice(0, fieldIndex).map(collectInlineText)
  const textPartsAfter = meaningfulChildren.slice(fieldIndex + 1).map(collectInlineText)
  if (textPartsBefore.some((part) => part == null) || textPartsAfter.some((part) => part == null)) {
    return null
  }

  const prefix = normalizeInlineText((textPartsBefore as string[]).join(""))
  const suffix = normalizeInlineText((textPartsAfter as string[]).join(""))
  if (!prefix || !/[:：]\s*$/.test(prefix)) {
    return null
  }

  const label = prefix.replace(/[:：]\s*$/, "").trim()
  if (!label) {
    return null
  }

  if (suffix.length > 14) {
    return null
  }

  const fieldNode = fieldChildren[0] as VNode
  const fieldProps = fieldNode.props as Record<string, unknown> | null | undefined
  const varFieldNode = fieldProps?.node as Record<string, unknown> | undefined
  const varId = typeof varFieldNode?.id === "string" ? varFieldNode.id : ""
  const showMeta = varId && normalizeInlineText(varId).toLowerCase() !== normalizeInlineText(label).toLowerCase()
  const rawVarType = typeof varFieldNode?.definition === "object" && varFieldNode?.definition
    ? (varFieldNode.definition as Record<string, unknown>).type
    : undefined
  const typeLabel = typeof fieldProps?.typeLabel === "string" ? fieldProps.typeLabel : undefined
  const normalizedVarType = normalizeVarTypeName(typeof rawVarType === "string" ? rawVarType : undefined)
  if (INLINE_METADATA_VAR_TYPES.has(normalizedVarType)) {
    return null
  }
  const isAssetField = (
    (typeof rawVarType === "string" && /^fileid/i.test(rawVarType.trim()))
    || (typeof typeLabel === "string" && /^fileid/i.test(typeLabel.trim()))
  )
  const inputKind = typeof fieldProps?.inputKind === "string" ? fieldProps.inputKind : undefined
  if (!isAssetField && (!inputKind || !FORM_ITEM_INPUT_KINDS.has(inputKind))) {
    return null
  }

  return h("div", {
    class: ["aimd-form-item", isAssetField ? "aimd-form-item--asset" : ""],
    "data-aimd-form-item": "true",
  }, [
    h("div", { class: "aimd-form-item__label" }, [
      h("div", { class: "aimd-form-item__label-text" }, label),
      showMeta
        ? h("div", { class: "aimd-form-item__meta" }, varId)
        : null,
    ]),
    h("div", { class: "aimd-form-item__control" }, [
      meaningfulChildren[fieldIndex] as VNode,
      suffix
        ? h("span", { class: "aimd-form-item__suffix" }, suffix)
        : null,
    ]),
  ])
}

function normalizeRecorderLayoutNode(node: VNodeChild): VNodeChild {
  if (Array.isArray(node)) {
    return node.map((child) => normalizeRecorderLayoutNode(child))
  }

  if (!node || typeof node !== "object") {
    return node
  }

  const vnode = node as VNode
  const normalizedChildren = Array.isArray(vnode.children)
    ? (vnode.children as VNodeChild[]).map((child) => normalizeRecorderLayoutNode(child))
    : vnode.children

  const normalizedVNode = Array.isArray(normalizedChildren)
    ? h(vnode.type as any, { ...(vnode.props ?? {}), key: vnode.key ?? undefined }, normalizedChildren as any)
    : vnode

  return tryTransformParagraphToFormItem(normalizedVNode) ?? normalizedVNode
}

function normalizeRecorderLayoutNodes(nodes: VNode[]): VNode[] {
  return nodes.map((node) => normalizeRecorderLayoutNode(node) as VNode)
}

async function parseAndBuild() {
  const currentRequestId = ++buildRequestId
  const currentInlineRequestId = ++inlineBuildRequestId
  try {
    renderError.value = ""
    const extracted = parseAndExtract(props.content || "")
    if (currentRequestId !== buildRequestId) return

    extractedFields.value = extracted
    clientAssigners.value = extracted.client_assigner || []
    emit("fields-change", extracted)

    const defaultsChanged = ensureDefaultsFromFields(localRecord, extracted)
    const assignerChanged = assignerRunner.applyCurrentClientAssigners()
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
    extractedFields.value = EMPTY_FIELDS
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
    const shouldRebuild = getRecordDataSignature(value) !== getRecordDataSignature(localRecord)
    if (!shouldRebuild) {
      return
    }
    syncingFromExternal = true
    applyIncomingRecord(localRecord, value)
    syncingFromExternal = false
    const assignerChanged = assignerRunner.applyCurrentClientAssigners()
    if (assignerChanged) {
      emitRecordUpdate()
    }
    if (shouldRebuild || assignerChanged) {
      scheduleInlineRebuild()
    }
  },
  { deep: true, immediate: true },
)

watch(hasRunningStepTimer, () => {
  timerNowMs.value = Date.now()
  syncProtocolTimerTicker()
}, { immediate: true })

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

onBeforeUnmount(() => {
  if (protocolTimerTicker) {
    clearInterval(protocolTimerTicker)
  }
})

defineExpose({
  runClientAssigner: assignerRunner.triggerClientAssigner,
  runManualClientAssigners: assignerRunner.triggerManualClientAssigners,
})
</script>

<template>
  <div
    class="aimd-protocol-recorder"
    :data-aimd-theme="resolvedTheme.mode"
    :data-aimd-appearance="enhancedAppearance ? 'enhanced' : 'default'"
    :data-aimd-density="isCompactDensity ? 'compact' : 'comfortable'"
    :data-aimd-outline="resolvedPresentationProfile.outline"
    :style="themeVars"
  >
    <div v-if="renderError" class="aimd-protocol-recorder__error">{{ renderError }}</div>

    <template v-else>
      <div v-if="showProtocolTimingSummary" class="aimd-protocol-recorder__timing">
        <span
          v-if="protocolEstimatedDurationMs > 0"
          class="aimd-protocol-recorder__timing-pill aimd-protocol-recorder__timing-pill--estimate"
        >
          {{ resolvedMessages.step.protocolEstimatedTotal(protocolEstimatedDurationLabel) }}
        </span>
        <span
          v-if="protocolRecordedDurationMs > 0"
          class="aimd-protocol-recorder__timing-pill"
        >
          {{ resolvedMessages.step.protocolRecordedTotal(protocolRecordedDurationLabel) }}
        </span>
      </div>

      <div v-if="inlineNodes.length" ref="contentRoot" class="aimd-protocol-recorder__content">
        <InlineNodesOutlet :nodes="inlineNodes" />
      </div>

      <div v-else class="aimd-protocol-recorder__empty">{{ resolvedMessages.common.emptyContent }}</div>
    </template>
  </div>
</template>

<style scoped>
.aimd-protocol-recorder {
  --rec-var-control-height: 30px;
  --rec-var-single-line-height: 1.2;
  --rec-var-text-wrap-line-height: 1.35;
  --rec-focus-ring: color-mix(in srgb, var(--rec-focus) 14%, transparent);
  --rec-step-accent: var(--aimd-state-warning-text);
  --rec-step-accent-strong: var(--aimd-state-warning-scope-text, var(--aimd-state-warning-text));
  --rec-step-border: color-mix(in srgb, var(--aimd-state-warning-border) 34%, transparent);
  --rec-step-surface: color-mix(in srgb, var(--aimd-state-warning-bg) 76%, var(--aimd-surface-panel));
  --rec-step-surface-strong: color-mix(in srgb, var(--aimd-state-warning-bg) 90%, var(--aimd-surface-panel));
  --rec-success-border: color-mix(in srgb, var(--aimd-state-success-border) 48%, transparent);
  --rec-interactive-border: var(--aimd-border-default);
  --rec-interactive-border-strong: var(--aimd-border-strong);
  --rec-interactive-surface: var(--aimd-surface-panel);
  --rec-interactive-surface-hover: var(--aimd-surface-panel-subtle);
  color: var(--aimd-color-text);
}

.aimd-protocol-recorder__error {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--aimd-state-danger-border);
  background: var(--aimd-state-danger-bg);
  color: var(--aimd-state-danger-text);
  font-size: 13px;
}

.aimd-protocol-recorder__timing {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.aimd-protocol-recorder__timing-pill {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid var(--aimd-border-default);
  border-radius: 999px;
  background: var(--aimd-surface-panel-subtle);
  color: var(--aimd-color-text);
  font-size: 12px;
  font-weight: 600;
}

.aimd-protocol-recorder__timing-pill--estimate {
  border-color: var(--aimd-state-warning-border);
  background: var(--aimd-state-warning-bg);
  color: var(--aimd-state-warning-text);
}

.aimd-protocol-recorder__content {
  padding: 18px 20px;
  border: 1px solid var(--rec-border);
  border-radius: 14px;
  background: linear-gradient(180deg, var(--aimd-surface-panel) 0%, var(--aimd-surface-panel-raised) 100%);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--aimd-color-text-strong) 6%, transparent);
  color: var(--rec-text);
  line-height: 1.7;
}

.aimd-protocol-recorder__empty {
  padding: 24px;
  border: 1px dashed var(--aimd-border-default);
  border-radius: 8px;
  color: var(--aimd-color-text-muted);
  text-align: center;
}

/* ── Typography ─────────────────────────────────────────────────────────── */
.aimd-protocol-recorder__content :deep(h1) { margin: 0.45em 0 0.5em; font-size: 1.7em; line-height: 1.25; }
.aimd-protocol-recorder__content :deep(h2) { margin: 0.95em 0 0.6em; font-size: 1.42em; line-height: 1.25; font-weight: 700; }
.aimd-protocol-recorder__content :deep(h3) {
  margin: 1.1em 0 0.7em;
  padding-bottom: 0.45em;
  border-bottom: 1px solid var(--aimd-border-muted);
  font-size: 1.02em;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0.01em;
}
.aimd-protocol-recorder__content :deep(p) { margin: 0.45em 0; color: var(--rec-text); }
.aimd-protocol-recorder__content :deep(ul),
.aimd-protocol-recorder__content :deep(ol) { margin: 0.35em 0; padding-left: 22px; }
.aimd-protocol-recorder__content :deep(table) { border-collapse: collapse; margin: 10px 0; font-size: 14px; }
.aimd-protocol-recorder__content :deep(th),
.aimd-protocol-recorder__content :deep(td) { border: 1px solid var(--aimd-border-muted); padding: 6px 10px; text-align: left; }
.aimd-protocol-recorder__content :deep(th) { background: var(--aimd-surface-panel-subtle); }
.aimd-protocol-recorder__content :deep(blockquote) {
  margin: 8px 0;
  padding: 8px 12px;
  border-left: 3px solid var(--aimd-border-default);
  color: var(--aimd-color-text-muted);
  background: color-mix(in srgb, var(--aimd-surface-panel-subtle) 72%, transparent);
}
.aimd-protocol-recorder__content :deep(code) {
  background: color-mix(in srgb, var(--aimd-surface-panel-subtle) 92%, transparent);
  border-radius: 4px;
  padding: 2px 5px;
}

/* ── Field base ─────────────────────────────────────────────────────────── */
.aimd-protocol-recorder__content :deep(.aimd-field) {
  border-radius: 10px;
  margin: 6px 0;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--aimd-surface-overlay) 92%, transparent);
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
.aimd-protocol-recorder__content :deep(.aimd-field--var) {
  background: var(--aimd-state-var-bg);
  border-color: var(--aimd-state-var-border);
  color: var(--aimd-state-var-text);
}
.aimd-protocol-recorder__content :deep(.aimd-field--var .aimd-field__scope) {
  background: var(--aimd-state-var-scope-bg);
  color: var(--aimd-state-var-scope-text);
}
.aimd-protocol-recorder__content :deep(.aimd-field--step) {
  background: color-mix(in srgb, var(--aimd-state-warning-bg) 78%, var(--aimd-surface-panel));
  border-color: color-mix(in srgb, var(--aimd-state-warning-border) 72%, white);
  color: var(--aimd-state-warning-text);
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--step > .aimd-step-field__main .aimd-rec-inline__check-wrap > .aimd-field__scope) {
  background: var(--aimd-state-warning-scope-bg);
  color: var(--aimd-state-warning-scope-text);
}
.aimd-protocol-recorder__content :deep(.aimd-field--check) {
  background: var(--aimd-surface-panel-subtle);
  border-color: var(--aimd-border-default);
  color: var(--aimd-color-text);
  padding: 3px 8px;
}
.aimd-protocol-recorder__content :deep(.aimd-field--check .aimd-field__scope) {
  background: var(--aimd-state-check-scope-bg);
  color: var(--aimd-state-check-scope-text);
}
.aimd-protocol-recorder__content :deep(.aimd-field--var-table) {
  display: block;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  background: linear-gradient(180deg, var(--aimd-surface-panel) 0%, color-mix(in srgb, var(--aimd-state-success-bg) 22%, var(--aimd-surface-panel)) 100%);
  border: 1px solid color-mix(in srgb, var(--aimd-state-success-border) 54%, var(--aimd-border-default));
  color: var(--aimd-color-text);
  border-radius: 16px;
  padding: 12px 14px;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--aimd-surface-overlay) 96%, transparent),
    0 8px 24px color-mix(in srgb, var(--aimd-color-text-strong) 4%, transparent);
}
.aimd-protocol-recorder__content :deep(.aimd-field--var-table .aimd-field__scope) {
  background: var(--aimd-state-success-bg);
  color: var(--aimd-state-success-scope-text, var(--aimd-state-success-text));
}
.aimd-protocol-recorder__content :deep(.aimd-field--var-table .aimd-field__name) {
  color: var(--aimd-color-text-strong);
}
.aimd-protocol-recorder__content :deep(.aimd-field--var-table .aimd-field__header) {
  display: inline-flex;
  flex-wrap: wrap;
  max-width: 100%;
}
.aimd-protocol-recorder__content :deep(.aimd-field--var-table .aimd-field__table-preview),
.aimd-protocol-recorder__content :deep(.aimd-field--var-table .aimd-rec-card-list) {
  width: 100%;
  max-width: 100%;
}
/* ── Error & loading ────────────────────────────────────────────────────── */
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--error) { border-color: var(--rec-error) !important; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--error:focus-within) { box-shadow: 0 0 0 2px color-mix(in srgb, var(--rec-error) 24%, transparent); }
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
  padding: 0;
  border: 0 none;
  border-radius: 0;
  overflow: visible;
  box-shadow: none;
  background: transparent;
}
.aimd-protocol-recorder__content :deep(.aimd-form-item) {
  display: grid;
  gap: 8px;
  margin: 18px 0;
}
.aimd-protocol-recorder__content :deep(.aimd-form-item__label) {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-form-item__label-text) {
  color: var(--aimd-color-text-strong);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.45;
}
.aimd-protocol-recorder__content :deep(.aimd-form-item__meta) {
  color: var(--aimd-color-text-subtle);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.3;
}
.aimd-protocol-recorder__content :deep(.aimd-form-item__control) {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-form-item__suffix) {
  color: var(--aimd-color-text-muted);
  font-size: 13px;
  line-height: 1.4;
  white-space: nowrap;
}
.aimd-protocol-recorder__content :deep(.aimd-form-item .aimd-rec-inline--var-stacked) {
  flex: 1 1 auto;
  width: min(100%, 560px);
  margin: 0;
  padding: 0;
  border: 0 none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.aimd-protocol-recorder__content :deep(.aimd-form-item--asset .aimd-form-item__control) {
  display: block;
}
.aimd-protocol-recorder__content :deep(.aimd-form-item--asset .aimd-rec-inline--var-stacked) {
  width: 100%;
  max-width: 100%;
}
.aimd-protocol-recorder__content :deep(.aimd-form-item .aimd-rec-inline--var-stacked:focus-within) {
  border-color: transparent;
  box-shadow: none;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked--textarea) { min-width: 0; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked--checkbox) { width: fit-content; min-width: 0; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked:focus-within) {
  border-color: transparent;
  box-shadow: none;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked .aimd-field) { margin: 0; box-shadow: none; }
.aimd-protocol-recorder__content :deep(.aimd-var-tooltip) {
  position: absolute;
  left: 0;
  bottom: calc(100% + 12px);
  z-index: 20;
  display: grid;
  gap: 3px;
  width: min(320px, calc(100vw - 48px));
  padding: 10px 12px 11px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 92%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--aimd-surface-panel) 90%, transparent);
  backdrop-filter: blur(14px);
  box-shadow:
    0 14px 36px color-mix(in srgb, var(--aimd-color-text-strong) 10%, transparent),
    0 2px 10px color-mix(in srgb, var(--aimd-color-text-strong) 5%, transparent);
  opacity: 0;
  transform: translateY(6px) scale(0.985);
  transform-origin: left bottom;
  pointer-events: none;
  transition:
    opacity 0.2s ease,
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}
.aimd-protocol-recorder__content :deep(.aimd-var-tooltip::after) {
  content: "";
  position: absolute;
  left: 18px;
  top: 100%;
  width: 12px;
  height: 12px;
  border-right: 1px solid color-mix(in srgb, var(--aimd-border-default) 92%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--aimd-border-default) 92%, transparent);
  background: color-mix(in srgb, var(--aimd-surface-panel) 90%, transparent);
  transform: translateY(-7px) rotate(45deg);
}
.aimd-protocol-recorder__content :deep(.aimd-var-tooltip__title) {
  color: var(--aimd-state-brand-scope-text, var(--aimd-color-text-strong));
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
}
.aimd-protocol-recorder__content :deep(.aimd-var-tooltip__type) {
  color: var(--aimd-color-text-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.aimd-protocol-recorder__content :deep(.aimd-var-tooltip__description) {
  color: var(--aimd-color-text);
  font-size: 12px;
  line-height: 1.5;
}
.aimd-protocol-recorder__content :deep(.aimd-var-tooltip__meta) {
  color: var(--aimd-color-text-subtle);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.35;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked:hover .aimd-var-tooltip),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked:focus-within .aimd-var-tooltip) {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-markdown) {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  width: min(100%, 1040px);
  max-width: 100%;
  margin: 12px 0;
  vertical-align: top;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked--code) {
  width: min(100%, 980px);
  min-width: min(420px, 100%);
  max-width: 100%;
  margin: 12px 0;
  vertical-align: top;
}

/* ── Stacked input controls ─────────────────────────────────────────────── */
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input--stacked) {
  width: 100%;
  min-width: 0;
  height: var(--rec-var-control-height);
  font-family: inherit;
  font-size: inherit;
  line-height: var(--rec-var-single-line-height);
  border: 1px solid color-mix(in srgb, var(--aimd-state-var-border) 78%, transparent);
  border-radius: 10px;
  margin: 0;
  box-shadow: none;
  padding: 0 10px;
  background: var(--aimd-surface-panel);
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    background-color 0.18s ease;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input--stacked:focus) {
  border-color: color-mix(in srgb, var(--rec-focus) 82%, transparent);
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--rec-focus) 18%, transparent),
    0 8px 18px color-mix(in srgb, var(--rec-focus) 10%, transparent);
  background: var(--aimd-surface-panel);
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__textarea--stacked:not(.aimd-rec-inline__textarea--stacked-text)) {
  width: 100%;
  min-width: 0;
  min-height: 82px;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  border: 1px solid color-mix(in srgb, var(--aimd-state-var-border) 78%, transparent);
  border-radius: 10px;
  margin: 0;
  box-shadow: none;
  padding: 8px 10px;
  background: var(--aimd-surface-panel);
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    background-color 0.18s ease;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__textarea--stacked-text) {
  display: block;
  width: 100%;
  min-width: 0;
  min-height: var(--rec-var-control-height);
  font-family: inherit;
  font-size: inherit;
  line-height: var(--rec-var-text-wrap-line-height);
  border: 1px solid color-mix(in srgb, var(--aimd-state-var-border) 78%, transparent);
  border-radius: 10px;
  margin: 0;
  box-shadow: none;
  padding: 5px 10px;
  background: var(--aimd-surface-panel);
  box-sizing: border-box;
  resize: none;
  overflow: hidden;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    background-color 0.18s ease;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__textarea--stacked:focus) {
  border-color: color-mix(in srgb, var(--rec-focus) 82%, transparent);
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--rec-focus) 18%, transparent),
    0 8px 18px color-mix(in srgb, var(--rec-focus) 10%, transparent);
  background: var(--aimd-surface-panel);
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__checkbox-row) {
  display: flex;
  align-items: center;
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--aimd-state-var-border) 78%, transparent);
  border-radius: 10px;
  background: var(--aimd-surface-panel);
  transition:
    border-color 0.18s ease,
    box-shadow 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    background-color 0.18s ease;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__checkbox-row:focus-within) {
  border-color: color-mix(in srgb, var(--rec-focus) 82%, transparent);
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--rec-focus) 18%, transparent),
    0 8px 18px color-mix(in srgb, var(--rec-focus) 10%, transparent);
}

/* ── Select ─────────────────────────────────────────────────────────────── */
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__select) { appearance: auto; cursor: pointer; height: var(--rec-var-control-height); padding: 0 8px; background: var(--aimd-surface-panel); }
.aimd-protocol-recorder__content :deep(.aimd-form-item .aimd-rec-inline__select) {
  width: 100%;
}

@media (max-width: 640px) {
  .aimd-protocol-recorder {
    --rec-var-control-height: 38px;
    --rec-var-single-line-height: 1.25;
    --rec-var-text-wrap-line-height: 1.45;
  }
  .aimd-protocol-recorder__content {
    padding: 16px 14px;
    border-radius: 16px;
  }
  .aimd-protocol-recorder__content :deep(h3) {
    margin-top: 1em;
    margin-bottom: 0.65em;
  }
  .aimd-protocol-recorder__content :deep(.aimd-form-item) {
    gap: 10px;
    margin: 16px 0;
  }
  .aimd-protocol-recorder__content :deep(.aimd-form-item__control) {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .aimd-protocol-recorder__content :deep(.aimd-form-item__suffix) {
    white-space: normal;
    font-size: 12px;
  }
  .aimd-protocol-recorder__content :deep(.aimd-form-item .aimd-rec-inline--var-stacked) {
    width: 100%;
  }
  .aimd-protocol-recorder__content :deep(.aimd-rec-inline__input--stacked),
  .aimd-protocol-recorder__content :deep(.aimd-rec-inline__textarea--stacked),
  .aimd-protocol-recorder__content :deep(.aimd-rec-inline__checkbox-row) {
    width: 100%;
  }
  .aimd-protocol-recorder__content :deep(.aimd-rec-inline__input--stacked),
  .aimd-protocol-recorder__content :deep(.aimd-rec-inline__select) {
    font-size: 16px;
  }
  .aimd-protocol-recorder__content :deep(.aimd-rec-inline__textarea--stacked) {
    font-size: 16px;
    padding-top: 9px;
    padding-bottom: 9px;
  }
  .aimd-protocol-recorder__content :deep(.aimd-rec-inline__checkbox-row) {
    min-height: 42px;
  }
  .aimd-protocol-recorder__content :deep(.aimd-var-tooltip) {
    left: 0;
    right: auto;
    bottom: auto;
    top: calc(100% + 10px);
    width: min(320px, calc(100vw - 32px));
    padding: 11px 12px 12px;
    border-radius: 16px;
    transform: translateY(-4px) scale(0.985);
  }
  .aimd-protocol-recorder__content :deep(.aimd-var-tooltip::after) {
    left: 0;
    left: 18px;
    top: 0;
    border-right: 0;
    border-bottom: 0;
    border-left: 1px solid color-mix(in srgb, var(--aimd-border-default) 92%, transparent);
    border-top: 1px solid color-mix(in srgb, var(--aimd-border-default) 92%, transparent);
    transform: translateY(-6px) rotate(45deg);
  }
}

/* ── Step / check ───────────────────────────────────────────────────────── */
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--step),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--check) { gap: 8px; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--check) {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  width: min(100%, 1040px);
  max-width: 100%;
  margin: 10px 0;
  padding: 10px 12px;
  border: 1px solid var(--aimd-border-default);
  border-radius: 14px;
  background: var(--aimd-surface-panel-subtle);
  box-sizing: border-box;
}
.aimd-protocol-recorder__content :deep(.aimd-check-field__main) {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--check > .aimd-rec-inline__input--annotation) {
  min-width: 0;
  width: 100%;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--check > .aimd-rec-inline__check-wrap) {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  min-width: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-check-field__toggle) {
  gap: 8px;
}
.aimd-protocol-recorder__content :deep(.aimd-check-field__key) {
  font-size: 12px;
  font-weight: 600;
  color: var(--aimd-state-check-scope-text, var(--aimd-color-text-muted));
}
.aimd-protocol-recorder__content :deep(.aimd-check-field__body) {
  min-width: 0;
  color: var(--rec-text);
  font-size: 14px;
  line-height: 1.65;
  transition: color 0.2s ease, opacity 0.2s ease, text-decoration-color 0.2s ease;
}
.aimd-protocol-recorder__content :deep(.aimd-check-field__body p) {
  margin: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-check-field__body--checked) {
  color: var(--aimd-color-text-muted);
  opacity: 0.92;
  text-decoration: line-through;
  text-decoration-thickness: 1.5px;
  text-decoration-color: color-mix(in srgb, var(--aimd-color-text-muted) 55%, transparent);
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--check > .aimd-rec-inline__check-wrap > .aimd-field__name),
.aimd-protocol-recorder__content :deep(.aimd-check-field__body) {
  min-width: 0;
  overflow-wrap: anywhere;
}
.aimd-protocol-recorder__content :deep(.aimd-check-field__banner) {
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--aimd-state-success-border) 42%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--aimd-state-success-bg) 92%, var(--aimd-surface-panel));
  color: var(--aimd-state-success-scope-text, var(--aimd-state-success-text));
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--step) {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  width: min(100%, 1040px);
  max-width: 100%;
  margin: 16px 0;
  padding: 14px 16px 16px;
  border: 1px solid color-mix(in srgb, var(--aimd-state-warning-border) 66%, white);
  border-radius: 18px;
  background: var(--aimd-surface-panel);
  box-shadow: none;
  color: var(--rec-text);
}
.aimd-protocol-recorder__content :deep(.aimd-step-field__main) {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px 14px;
  min-width: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-step-field__main-meta) {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-step-field__main-actions) {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
.aimd-protocol-recorder__content :deep(.aimd-step-field__body) {
  min-width: 0;
  color: var(--rec-text);
  font-size: 15px;
  line-height: 1.72;
}
.aimd-protocol-recorder__content :deep(.aimd-step-field__body .aimd-step-body) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.aimd-protocol-recorder__content :deep(.aimd-step-field__body p) {
  margin: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-step-field__details) {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--aimd-state-warning-border) 28%, transparent);
}
.aimd-protocol-recorder__content :deep(.aimd-step-field__detail--timer) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-step-field__detail--annotation) {
  display: flex;
  width: 100%;
  min-width: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--quiz) { display: block; margin: 12px 0; padding: 0; border: none; background: transparent; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--quiz.aimd-field--quiz) {
  border-radius: 12px;
  border-color: color-mix(in srgb, var(--aimd-state-quiz-border) 78%, white);
  background: color-mix(in srgb, var(--aimd-state-quiz-bg) 72%, var(--aimd-surface-panel));
  padding: 10px 12px;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__check-wrap) {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-field__meta-id) {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid var(--aimd-border-default);
  background: var(--aimd-surface-panel-subtle);
  color: var(--rec-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__step-num) { font-weight: 600; color: var(--rec-step-accent); }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--step > .aimd-step-field__main .aimd-rec-inline__check-wrap > .aimd-field__name) {
  font-size: 1.02rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--rec-step-accent-strong);
  overflow-wrap: anywhere;
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__pill) {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid var(--rec-step-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--aimd-surface-panel) 82%, transparent);
  color: var(--rec-step-accent);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__pill--estimate) {
  background: var(--rec-step-surface);
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__pill--actual) {
  color: var(--aimd-color-text-muted);
  border-color: color-mix(in srgb, var(--aimd-border-strong) 36%, transparent);
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__pill--running) {
  color: var(--aimd-state-success-scope-text, var(--aimd-state-success-text));
  border-color: var(--rec-success-border);
  background: color-mix(in srgb, var(--aimd-state-success-bg) 92%, var(--aimd-surface-panel));
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__hero) {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid var(--rec-step-border);
  border-radius: 999px;
  background: var(--rec-step-surface-strong);
  color: var(--rec-step-accent);
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__hero--countdown) {
  border-color: var(--rec-step-border);
  background: var(--rec-step-surface-strong);
  color: var(--rec-step-accent);
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__hero--warning) {
  border-color: color-mix(in srgb, var(--aimd-state-warning-border) 58%, transparent);
  background: color-mix(in srgb, var(--aimd-state-warning-bg) 96%, var(--aimd-surface-panel));
  color: var(--aimd-state-warning-scope-text, var(--aimd-state-warning-text));
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__hero--overtime) {
  border-color: color-mix(in srgb, var(--aimd-state-danger-border) 56%, transparent);
  background: color-mix(in srgb, var(--aimd-state-danger-bg) 96%, var(--aimd-surface-panel));
  color: var(--aimd-state-danger-scope-text, var(--aimd-state-danger-text));
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__controls) {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__btn) {
  border: 1px solid var(--rec-interactive-border);
  border-radius: 999px;
  min-height: 28px;
  padding: 0 10px;
  background: var(--rec-interactive-surface);
  color: var(--aimd-color-text);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s, color 0.2s;
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__btn:hover:not(:disabled)) {
  border-color: var(--rec-interactive-border-strong);
  background: var(--rec-interactive-surface-hover);
  color: var(--aimd-state-brand-scope-text, var(--aimd-color-text));
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__btn:disabled) {
  opacity: 0.45;
  cursor: not-allowed;
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__btn--ghost) {
  background: transparent;
}
.aimd-protocol-recorder__content :deep(.aimd-step-field__toggle) {
  color: var(--rec-step-accent);
  border-color: var(--rec-step-border);
  background: color-mix(in srgb, var(--aimd-surface-panel) 82%, transparent);
}
.aimd-protocol-recorder__content :deep(.aimd-step-field__toggle:hover:not(:disabled)) {
  border-color: color-mix(in srgb, var(--aimd-state-warning-border) 52%, transparent);
  background: color-mix(in srgb, var(--aimd-state-warning-bg) 96%, var(--aimd-surface-panel));
  color: var(--rec-step-accent-strong);
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline input[type="checkbox"]),
.aimd-protocol-recorder__content :deep(.aimd-checkbox) { width: 16px; height: 16px; accent-color: var(--rec-focus); }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input) {
  height: 30px;
  min-width: 94px;
  padding: 0 10px;
  border: 1px solid var(--rec-interactive-border);
  border-radius: 8px;
  font-size: 13px;
  outline: none;
  background: var(--rec-interactive-surface);
  color: var(--rec-text);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input::placeholder) { color: var(--aimd-color-text-subtle); }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input:focus) { border-color: var(--rec-focus); box-shadow: 0 0 0 2px var(--rec-focus-ring); }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var .aimd-rec-inline__input) { width: clamp(120px, 28vw, 280px); }
.aimd-protocol-recorder__content :deep(.aimd-step-field__annotation-editor) {
  width: 100%;
  min-width: 0;
}

@media (max-width: 640px) {
  .aimd-protocol-recorder__content :deep(.aimd-step-field__details) {
    padding-top: 10px;
  }
  .aimd-protocol-recorder__content :deep(.aimd-step-field__main) {
    flex-direction: column;
  }
  .aimd-protocol-recorder__content :deep(.aimd-step-field__main-actions) {
    justify-content: flex-start;
  }
  .aimd-protocol-recorder__content :deep(.aimd-rec-inline--check) {
    gap: 10px;
  }
}

@media (hover: none), (pointer: coarse) {
  .aimd-protocol-recorder__content :deep(.aimd-rec-inline__input--stacked:focus),
  .aimd-protocol-recorder__content :deep(.aimd-rec-inline__textarea--stacked:focus),
  .aimd-protocol-recorder__content :deep(.aimd-rec-inline__checkbox-row:focus-within) {
    box-shadow:
      0 0 0 3px var(--rec-focus-ring),
      0 6px 14px color-mix(in srgb, var(--rec-focus) 8%, transparent);
  }
  .aimd-protocol-recorder__content :deep(.aimd-var-tooltip) {
    transition:
      opacity 0.16s ease,
      transform 0.18s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked:hover .aimd-var-tooltip) {
    opacity: 0;
    transform: translateY(6px) scale(0.985);
  }
  .aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked:focus-within .aimd-var-tooltip) {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input.aimd-rec-inline__input--stacked),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__textarea.aimd-rec-inline__textarea--stacked) { font-family: inherit; outline: none; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--compact) {
  margin-top: 8px;
  margin-bottom: 8px;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--compact.aimd-rec-inline--step) {
  gap: 10px;
  padding: 10px 12px 12px;
  border-radius: 14px;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--compact.aimd-rec-inline--check) {
  gap: 8px;
  padding: 8px 10px;
  border-radius: 12px;
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
  padding-top: 8px;
  padding-bottom: 8px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__table) {
  width: max-content;
  min-width: 100%;
  table-layout: auto;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__table col) {
  transition: width 0.18s ease;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__column-head) {
  color: var(--aimd-color-text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  padding-left: 6px;
  padding-right: 6px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__column-head--compact) {
  text-align: center;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__column-head--wide) {
  letter-spacing: 0.06em;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-col) {
  width: 44px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__action-col) {
  width: 56px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-head),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-cell) {
  width: 34px;
  text-align: center;
  vertical-align: middle;
  padding-left: 0;
  padding-right: 0;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__action-head),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__action-cell) {
  width: 40px;
  text-align: center;
  padding-left: 0;
  padding-right: 0;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__row--alt .aimd-rec-inline-table__value-cell) {
  background: color-mix(in srgb, var(--aimd-surface-panel-subtle) 24%, transparent);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__value-cell) {
  position: relative;
  min-width: 0;
  padding-top: 6px;
  padding-bottom: 6px;
  padding-left: 6px;
  padding-right: 6px;
  transition: background-color 0.18s ease, box-shadow 0.18s ease;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__value-cell--compact) {
  text-align: center;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__value-cell:hover) {
  background: color-mix(in srgb, var(--aimd-surface-panel-subtle) 64%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--aimd-border-default) 52%, transparent);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__value-cell:focus-within) {
  background: color-mix(in srgb, var(--aimd-state-brand-bg) 96%, var(--aimd-surface-panel));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--aimd-color-focus) 30%, transparent);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__table--dragging) {
  cursor: grabbing;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__row--dragging-source td) {
  opacity: 0.5;
  transform: scale(0.985);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__row--drag-over td) {
  background: linear-gradient(180deg, var(--aimd-surface-panel-subtle) 0%, var(--aimd-state-brand-bg) 100%);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--aimd-color-focus) 36%, transparent),
    0 10px 24px color-mix(in srgb, var(--aimd-color-focus) 16%, transparent);
  transform: translateY(-2px);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__row--settling td) {
  animation: aimd-rec-inline-table-row-settle 0.48s cubic-bezier(0.22, 1, 0.36, 1);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__actions) {
  display: flex;
  justify-content: flex-start;
  margin-top: 12px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__add-btn) {
  border: 1px solid var(--rec-interactive-border);
  border-radius: 999px;
  padding: 6px 12px;
  background: var(--rec-interactive-surface);
  color: var(--aimd-color-text);
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s, color 0.2s;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__add-btn:hover) {
  border-color: var(--rec-interactive-border-strong);
  background: var(--rec-interactive-surface-hover);
  color: var(--aimd-state-brand-scope-text, var(--aimd-color-text));
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__add-btn:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__icon-btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--aimd-color-text-subtle);
  cursor: pointer;
  opacity: 0.08;
  transition:
    opacity 0.18s ease,
    color 0.18s ease,
    background-color 0.18s ease,
    transform 0.18s ease;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__row:hover .aimd-rec-inline-table__icon-btn),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__icon-btn:focus-visible) {
  opacity: 1;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__icon-btn:hover:not(:disabled)) {
  background: color-mix(in srgb, var(--aimd-state-danger-bg) 88%, transparent);
  color: var(--aimd-state-danger-scope-text, var(--aimd-state-danger-text));
  transform: translateY(-1px);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__icon-btn svg) {
  width: 14px;
  height: 14px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__icon-btn:disabled) {
  opacity: 0.36;
  cursor: not-allowed;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__icon-btn--visible) {
  opacity: 1;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle) {
  display: inline-grid;
  grid-template-columns: repeat(2, 3px);
  grid-auto-rows: 3px;
  gap: 3px 3px;
  padding: 4px 6px;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  border-radius: 999px;
  color: var(--aimd-color-text-subtle);
  cursor: grab;
  user-select: none;
  opacity: 0.35;
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
  background: color-mix(in srgb, var(--aimd-border-strong) 22%, transparent);
  color: var(--aimd-color-text-muted);
  opacity: 1;
  transform: translateY(-1px);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__row:hover .aimd-rec-inline-table__drag-handle),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle:focus-visible) {
  opacity: 0.92;
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
  color: var(--aimd-color-text-subtle);
  transform: none;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle--dragging),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle:active) {
  cursor: grabbing;
  color: var(--aimd-state-brand-scope-text, var(--aimd-color-text));
  transform: scale(0.96);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle--dragging .aimd-rec-inline-table__drag-dot),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle:active .aimd-rec-inline-table__drag-dot) {
  transform: scale(0.92);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-table-cell-input) {
  width: 100%;
  height: 34px;
  padding: 0 6px;
  border: 0;
  border-radius: 0;
  font-size: 13px;
  line-height: 1.35;
  outline: none;
  box-sizing: border-box;
  color: var(--rec-text);
  background: transparent;
  box-shadow: none;
  min-width: 8ch;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__value-cell--compact .aimd-rec-table-cell-input) {
  min-width: 6ch;
  text-align: center;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__value-cell--wide .aimd-rec-table-cell-input) {
  min-width: 14ch;
  padding-left: 6px;
  padding-right: 6px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-head),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__action-head) {
  color: transparent;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__row:hover .aimd-rec-inline-table__drag-cell),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__row:hover .aimd-rec-inline-table__action-cell) {
  background: transparent;
  box-shadow: none;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-table-cell-input--compact) {
  font-variant-numeric: tabular-nums;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-table-cell-input--wide) {
  line-height: 1.42;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-table-cell-input:focus) {
  box-shadow: none;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-table-cell-input::placeholder) {
  color: var(--aimd-color-text-subtle);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-card-list) {
  display: grid;
  gap: 12px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-card) {
  position: relative;
  padding: 10px 12px 12px;
  border: 1px solid var(--aimd-border-default);
  border-radius: 14px;
  background: color-mix(in srgb, var(--aimd-surface-panel) 94%, transparent);
  box-shadow: 0 8px 22px color-mix(in srgb, var(--aimd-color-text-strong) 6%, transparent);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-card__toolbar) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-card__field) {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding-top: 10px;
  margin-top: 10px;
  border-top: 1px solid var(--aimd-border-muted);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-card__field--title) {
  margin-top: 0;
  border-top: 0;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-card__body) {
  display: grid;
  gap: 0;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-card__label) {
  color: var(--aimd-color-text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-card__input) {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--rec-interactive-border);
  border-radius: 10px;
  background: var(--aimd-surface-panel-subtle);
  color: var(--rec-text);
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-card__input:hover) {
  background: var(--aimd-surface-panel);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-card__input:focus) {
  border-color: var(--rec-focus);
  box-shadow: 0 0 0 2px var(--rec-focus-ring);
  background: var(--aimd-surface-panel);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-card__input::placeholder) {
  color: var(--aimd-color-text-subtle);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-card__input--error) {
  border-color: var(--rec-error);
}

@keyframes aimd-rec-inline-table-row-settle {
  0% {
    background-color: color-mix(in srgb, var(--aimd-state-brand-bg) 92%, transparent);
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--aimd-color-focus) 42%, transparent),
      0 14px 28px color-mix(in srgb, var(--aimd-color-focus) 28%, transparent);
    transform: translateY(8px) scale(0.985);
  }

  60% {
    background-color: color-mix(in srgb, var(--aimd-state-brand-bg) 84%, transparent);
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--aimd-color-focus) 24%, transparent),
      0 8px 18px color-mix(in srgb, var(--aimd-color-focus) 18%, transparent);
    transform: translateY(-1px) scale(1);
  }

  100% {
    background-color: transparent;
    box-shadow: none;
    transform: none;
  }
}
</style>
