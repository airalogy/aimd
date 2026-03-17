<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"
import type { AimdRecorderMessages } from "../locales"
import type {
  AimdDnaSequenceAnnotation,
  AimdDnaSequenceQualifier,
  AimdDnaSequenceSegment,
  AimdDnaSequenceValue,
} from "../types"
import {
  calculateDnaSequenceGcPercent,
  collectInvalidDnaSequenceCharacters,
  createEmptyDnaSequenceAnnotation,
  createEmptyDnaSequenceQualifier,
  createEmptyDnaSequenceSegment,
  getDnaSequenceSegmentIssue,
  getNextDnaSequenceAnnotationId,
  normalizeDnaSequenceName,
  normalizeDnaSequenceValue,
  serializeDnaSequenceToGenBank,
} from "../composables/useDnaSequence"
import AimdSeqVizViewer from "./AimdSeqVizViewer.vue"

type DnaEditorMode = "interactive" | "raw"

interface ViewerAnnotation {
  id: string
  name: string
  start: number
  end: number
  direction?: 1 | -1
  color?: string
}

interface ViewerSelection {
  clockwise?: boolean
  direction?: number
  end?: number
  id?: string
  length?: number
  name?: string
  start?: number
  type: string
  viewer?: "LINEAR" | "CIRCULAR"
}

interface ViewerExternalSelection {
  clockwise?: boolean
  end: number
  start: number
}

const VIEWER_ANNOTATION_PREFIX = "dna_annotation"

const props = withDefaults(defineProps<{
  modelValue?: unknown
  varId: string
  disabled?: boolean
  placeholder?: string
  messages: Pick<AimdRecorderMessages, "scope" | "dna">
}>(), {
  modelValue: undefined,
  disabled: false,
  placeholder: undefined,
})

const emit = defineEmits<{
  (e: "update:modelValue", value: AimdDnaSequenceValue): void
  (e: "blur"): void
}>()

const value = computed(() => normalizeDnaSequenceValue(props.modelValue))
const sequenceLength = computed(() => value.value.sequence.length)
const gcPercent = computed(() => calculateDnaSequenceGcPercent(value.value.sequence))
const invalidCharacters = computed(() => collectInvalidDnaSequenceCharacters(value.value.sequence))

const editorMode = ref<DnaEditorMode>("interactive")
const activeAnnotationId = ref<string | null>(null)
const activeSegmentIndex = ref(0)
const selection = ref<ViewerSelection | null>(null)
const viewerSelection = ref<ViewerExternalSelection | null>(null)
const interactiveNameInputRef = ref<HTMLInputElement | null>(null)
const interactiveSequenceDraft = ref("")
const importFileInputRef = ref<HTMLInputElement | null>(null)
const importErrorMessage = ref<string | null>(null)

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function buildViewerAnnotationId(annotationId: string, segmentIndex: number): string {
  return `${VIEWER_ANNOTATION_PREFIX}:${annotationId}:${segmentIndex}`
}

function parseViewerAnnotationId(id: string | undefined): { annotationId: string; segmentIndex: number } | null {
  if (!id || !id.startsWith(`${VIEWER_ANNOTATION_PREFIX}:`)) {
    return null
  }

  const [, annotationId = "", rawSegmentIndex = "0"] = id.split(":")
  const segmentIndex = Number.parseInt(rawSegmentIndex, 10)
  if (!annotationId || !Number.isFinite(segmentIndex) || segmentIndex < 0) {
    return null
  }

  return {
    annotationId,
    segmentIndex,
  }
}

function formatSegment(segment: AimdDnaSequenceSegment): string {
  const start = segment.partial_start ? `<${segment.start}` : String(segment.start)
  const end = segment.partial_end ? `>${segment.end}` : String(segment.end)
  return `${start}..${end}`
}

function annotationSegmentsLabel(annotation: AimdDnaSequenceAnnotation): string {
  return annotation.segments.map(formatSegment).join(", ")
}

function commit(nextValue: unknown) {
  emit("update:modelValue", normalizeDnaSequenceValue(nextValue))
}

function patchValue(patch: Partial<AimdDnaSequenceValue>) {
  commit({ ...value.value, ...patch })
}

function patchAnnotation(index: number, patch: Partial<AimdDnaSequenceAnnotation>) {
  const annotations = value.value.annotations.map((annotation, annotationIndex) =>
    annotationIndex === index
      ? { ...annotation, ...patch }
      : annotation)
  patchValue({ annotations })
}

function patchSegment(
  annotationIndex: number,
  segmentIndex: number,
  patch: Partial<AimdDnaSequenceSegment>,
) {
  const annotation = value.value.annotations[annotationIndex]
  if (!annotation) return

  const segments = annotation.segments.map((segment, currentIndex) =>
    currentIndex === segmentIndex
      ? { ...segment, ...patch }
      : segment)
  patchAnnotation(annotationIndex, { segments })
}

function patchQualifier(
  annotationIndex: number,
  qualifierIndex: number,
  patch: Partial<AimdDnaSequenceQualifier>,
) {
  const annotation = value.value.annotations[annotationIndex]
  if (!annotation) return

  const qualifiers = annotation.qualifiers.map((qualifier, currentIndex) =>
    currentIndex === qualifierIndex
      ? { ...qualifier, ...patch }
      : qualifier)
  patchAnnotation(annotationIndex, { qualifiers })
}

function normalizeViewerSelection(value: unknown): ViewerSelection | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const selection = value as Record<string, unknown>
  const hasRange = isFiniteNumber(selection.start) && isFiniteNumber(selection.end)
  const type = typeof selection.type === "string" && selection.type
    ? selection.type
    : hasRange
      ? "SEQ"
      : ""
  if (!type) {
    return null
  }

  return {
    type,
    clockwise: selection.clockwise === true,
    direction: isFiniteNumber(selection.direction) ? selection.direction : undefined,
    end: isFiniteNumber(selection.end) ? selection.end : undefined,
    id: typeof selection.id === "string" ? selection.id : undefined,
    length: isFiniteNumber(selection.length) ? selection.length : undefined,
    name: typeof selection.name === "string" ? selection.name : undefined,
    start: isFiniteNumber(selection.start) ? selection.start : undefined,
    viewer: selection.viewer === "CIRCULAR" ? "CIRCULAR" : selection.viewer === "LINEAR" ? "LINEAR" : undefined,
  }
}

