<script setup lang="ts">
import { computed, h, nextTick, reactive, ref, watch, type VNode } from "vue"
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
  AimdProtocolRecordData,
  FieldEventPayload,
  TableEventPayload,
} from "../types"
import { createEmptyProtocolRecordData } from "../types"
import {
  applyIncomingRecord,
  cloneRecordData,
  ensureDefaultsFromFields,
  getQuizDefaultValue,
} from "../composables/useRecordState"
import {
  getVarInputKind,
  normalizeDateTimeValueWithTimezone,
} from "../composables/useVarHelpers"
import {
  captureFocusSnapshot,
  restoreFocusSnapshot,
} from "../composables/useFocusManagement"
import type { FocusSnapshot } from "../composables/useFocusManagement"
import { normalizeDnaSequenceValue } from "../composables/useDnaSequence"
import { useClientAssignerRunner } from "../composables/useClientAssignerRunner"
import { resolveAimdRecorderFieldVNode } from "../composables/useFieldAdapters"
import { useVarTableDragDrop, getVarTableColumns } from "../composables/useVarTableDragDrop"
import { useFieldRendering } from "../composables/useFieldRendering"
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
  fieldAdapters: undefined,
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

const resolvedLocale = computed(() => resolveAimdRecorderLocale(props.locale))
const resolvedMessages = computed(() => createAimdRecorderMessages(resolvedLocale.value, props.messages))

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

const clientAssigners = ref<AimdClientAssignerField[]>([])

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
  wrapField: () => props.wrapField,
})

// ---------------------------------------------------------------------------
// Inline field renderers
// ---------------------------------------------------------------------------

function renderInlineVar(node: AimdVarNode): VNode {
  const id = node.id
  const fieldKey = `var:${id}`

  // 1. Custom renderer override
  if (props.customRenderers?.var) {
    const custom = props.customRenderers.var(node, {} as any, [])
    if (custom) return applyFieldAdapter("var", fieldKey, node, localRecord.var[id], custom as VNode)
  }

  const type = node.definition?.type || "str"
  const inputKind = getVarInputKind(type)

  // 2. Initialise value
  if (!(id in localRecord.var)) {
    localRecord.var[id] = fieldRendering.getVarInitialValue(node, type)
    const initialDisplayOverride = fieldRendering.getVarInitialDisplayOverride(node, type)
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
  if (inputKind === "dna") {
    const normalizedValue = normalizeDnaSequenceValue(localRecord.var[id])
    if (JSON.stringify(normalizedValue) !== JSON.stringify(localRecord.var[id])) {
      localRecord.var[id] = normalizedValue
      recordInitializedDuringRender = true
    }
  }

  const displayValue = fieldRendering.getVarDisplayValue(id, localRecord.var[id], inputKind)
  const disabled = fieldRendering.isFieldDisabled(fieldKey)
  const extraClasses = fieldRendering.fieldStateClasses(fieldKey)
  const meta = props.fieldMeta?.[fieldKey]

  const vnode = h(AimdVarField, {
    node,
    value: localRecord.var[id] as any,
    disabled,
    extraClasses,
    messages: resolvedMessages.value,
    fieldMeta: meta,
    displayValue,
    initialized: id in localRecord.var,
    onChange: (payload: { id: string, value: unknown, type: string, inputKind: string }) => {
      fieldRendering.clearVarInputDisplayOverride(payload.id)
      localRecord.var[payload.id] = payload.value
      markRecordChanged({ runClientAssigners: true })
      emit("field-change", { section: "var", fieldKey: payload.id, value: payload.value })
    },
    onBlur: (payload: { id: string }) => {
      emit("field-blur", { section: "var", fieldKey: payload.id })
    },
    onDnaChange: (payload: { id: string, value: unknown }) => {
      localRecord.var[payload.id] = payload.value
      markRecordChanged({ runClientAssigners: true })
      emit("field-change", { section: "var", fieldKey: payload.id, value: payload.value })
    },
  })

  return applyFieldAdapter("var", fieldKey, node, localRecord.var[id], vnode)
}

function renderInlineVarTable(node: AimdVarTableNode): VNode {
  const tableName = node.id
  const fieldKey = `var_table:${tableName}`
  const columns = getVarTableColumns(node)
  const rows = tableDragDrop.ensureVarTableRows(tableName, columns)
  const disabled = fieldRendering.isFieldDisabled(fieldKey)

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

function renderInlineStep(node: AimdStepNode): VNode {
  const id = node.id
  const fieldKey = `step:${id}`
  if (!(id in localRecord.step)) {
    localRecord.step[id] = { checked: false, annotation: "" }
  }

  const state = localRecord.step[id]
  const disabled = fieldRendering.isFieldDisabled(fieldKey)
  const extraClasses = fieldRendering.fieldStateClasses(fieldKey)

  const vnode = h(AimdStepField, {
    node,
    state,
    disabled,
    extraClasses,
    messages: resolvedMessages.value,
    onCheckChange: (payload: { id: string, value: boolean }) => {
      state.checked = payload.value
      markRecordChanged()
      emit("field-change", { section: "step", fieldKey: payload.id, value: payload.value })
    },
    onAnnotationChange: (payload: { id: string, value: string }) => {
      state.annotation = payload.value
      markRecordChanged()
      emit("field-change", { section: "step", fieldKey: `${payload.id}:annotation`, value: payload.value })
    },
    onBlur: (payload: { id: string }) => {
      emit("field-blur", { section: "step", fieldKey: payload.id })
    },
  })

  return applyFieldAdapter("step", fieldKey, node, state, vnode)
}

function renderInlineCheck(node: AimdCheckNode): VNode {
  const id = node.id
  const fieldKey = `check:${id}`
  if (!(id in localRecord.check)) {
    localRecord.check[id] = { checked: false, annotation: "" }
  }

  const state = localRecord.check[id]
  const disabled = fieldRendering.isFieldDisabled(fieldKey)
  const extraClasses = fieldRendering.fieldStateClasses(fieldKey)

  const vnode = h(AimdCheckField, {
    node,
    state,
    disabled,
    extraClasses,
    messages: resolvedMessages.value,
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
    if (assignerRunner.applyCurrentClientAssigners()) {
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
  runClientAssigner: assignerRunner.triggerClientAssigner,
  runManualClientAssigners: assignerRunner.triggerManualClientAssigners,
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