function createSegmentsFromSelection(
  nextSelection: ViewerSelection | null,
  topology: "linear" | "circular",
  totalLength: number,
): AimdDnaSequenceSegment[] {
  if (!nextSelection || totalLength <= 0) {
    return []
  }

  if (!isFiniteNumber(nextSelection.start) || !isFiniteNumber(nextSelection.end)) {
    return []
  }

  const rawStart = Math.max(0, Math.min(nextSelection.start, totalLength - 1))
  const rawEnd = Math.max(0, Math.min(nextSelection.end, totalLength))

  if (rawEnd === rawStart) {
    return []
  }

  if (topology === "circular" && rawEnd < rawStart) {
    const segments: AimdDnaSequenceSegment[] = []

    if (rawStart < totalLength) {
      segments.push({
        start: rawStart + 1,
        end: totalLength,
        partial_start: false,
        partial_end: false,
      })
    }

    if (rawEnd > 0) {
      segments.push({
        start: 1,
        end: rawEnd,
        partial_start: false,
        partial_end: false,
      })
    }

    return segments.filter(segment => segment.end >= segment.start)
  }

  const start = Math.min(rawStart, rawEnd)
  const end = Math.max(rawStart, rawEnd)
  return [{
    start: start + 1,
    end,
    partial_start: false,
    partial_end: false,
  }]
}

function createExternalSelectionFromSegment(segment: AimdDnaSequenceSegment): ViewerExternalSelection {
  return {
    start: Math.max(segment.start - 1, 0),
    end: segment.end,
    clockwise: true,
  }
}

function createExternalSelectionFromSelection(nextSelection: ViewerSelection | null): ViewerExternalSelection | null {
  if (!nextSelection || !isFiniteNumber(nextSelection.start) || !isFiniteNumber(nextSelection.end)) {
    return null
  }

  return {
    start: nextSelection.start,
    end: nextSelection.end,
    clockwise: nextSelection.clockwise,
  }
}

function setEditorMode(mode: DnaEditorMode) {
  editorMode.value = mode
}

function openRawEditor() {
  editorMode.value = "raw"
}

function openInteractiveEditor() {
  editorMode.value = "interactive"
}

async function focusActiveAnnotationEditor() {
  if (!activeAnnotation.value) {
    return
  }

  await nextTick()
  interactiveNameInputRef.value?.scrollIntoView({ block: "nearest" })
  interactiveNameInputRef.value?.focus()
  interactiveNameInputRef.value?.select()
}

function clearSelection() {
  selection.value = null
  viewerSelection.value = null
}

function sanitizeDownloadBaseName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, "_").replace(/[^A-Za-z0-9_.-]/g, "_")
  return normalized || "dna_sequence"
}

function downloadGenBank() {
  if (sequenceLength.value <= 0 || typeof document === "undefined" || typeof URL === "undefined") {
    return
  }

  const content = serializeDnaSequenceToGenBank(value.value, {
    name: value.value.name || props.varId,
  })
  const blob = new Blob([content], {
    type: "text/plain;charset=utf-8",
  })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = `${sanitizeDownloadBaseName(value.value.name || props.varId)}.gbk`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, 0)
}

function detectImportedTopology(text: string): "linear" | "circular" | null {
  const normalized = text.replace(/\r\n?/g, "\n")
  const locusLine = normalized.match(/(?:^|\n)LOCUS[^\n]*/i)?.[0]
  if (!locusLine) {
    return null
  }
  if (/\bcircular\b/i.test(locusLine)) {
    return "circular"
  }
  if (/\blinear\b/i.test(locusLine)) {
    return "linear"
  }
  return null
}

function stripFileExtension(value: string): string {
  return value.replace(/\.[^.]+$/, "")
}

function detectImportedName(text: string, fallbackName = ""): string {
  const normalized = text.replace(/\r\n?/g, "\n")
  const locusMatch = normalized.match(/(?:^|\n)LOCUS\s+([^\s]+)/i)
  if (locusMatch?.[1]) {
    return normalizeDnaSequenceName(locusMatch[1])
  }

  const fastaMatch = normalized.match(/^\s*>(.+)$/m)
  if (fastaMatch?.[1]) {
    return normalizeDnaSequenceName(fastaMatch[1])
  }

  return normalizeDnaSequenceName(fallbackName)
}

function normalizeImportedSequenceText(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n")
  const genBankMatch = normalized.match(/(?:^|\n)ORIGIN\b([\s\S]*?)(?:\n\/\/|\s*$)/i)
  if (genBankMatch?.[1]) {
    return genBankMatch[1].replace(/[^A-Za-z]/g, "").toUpperCase()
  }

  if (/^\s*>/m.test(normalized)) {
    return normalized
      .split("\n")
      .filter(line => !line.trimStart().startsWith(">"))
      .join("")
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase()
  }

  return normalized.replace(/[^A-Za-z]/g, "").toUpperCase()
}

function confirmImportReplacement(): boolean {
  if (sequenceLength.value <= 0 && value.value.annotations.length === 0) {
    return true
  }
  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    return true
  }
  return window.confirm(props.messages.dna.importReplaceConfirm)
}

function applyImportedSequenceText(rawText: string, fallbackName = ""): boolean {
  const nextSequence = normalizeImportedSequenceText(rawText)
  if (!nextSequence) {
    importErrorMessage.value = props.messages.dna.onboardingNoSequenceDetected
    return false
  }

  const invalid = collectInvalidDnaSequenceCharacters(nextSequence)
  if (invalid.length > 0) {
    importErrorMessage.value = props.messages.dna.invalidCharacters(invalid.join(", "))
    return false
  }

  if (!confirmImportReplacement()) {
    return false
  }

  const nextName = detectImportedName(rawText, fallbackName) || value.value.name
  commit({
    ...value.value,
    name: nextName,
    sequence: nextSequence,
    topology: detectImportedTopology(rawText) ?? value.value.topology,
    annotations: [],
  })
  interactiveSequenceDraft.value = ""
  importErrorMessage.value = null
  activeAnnotationId.value = null
  activeSegmentIndex.value = 0
  clearSelection()
  return true
}

function onInteractiveSequenceDraftInput(event: Event) {
  interactiveSequenceDraft.value = (event.target as HTMLTextAreaElement).value
  importErrorMessage.value = null
}

function applyInteractiveSequenceDraft() {
  applyImportedSequenceText(interactiveSequenceDraft.value)
}

function openImportPicker() {
  importFileInputRef.value?.click()
}

async function onImportChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ""
  if (!file) {
    return
  }

  try {
    const text = await file.text()
    applyImportedSequenceText(text, stripFileExtension(file.name))
  } catch {
    importErrorMessage.value = props.messages.dna.onboardingImportReadError
  }
}

function selectAnnotation(annotationId: string, segmentIndex = 0) {
  const annotation = value.value.annotations.find(item => item.id === annotationId)
  const segment = annotation?.segments[segmentIndex]
  if (!annotation || !segment) {
    return
  }

  activeAnnotationId.value = annotationId
  activeSegmentIndex.value = segmentIndex
  selection.value = {
    type: "ANNOTATION",
    id: buildViewerAnnotationId(annotationId, segmentIndex),
    name: annotation.name,
    start: Math.max(segment.start - 1, 0),
    end: segment.end,
    length: Math.max(segment.end - segment.start + 1, 0),
    direction: annotation.strand,
    viewer: value.value.topology === "circular" ? "CIRCULAR" : "LINEAR",
  }
  viewerSelection.value = createExternalSelectionFromSegment(segment)
}

function focusAnnotationInInteractive(annotationId: string, segmentIndex = 0) {
  selectAnnotation(annotationId, segmentIndex)
  openInteractiveEditor()
}

function handleAnnotationPrimaryAction(annotationId: string) {
  if (editorMode.value === "interactive") {
    focusAnnotationInInteractive(annotationId)
    return
  }

  selectAnnotation(annotationId)
}

function addAnnotation() {
  if (isInteractiveMode.value && selectionSegments.value.length > 0) {
    createAnnotationFromSelection()
    return
  }

  const nextId = getNextDnaSequenceAnnotationId(value.value.annotations)
  const annotation = createEmptyDnaSequenceAnnotation(nextId)

  if (sequenceLength.value > 0) {
    annotation.segments = [{
      start: 1,
      end: Math.min(sequenceLength.value, 1),
      partial_start: false,
      partial_end: false,
    }]
  }

  patchValue({
    annotations: [...value.value.annotations, annotation],
  })

  activeAnnotationId.value = annotation.id
  activeSegmentIndex.value = 0
}

function removeAnnotation(index: number) {
  const removed = value.value.annotations[index]
  patchValue({
    annotations: value.value.annotations.filter((_, annotationIndex) => annotationIndex !== index),
  })

  if (removed && activeAnnotationId.value === removed.id) {
    activeAnnotationId.value = null
    activeSegmentIndex.value = 0
    selection.value = null
    viewerSelection.value = null
  }
}

function addSegment(annotationIndex: number) {
  const annotation = value.value.annotations[annotationIndex]
  if (!annotation) return

  patchAnnotation(annotationIndex, {
    segments: [...annotation.segments, createEmptyDnaSequenceSegment()],
  })
}

function removeSegment(annotationIndex: number, segmentIndex: number) {
  const annotation = value.value.annotations[annotationIndex]
  if (!annotation) return

  const nextSegments = annotation.segments.length <= 1
    ? [createEmptyDnaSequenceSegment()]
    : annotation.segments.filter((_, currentIndex) => currentIndex !== segmentIndex)

  patchAnnotation(annotationIndex, { segments: nextSegments })

  if (annotation.id === activeAnnotationId.value) {
    activeSegmentIndex.value = Math.min(activeSegmentIndex.value, nextSegments.length - 1)
  }
}

function addQualifier(annotationIndex: number) {
  const annotation = value.value.annotations[annotationIndex]
  if (!annotation) return

  patchAnnotation(annotationIndex, {
    qualifiers: [
      ...annotation.qualifiers,
      createEmptyDnaSequenceQualifier(annotation.qualifiers.length === 0 ? "note" : "qualifier"),
    ],
  })
}

function removeQualifier(annotationIndex: number, qualifierIndex: number) {
  const annotation = value.value.annotations[annotationIndex]
  if (!annotation) return

  patchAnnotation(annotationIndex, {
    qualifiers: annotation.qualifiers.filter((_, currentIndex) => currentIndex !== qualifierIndex),
  })
}

function onSequenceInput(event: Event) {
  patchValue({ sequence: (event.target as HTMLTextAreaElement).value })
}

function onSegmentIntInput(
  annotationIndex: number,
  segmentIndex: number,
  key: "start" | "end",
  event: Event,
) {
  const raw = (event.target as HTMLInputElement).value
  const parsed = Number.parseInt(raw, 10)
  if (Number.isFinite(parsed) && parsed > 0) {
    patchSegment(annotationIndex, segmentIndex, { [key]: parsed } as Partial<AimdDnaSequenceSegment>)
  }
}

function segmentIssueLabel(segment: AimdDnaSequenceSegment): string | null {
  const issue = getDnaSequenceSegmentIssue(segment, sequenceLength.value)
  if (issue === "requires_sequence") {
    return props.messages.dna.segmentRequiresSequence
  }
  if (issue === "range") {
    return props.messages.dna.segmentRangeError
  }
  if (issue === "out_of_bounds") {
    return props.messages.dna.segmentOutOfBounds(segment.end, sequenceLength.value)
  }
  return null
}

function onViewerSelection(nextSelection: ViewerSelection) {
  const normalized = normalizeViewerSelection(nextSelection)
  selection.value = normalized
  viewerSelection.value = createExternalSelectionFromSelection(normalized)

  const parsedId = parseViewerAnnotationId(normalized?.id)
  if (parsedId) {
    activeAnnotationId.value = parsedId.annotationId
    activeSegmentIndex.value = parsedId.segmentIndex
  }
}

function createAnnotationFromSelection() {
  const segments = createSegmentsFromSelection(selection.value, value.value.topology, sequenceLength.value)
  if (segments.length === 0) {
    return
  }

  const nextId = getNextDnaSequenceAnnotationId(value.value.annotations)
  const annotation = createEmptyDnaSequenceAnnotation(nextId)
  annotation.strand = selection.value?.direction === -1 ? -1 : 1
  annotation.segments = segments

  patchValue({
    annotations: [...value.value.annotations, annotation],
  })

  activeAnnotationId.value = annotation.id
  activeSegmentIndex.value = 0
}

function applySelectionToActiveSegment() {
  const annotationIndex = value.value.annotations.findIndex(annotation => annotation.id === activeAnnotationId.value)
  if (annotationIndex < 0) {
    return
  }

  const annotation = value.value.annotations[annotationIndex]
  const segments = createSegmentsFromSelection(selection.value, value.value.topology, sequenceLength.value)
  if (!annotation || segments.length === 0) {
    return
  }

  const currentIndex = Math.min(activeSegmentIndex.value, annotation.segments.length - 1)
  const nextSegments = annotation.segments.flatMap((segment, index) =>
    index === currentIndex ? segments : [segment])

  patchAnnotation(annotationIndex, { segments: nextSegments })
  activeSegmentIndex.value = currentIndex
}

watch(() => value.value.annotations, annotations => {
  if (annotations.length === 0) {
    activeAnnotationId.value = null
    activeSegmentIndex.value = 0
    return
  }

  const activeAnnotation = annotations.find(annotation => annotation.id === activeAnnotationId.value)
  if (!activeAnnotation) {
    activeAnnotationId.value = annotations[0].id
    activeSegmentIndex.value = 0
    return
  }

  activeSegmentIndex.value = Math.min(activeSegmentIndex.value, activeAnnotation.segments.length - 1)
}, { deep: true, immediate: true })

watch(() => value.value.sequence, sequence => {
  if (sequence.length > 0) {
    interactiveSequenceDraft.value = ""
    importErrorMessage.value = null
  }
})

const isInteractiveMode = computed(() => editorMode.value === "interactive")
const hasInteractiveSequenceDraft = computed(() => interactiveSequenceDraft.value.trim().length > 0)

const activeAnnotationIndex = computed(() =>
  value.value.annotations.findIndex(annotation => annotation.id === activeAnnotationId.value))

const activeAnnotation = computed(() =>
  activeAnnotationIndex.value >= 0 ? value.value.annotations[activeAnnotationIndex.value] : null)

const viewerAnnotations = computed<ViewerAnnotation[]>(() => {
  const annotations: ViewerAnnotation[] = []
  const totalLength = sequenceLength.value

  for (const annotation of value.value.annotations) {
    annotation.segments.forEach((segment, segmentIndex) => {
      const start = Math.max(segment.start - 1, 0)
      const end = Math.min(segment.end, totalLength)
      if (totalLength <= 0 || end <= start) {
        return
      }

      annotations.push({
        id: buildViewerAnnotationId(annotation.id, segmentIndex),
        name: annotation.segments.length > 1
          ? `${annotation.name} ${segmentIndex + 1}/${annotation.segments.length}`
          : annotation.name,
        start,
        end,
        direction: annotation.strand,
        color: annotation.color,
      })
    })
  }

  return annotations
})

const selectionSegments = computed(() =>
  createSegmentsFromSelection(selection.value, value.value.topology, sequenceLength.value))

const selectionRangeLabel = computed(() => {
  if (selectionSegments.value.length === 0) {
    return ""
  }
  return props.messages.dna.selectionRange(selectionSegments.value.map(formatSegment).join(", "))
})

const selectionTargetLabel = computed(() => {
  if (!selection.value) {
    return ""
  }

  if (selection.value.type === "ANNOTATION" && selection.value.name) {
    return props.messages.dna.selectionTarget(selection.value.name)
  }

  return props.messages.dna.selectionTarget(props.messages.dna.selectionModeSequence)
})

const annotationPrimaryActionLabel = computed(() =>
  isInteractiveMode.value
    ? props.messages.dna.focusAnnotation
    : props.messages.dna.editAnnotation)
</script>

<template>
  <span class="aimd-rec-inline aimd-rec-inline--var-dna aimd-field-wrapper aimd-field-wrapper--dna">
    <span class="aimd-field aimd-field--no-style aimd-field__label">
      <span class="aimd-field__scope aimd-field__scope--var">{{ props.messages.scope.var }}</span>
      <span class="aimd-field__id">{{ props.varId }}</span>
    </span>

    <span class="aimd-dna-field">
      <span class="aimd-dna-field__toolbar">
        <label class="aimd-dna-field__toolbar-item aimd-dna-field__toolbar-item--mode">
          <span class="aimd-dna-field__toolbar-label">{{ props.messages.dna.editMode }}</span>
          <span class="aimd-dna-field__mode-switch" role="tablist" :aria-label="props.messages.dna.editMode">
            <button
              type="button"
              class="aimd-dna-field__mode-button"
              :class="{ 'aimd-dna-field__mode-button--active': editorMode === 'interactive' }"
              :disabled="props.disabled"
              @click="setEditorMode('interactive')"
            >
              {{ props.messages.dna.interactiveMode }}
            </button>
            <button
              type="button"
              class="aimd-dna-field__mode-button"
              :class="{ 'aimd-dna-field__mode-button--active': editorMode === 'raw' }"
              :disabled="props.disabled"
              @click="setEditorMode('raw')"
            >
              {{ props.messages.dna.rawMode }}
            </button>
          </span>
        </label>

        <label class="aimd-dna-field__toolbar-item">
          <span class="aimd-dna-field__toolbar-label">{{ props.messages.dna.topology }}</span>
          <select
            class="aimd-dna-field__select"
            :value="value.topology"
            :disabled="props.disabled"
            @change="patchValue({ topology: ($event.target as HTMLSelectElement).value === 'circular' ? 'circular' : 'linear' })"
            @blur="emit('blur')"
          >
            <option value="linear">{{ props.messages.dna.linear }}</option>
            <option value="circular">{{ props.messages.dna.circular }}</option>
          </select>
        </label>

        <span class="aimd-dna-field__stat">{{ props.messages.dna.length(sequenceLength) }}</span>
        <span class="aimd-dna-field__stat">
          {{ gcPercent === null ? props.messages.dna.gcUnavailable : props.messages.dna.gc(`${gcPercent.toFixed(1)}%`) }}
        </span>
        <span class="aimd-dna-field__toolbar-spacer" />
        <button
          type="button"
          class="aimd-dna-field__action aimd-dna-field__action--toolbar"
          :disabled="props.disabled"
          @click="openImportPicker"
        >
          {{ props.messages.dna.onboardingImportFile }}
        </button>
        <button
          type="button"
          class="aimd-dna-field__action aimd-dna-field__action--toolbar"
          :disabled="props.disabled || sequenceLength <= 0"
          @click="downloadGenBank"
        >
          {{ props.messages.dna.exportGenBank }}
        </button>
      </span>
      <input
        ref="importFileInputRef"
        class="aimd-dna-field__hidden-file"
        type="file"
        accept=".txt,.seq,.fa,.fna,.fasta,.gb,.gbk,text/plain"
        @change="onImportChange"
      >
      <span
        v-if="importErrorMessage && (!isInteractiveMode || sequenceLength > 0)"
        class="aimd-dna-field__hint aimd-dna-field__hint--error aimd-dna-field__hint--toolbar"
      >
        {{ importErrorMessage }}
      </span>

      <span class="aimd-dna-field__metadata-grid">
        <label class="aimd-dna-field__annotation-field aimd-dna-field__annotation-field--metadata">
          <span>{{ props.messages.dna.sequenceName }}</span>
          <input
            class="aimd-dna-field__input"
            :disabled="props.disabled"
            :placeholder="props.messages.dna.sequenceNamePlaceholder"
            :value="value.name"
            @input="patchValue({ name: ($event.target as HTMLInputElement).value })"
            @blur="emit('blur')"
          />
        </label>
      </span>

      <template v-if="isInteractiveMode">
        <span class="aimd-dna-field__section">
          <span class="aimd-dna-field__section-title">{{ props.messages.dna.viewer }}</span>

          <span v-if="sequenceLength <= 0" class="aimd-dna-field__empty">
            <span class="aimd-dna-field__selection-title">{{ props.messages.dna.viewerRequiresSequence }}</span>
            <label class="aimd-dna-field__annotation-field">
              <span>{{ props.messages.dna.onboardingPasteLabel }}</span>
              <textarea
                class="aimd-dna-field__sequence aimd-dna-field__sequence--onboarding"
                :disabled="props.disabled"
                :placeholder="props.placeholder || props.messages.dna.sequencePlaceholder"
                :value="interactiveSequenceDraft"
                spellcheck="false"
                @input="onInteractiveSequenceDraftInput"
              />
            </label>
            <span class="aimd-dna-field__hint">
              {{ props.messages.dna.onboardingImportHint }}
            </span>
            <span
              v-if="importErrorMessage"
              class="aimd-dna-field__hint aimd-dna-field__hint--error"
            >
              {{ importErrorMessage }}
            </span>
            <span class="aimd-dna-field__empty-actions">
              <button
                type="button"
                class="aimd-dna-field__action"
                :disabled="props.disabled || !hasInteractiveSequenceDraft"
                @click="applyInteractiveSequenceDraft"
              >
                {{ props.messages.dna.onboardingApplySequence }}
              </button>
              <button
                type="button"
                class="aimd-dna-field__action"
                :disabled="props.disabled"
                @click="openRawEditor"
              >
                {{ props.messages.dna.rawMode }}
              </button>
            </span>
          </span>

          <template v-else>
            <span class="aimd-dna-field__viewer-shell">
              <AimdSeqVizViewer
                :name="value.name || props.varId"
                :sequence="value.sequence"
                :topology="value.topology"
                :annotations="viewerAnnotations"
                :selection="viewerSelection"
                @selection="onViewerSelection"
              />
            </span>

            <span class="aimd-dna-field__hint">
              {{ props.messages.dna.viewerHint }}
            </span>

            <span
              class="aimd-dna-field__selection-card"
              :class="{ 'aimd-dna-field__selection-card--muted': selectionSegments.length === 0 }"
            >
              <span class="aimd-dna-field__selection-title">{{ props.messages.dna.selection }}</span>

              <template v-if="selectionSegments.length > 0">
                <span class="aimd-dna-field__selection-meta">{{ selectionRangeLabel }}</span>
                <span class="aimd-dna-field__selection-meta">{{ selectionTargetLabel }}</span>
                <span class="aimd-dna-field__selection-actions">
                  <button
                    type="button"
                    class="aimd-dna-field__action"
                    :disabled="props.disabled"
                    @click="createAnnotationFromSelection"
                  >
                    {{ props.messages.dna.createFromSelection }}
                  </button>
                  <button
                    type="button"
                    class="aimd-dna-field__action"
                    :disabled="props.disabled || !activeAnnotation"
                    @click="applySelectionToActiveSegment"
                  >
                    {{ props.messages.dna.applySelectionToSegment }}
                  </button>
                  <button
                    v-if="selection?.type === 'ANNOTATION' && activeAnnotation"
                    type="button"
                    class="aimd-dna-field__action"
                    :disabled="props.disabled"
                    @click="focusActiveAnnotationEditor"
                  >
                    {{ props.messages.dna.editAnnotation }}
                  </button>
                  <button
                    type="button"
                    class="aimd-dna-field__action"
                    :disabled="props.disabled"
                    @click="clearSelection"
                  >
                    {{ props.messages.dna.selectionClear }}
                  </button>
                </span>
              </template>

              <span v-else class="aimd-dna-field__selection-meta">
                {{ props.messages.dna.selectionEmpty }}
              </span>
            </span>
          </template>
        </span>
      </template>

      <template v-else>
        <span class="aimd-dna-field__section">
          <span class="aimd-dna-field__section-title">{{ props.messages.dna.sequence }}</span>
          <textarea
            class="aimd-dna-field__sequence"
            :disabled="props.disabled"
            :placeholder="props.placeholder || props.messages.dna.sequencePlaceholder"
            :value="value.sequence"
            spellcheck="false"
            @input="onSequenceInput"
            @blur="emit('blur')"
          />
          <span
            v-if="invalidCharacters.length"
            class="aimd-dna-field__hint aimd-dna-field__hint--error"
          >
            {{ props.messages.dna.invalidCharacters(invalidCharacters.join(', ')) }}
          </span>
          <span v-else class="aimd-dna-field__hint">
            {{ props.messages.dna.iupacHint }}
          </span>
        </span>
      </template>

      <template v-if="isInteractiveMode && sequenceLength > 0">
        <span class="aimd-dna-field__section">
          <span class="aimd-dna-field__section-header">
            <span class="aimd-dna-field__section-title">{{ props.messages.dna.interactiveDetails }}</span>
            <span v-if="activeAnnotation" class="aimd-dna-field__section-meta">
              {{ props.messages.dna.selectedAnnotation(activeAnnotation.name) }}
            </span>
            <button
              type="button"
              class="aimd-dna-field__action"
              :disabled="props.disabled"
              @click="openRawEditor"
            >
              {{ props.messages.dna.rawMode }}
            </button>
          </span>

          <span class="aimd-dna-field__hint">
            {{ props.messages.dna.interactiveDetailsHint }}
          </span>

          <span v-if="!activeAnnotation" class="aimd-dna-field__empty">
            {{ props.messages.dna.interactiveDetailsEmpty }}
          </span>

          <template v-else>
            <span class="aimd-dna-field__annotation-grid">
              <label class="aimd-dna-field__annotation-field">
                <span>{{ props.messages.dna.annotationName }}</span>
                <input
                  ref="interactiveNameInputRef"
                  class="aimd-dna-field__input"
                  :disabled="props.disabled"
                  :value="activeAnnotation.name"
                  @input="patchAnnotation(activeAnnotationIndex, { name: ($event.target as HTMLInputElement).value })"
                  @blur="emit('blur')"
                />
              </label>

              <label class="aimd-dna-field__annotation-field">
                <span>{{ props.messages.dna.annotationType }}</span>
                <input
                  class="aimd-dna-field__input"
                  :disabled="props.disabled"
                  :value="activeAnnotation.type"
                  @input="patchAnnotation(activeAnnotationIndex, { type: ($event.target as HTMLInputElement).value })"
                  @blur="emit('blur')"
                />
              </label>

              <label class="aimd-dna-field__annotation-field">
                <span>{{ props.messages.dna.strand }}</span>
                <select
                  class="aimd-dna-field__select"
                  :disabled="props.disabled"
                  :value="activeAnnotation.strand"
                  @change="patchAnnotation(activeAnnotationIndex, { strand: ($event.target as HTMLSelectElement).value === '-1' ? -1 : 1 })"
                  @blur="emit('blur')"
                >
                  <option :value="1">{{ props.messages.dna.forward }}</option>
                  <option :value="-1">{{ props.messages.dna.reverse }}</option>
                </select>
              </label>

              <label class="aimd-dna-field__annotation-field">
                <span>{{ props.messages.dna.color }}</span>
                <input
                  class="aimd-dna-field__input aimd-dna-field__input--color"
                  type="color"
                  :disabled="props.disabled"
                  :value="activeAnnotation.color || '#2563eb'"
                  @input="patchAnnotation(activeAnnotationIndex, { color: ($event.target as HTMLInputElement).value })"
                  @blur="emit('blur')"
                />
              </label>
            </span>

            <span class="aimd-dna-field__meta-pills">
              <span class="aimd-dna-field__meta-pill">
                {{ props.messages.dna.segments }}: {{ annotationSegmentsLabel(activeAnnotation) }}
              </span>
              <span class="aimd-dna-field__meta-pill">
                {{ props.messages.dna.qualifiers }}: {{ activeAnnotation.qualifiers.length }}
              </span>
            </span>

            <span class="aimd-dna-field__row-actions">
              <button
                type="button"
                class="aimd-dna-field__action aimd-dna-field__action--danger"
                :disabled="props.disabled"
                @click="removeAnnotation(activeAnnotationIndex)"
              >
                {{ props.messages.dna.removeAnnotation }}
              </button>
            </span>
          </template>
        </span>
      </template>

      <template v-else>
        <span class="aimd-dna-field__section">
          <span class="aimd-dna-field__section-header">
            <span class="aimd-dna-field__section-title">{{ props.messages.dna.annotations }}</span>
            <button
              type="button"
              class="aimd-dna-field__action"
              :disabled="props.disabled"
              @click="addAnnotation"
            >
              {{ props.messages.dna.addAnnotation }}
            </button>
          </span>

          <span v-if="value.annotations.length === 0" class="aimd-dna-field__empty">
            {{ props.messages.dna.noAnnotations }}
          </span>

          <span v-else class="aimd-dna-field__annotation-list">
            <span
              v-for="(annotation, annotationIndex) in value.annotations"
              :key="annotation.id"
              class="aimd-dna-field__annotation-card"
              :class="{ 'aimd-dna-field__annotation-card--active': annotation.id === activeAnnotationId }"
            >
              <span class="aimd-dna-field__annotation-card-main">
                <span
                  class="aimd-dna-field__annotation-swatch"
                  :style="{ backgroundColor: annotation.color || '#2563eb' }"
                />
                <span class="aimd-dna-field__annotation-copy">
                  <span class="aimd-dna-field__annotation-name">{{ annotation.name }}</span>
                  <span class="aimd-dna-field__annotation-meta">{{ annotation.type }}</span>
                  <span class="aimd-dna-field__annotation-meta">
                    {{ props.messages.dna.segments }}: {{ annotationSegmentsLabel(annotation) }}
                  </span>
                </span>
              </span>

              <span class="aimd-dna-field__annotation-actions">
                <button
                  type="button"
                  class="aimd-dna-field__action"
                  :disabled="props.disabled"
                  @click="handleAnnotationPrimaryAction(annotation.id)"
                >
                  {{ annotationPrimaryActionLabel }}
                </button>
                <button
                  type="button"
                  class="aimd-dna-field__action aimd-dna-field__action--danger"
                  :disabled="props.disabled"
                  @click="removeAnnotation(annotationIndex)"
                >
                  {{ props.messages.dna.removeAnnotation }}
                </button>
              </span>
            </span>
          </span>
        </span>

        <span class="aimd-dna-field__section">
          <span class="aimd-dna-field__section-header">
            <span class="aimd-dna-field__section-title">{{ props.messages.dna.advancedEditor }}</span>
            <span v-if="activeAnnotation" class="aimd-dna-field__section-meta">
              {{ props.messages.dna.selectedAnnotation(activeAnnotation.name) }}
            </span>
          </span>

          <span class="aimd-dna-field__advanced-copy">
            {{ props.messages.dna.advancedEditorHint }}
          </span>

          <span v-if="!activeAnnotation" class="aimd-dna-field__empty">
            {{ props.messages.dna.advancedEditorEmpty }}
          </span>

          <template v-else>
            <span class="aimd-dna-field__annotation-grid">
              <label class="aimd-dna-field__annotation-field">
                <span>{{ props.messages.dna.annotationName }}</span>
                <input
                  class="aimd-dna-field__input"
                  :disabled="props.disabled"
                  :value="activeAnnotation.name"
                  @input="patchAnnotation(activeAnnotationIndex, { name: ($event.target as HTMLInputElement).value })"
                  @blur="emit('blur')"
                />
              </label>

              <label class="aimd-dna-field__annotation-field">
                <span>{{ props.messages.dna.annotationType }}</span>
                <input
                  class="aimd-dna-field__input"
                  :disabled="props.disabled"
                  :value="activeAnnotation.type"
                  @input="patchAnnotation(activeAnnotationIndex, { type: ($event.target as HTMLInputElement).value })"
                  @blur="emit('blur')"
                />
              </label>

              <label class="aimd-dna-field__annotation-field">
                <span>{{ props.messages.dna.strand }}</span>
                <select
                  class="aimd-dna-field__select"
                  :disabled="props.disabled"
                  :value="activeAnnotation.strand"
                  @change="patchAnnotation(activeAnnotationIndex, { strand: ($event.target as HTMLSelectElement).value === '-1' ? -1 : 1 })"
                  @blur="emit('blur')"
                >
                  <option :value="1">{{ props.messages.dna.forward }}</option>
                  <option :value="-1">{{ props.messages.dna.reverse }}</option>
                </select>
              </label>

              <label class="aimd-dna-field__annotation-field">
                <span>{{ props.messages.dna.color }}</span>
                <input
                  class="aimd-dna-field__input aimd-dna-field__input--color"
                  type="color"
                  :disabled="props.disabled"
                  :value="activeAnnotation.color || '#2563eb'"
                  @input="patchAnnotation(activeAnnotationIndex, { color: ($event.target as HTMLInputElement).value })"
                  @blur="emit('blur')"
                />
              </label>
            </span>

            <span class="aimd-dna-field__subsection">
              <span class="aimd-dna-field__subsection-header">
                <span class="aimd-dna-field__subsection-title">{{ props.messages.dna.segments }}</span>
                <button
                  type="button"
                  class="aimd-dna-field__action"
                  :disabled="props.disabled"
                  @click="addSegment(activeAnnotationIndex)"
                >
                  {{ props.messages.dna.addSegment }}
                </button>
              </span>

              <span
                v-for="(segment, segmentIndex) in activeAnnotation.segments"
                :key="`${activeAnnotation.id}-segment-${segmentIndex}`"
                class="aimd-dna-field__row-card"
                :class="{ 'aimd-dna-field__row-card--active': segmentIndex === activeSegmentIndex }"
              >
                <span class="aimd-dna-field__segment-grid">
                  <label class="aimd-dna-field__annotation-field">
                    <span>{{ props.messages.dna.start }}</span>
                    <input
                      class="aimd-dna-field__input"
                      type="number"
                      min="1"
                      :disabled="props.disabled"
                      :value="segment.start"
                      @input="onSegmentIntInput(activeAnnotationIndex, segmentIndex, 'start', $event)"
                      @blur="emit('blur')"
                    />
                  </label>

                  <label class="aimd-dna-field__annotation-field">
                    <span>{{ props.messages.dna.end }}</span>
                    <input
                      class="aimd-dna-field__input"
                      type="number"
                      min="1"
                      :disabled="props.disabled"
                      :value="segment.end"
                      @input="onSegmentIntInput(activeAnnotationIndex, segmentIndex, 'end', $event)"
                      @blur="emit('blur')"
                    />
                  </label>

                  <label class="aimd-dna-field__toggle">
                    <input
                      type="checkbox"
                      :checked="!!segment.partial_start"
                      :disabled="props.disabled"
                      @change="patchSegment(activeAnnotationIndex, segmentIndex, { partial_start: ($event.target as HTMLInputElement).checked })"
                      @blur="emit('blur')"
                    />
                    <span>{{ props.messages.dna.partialStart }}</span>
                  </label>

                  <label class="aimd-dna-field__toggle">
                    <input
                      type="checkbox"
                      :checked="!!segment.partial_end"
                      :disabled="props.disabled"
                      @change="patchSegment(activeAnnotationIndex, segmentIndex, { partial_end: ($event.target as HTMLInputElement).checked })"
                      @blur="emit('blur')"
                    />
                    <span>{{ props.messages.dna.partialEnd }}</span>
                  </label>
                </span>

                <span
                  v-if="segmentIssueLabel(segment)"
                  class="aimd-dna-field__hint aimd-dna-field__hint--error"
                >
                  {{ segmentIssueLabel(segment) }}
                </span>

                <span class="aimd-dna-field__row-actions">
                  <button
                    type="button"
                    class="aimd-dna-field__action"
                    :disabled="props.disabled"
                    @click="focusAnnotationInInteractive(activeAnnotation.id, segmentIndex)"
                  >
                    {{ props.messages.dna.focusAnnotation }}
                  </button>
                  <button
                    type="button"
                    class="aimd-dna-field__action aimd-dna-field__action--danger"
                    :disabled="props.disabled"
                    @click="removeSegment(activeAnnotationIndex, segmentIndex)"
                  >
                    {{ props.messages.dna.removeSegment }}
                  </button>
                </span>
              </span>
            </span>

            <span class="aimd-dna-field__subsection">
              <span class="aimd-dna-field__subsection-header">
                <span class="aimd-dna-field__subsection-title">{{ props.messages.dna.qualifiers }}</span>
                <button
                  type="button"
                  class="aimd-dna-field__action"
                  :disabled="props.disabled"
                  @click="addQualifier(activeAnnotationIndex)"
                >
                  {{ props.messages.dna.addQualifier }}
                </button>
              </span>

              <span v-if="activeAnnotation.qualifiers.length === 0" class="aimd-dna-field__empty">
                {{ props.messages.dna.noQualifiers }}
              </span>

              <span
                v-for="(qualifier, qualifierIndex) in activeAnnotation.qualifiers"
                :key="`${activeAnnotation.id}-qualifier-${qualifierIndex}`"
                class="aimd-dna-field__row-card"
              >
                <span class="aimd-dna-field__qualifier-grid">
                  <label class="aimd-dna-field__annotation-field">
                    <span>{{ props.messages.dna.qualifierKey }}</span>
                    <input
                      class="aimd-dna-field__input"
                      :disabled="props.disabled"
                      :value="qualifier.key"
                      @input="patchQualifier(activeAnnotationIndex, qualifierIndex, { key: ($event.target as HTMLInputElement).value })"
                      @blur="emit('blur')"
                    />
                  </label>

                  <label class="aimd-dna-field__annotation-field aimd-dna-field__annotation-field--wide">
                    <span>{{ props.messages.dna.qualifierValue }}</span>
                    <input
                      class="aimd-dna-field__input"
                      :disabled="props.disabled"
                      :value="qualifier.value"
                      @input="patchQualifier(activeAnnotationIndex, qualifierIndex, { value: ($event.target as HTMLInputElement).value })"
                      @blur="emit('blur')"
                    />
                  </label>
                </span>

                <span class="aimd-dna-field__row-actions">
                  <button
                    type="button"
                    class="aimd-dna-field__action aimd-dna-field__action--danger"
                    :disabled="props.disabled"
                    @click="removeQualifier(activeAnnotationIndex, qualifierIndex)"
                  >
                    {{ props.messages.dna.removeQualifier }}
                  </button>
                </span>
              </span>
            </span>
          </template>
        </span>
      </template>
    </span>
  </span>
</template>

<style scoped>
.aimd-rec-inline--var-dna {
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  width: min(100%, 920px);
  min-width: min(100%, 340px);
  margin: 8px 4px;
  vertical-align: top;
  border: 1px solid var(--aimd-border-color, #90caf9);
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}

.aimd-rec-inline--var-dna:focus-within {
  border-color: var(--aimd-border-color-focus, #4181fd);
  box-shadow: 0 0 0 2px rgba(65, 129, 253, 0.14);
}

.aimd-rec-inline--var-dna > .aimd-field--no-style.aimd-field__label {
  align-self: stretch;
  width: calc(100% + 2px);
  border: none;
  border-bottom: 1px solid var(--aimd-border-color, #90caf9);
  border-radius: 10px 10px 0 0;
  min-height: 30px;
  background: var(--aimd-var-bg, #e3f2fd);
  margin: -1px -1px 0 -1px;
  box-sizing: border-box;
}

.aimd-rec-inline--var-dna > .aimd-field--no-style.aimd-field__label .aimd-field__scope {
  align-self: center;
  height: 22px;
  margin-left: 3px;
  padding: 0 7px;
  border-radius: 6px;
}

.aimd-rec-inline--var-dna > .aimd-field--no-style.aimd-field__label .aimd-field__id {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  padding: 0 10px 0 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--aimd-var-text, #1565c0);
  white-space: nowrap;
}

.aimd-dna-field {
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  gap: 14px;
  padding: 12px;
  background: #fff;
}

.aimd-dna-field__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.aimd-dna-field__hint--toolbar {
  margin-top: -4px;
}

.aimd-dna-field__metadata-grid {
  display: grid;
  grid-template-columns: minmax(220px, 420px);
}

.aimd-dna-field__toolbar-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.aimd-dna-field__toolbar-spacer {
  flex: 1 1 auto;
}

.aimd-dna-field__toolbar-item--mode {
  margin-right: 8px;
}

.aimd-dna-field__toolbar-label {
  font-size: 12px;
  font-weight: 600;
  color: #3b5b86;
}

.aimd-dna-field__mode-switch {
  display: inline-flex;
  padding: 3px;
  border-radius: 999px;
  background: #edf4ff;
  border: 1px solid #cdddf6;
}

.aimd-dna-field__mode-button {
  height: 30px;
  padding: 0 12px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #476788;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.aimd-dna-field__mode-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.aimd-dna-field__mode-button--active {
  background: #fff;
  color: #245eb0;
  box-shadow: 0 1px 2px rgba(37, 94, 176, 0.18);
}

.aimd-dna-field__stat,
.aimd-dna-field__meta-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  background: #edf4ff;
  color: #35517c;
  font-size: 12px;
  font-weight: 600;
}

.aimd-dna-field__section,
.aimd-dna-field__subsection {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.aimd-dna-field__section-header,
.aimd-dna-field__subsection-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.aimd-dna-field__section-title {
  font-size: 13px;
  font-weight: 700;
  color: #25466c;
}

.aimd-dna-field__section-meta,
.aimd-dna-field__subsection-title {
  font-size: 12px;
  font-weight: 700;
  color: #41618b;
}

.aimd-dna-field__sequence {
  min-height: 124px;
  padding: 10px 12px;
  border: 1px solid #c8d7eb;
  border-radius: 8px;
  background: #fdfefe;
  color: #19324d;
  font: 600 13px/1.6 "SFMono-Regular", Menlo, Consolas, monospace;
  resize: vertical;
}

.aimd-dna-field__sequence--onboarding {
  min-height: 96px;
}

.aimd-dna-field__viewer-shell {
  overflow: hidden;
  border: 1px solid #d7e4f4;
  border-radius: 12px;
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 30%),
    linear-gradient(180deg, #fcfdff 0%, #f5f9ff 100%);
}

.aimd-dna-field__selection-card,
.aimd-dna-field__annotation-card,
.aimd-dna-field__row-card,
.aimd-dna-field__empty {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid #d7e4f4;
  background: #fbfdff;
}

.aimd-dna-field__selection-card--muted {
  background: #fcfdff;
}

.aimd-dna-field__selection-title {
  font-size: 12px;
  font-weight: 700;
  color: #35517c;
}

.aimd-dna-field__selection-meta,
.aimd-dna-field__advanced-copy,
.aimd-dna-field__hint {
  font-size: 12px;
  color: #4c6b8c;
}

.aimd-dna-field__selection-actions,
.aimd-dna-field__annotation-actions,
.aimd-dna-field__row-actions,
.aimd-dna-field__empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.aimd-dna-field__annotation-list {
  display: grid;
  gap: 10px;
}

.aimd-dna-field__annotation-card {
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.aimd-dna-field__annotation-card--active,
.aimd-dna-field__row-card--active {
  border-color: #97bbff;
  box-shadow: 0 0 0 2px rgba(65, 129, 253, 0.08);
}

.aimd-dna-field__annotation-card-main {
  display: flex;
  min-width: 0;
  gap: 10px;
}

.aimd-dna-field__annotation-swatch {
  width: 10px;
  min-width: 10px;
  align-self: stretch;
  border-radius: 999px;
}

.aimd-dna-field__annotation-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.aimd-dna-field__annotation-name {
  font-size: 13px;
  font-weight: 700;
  color: #1f3d63;
}

.aimd-dna-field__annotation-meta {
  font-size: 12px;
  color: #5e7897;
}

.aimd-dna-field__annotation-grid,
.aimd-dna-field__segment-grid,
.aimd-dna-field__qualifier-grid {
  display: grid;
  gap: 10px;
}

.aimd-dna-field__annotation-grid {
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.aimd-dna-field__segment-grid {
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
}

.aimd-dna-field__qualifier-grid {
  grid-template-columns: minmax(140px, 220px) minmax(180px, 1fr);
}

.aimd-dna-field__annotation-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: #486683;
  font-weight: 600;
}

.aimd-dna-field__annotation-field--wide {
  min-width: 0;
}

.aimd-dna-field__annotation-field--metadata {
  min-width: 0;
}

.aimd-dna-field__input,
.aimd-dna-field__select {
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid #c8d7eb;
  border-radius: 8px;
  background: #fff;
  color: #1e3854;
  font-size: 13px;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.aimd-dna-field__input--color {
  padding: 4px;
}

.aimd-dna-field__sequence:focus,
.aimd-dna-field__input:focus,
.aimd-dna-field__select:focus {
  outline: none;
  border-color: #5d92f8;
  box-shadow: 0 0 0 2px rgba(93, 146, 248, 0.14);
}

.aimd-dna-field__toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: #eef5ff;
  color: #35517c;
  font-size: 12px;
  font-weight: 600;
}

.aimd-dna-field__toggle input {
  margin: 0;
}

.aimd-dna-field__hint--error {
  color: #c0392b;
}

.aimd-dna-field__hidden-file {
  display: none;
}

.aimd-dna-field__meta-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.aimd-dna-field__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  padding: 0 10px;
  border: 1px solid #b6cdf5;
  border-radius: 999px;
  background: #edf4ff;
  color: #2b61b7;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.aimd-dna-field__action:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.aimd-dna-field__action--danger {
  border-color: #efc4c4;
  background: #fff5f5;
  color: #c0392b;
}

.aimd-dna-field__action--toolbar {
  flex: 0 0 auto;
}

@media (max-width: 640px) {
  .aimd-rec-inline--var-dna {
    min-width: 100%;
    width: 100%;
  }

  .aimd-dna-field__toolbar {
    align-items: flex-start;
  }

  .aimd-dna-field__annotation-card {
    flex-direction: column;
  }

  .aimd-dna-field__qualifier-grid {
    grid-template-columns: 1fr;
  }
}
</style>
