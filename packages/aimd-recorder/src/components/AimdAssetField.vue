<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"

const props = withDefaults(defineProps<{
  modelValue?: unknown
  varId: string
  title?: string
  description?: string
  typeLabel?: string
  accept?: string
  previewMode?: "image" | "video" | "audio" | "document" | "download"
  resolveSrc?: ((src: string) => string | null) | undefined
  disabled?: boolean
}>(), {
  modelValue: undefined,
  title: undefined,
  description: undefined,
  typeLabel: undefined,
  accept: "",
  previewMode: "download",
  resolveSrc: undefined,
  disabled: false,
})

const emit = defineEmits<{
  (e: "update:modelValue", value: RecorderAssetValue | null): void
  (e: "blur"): void
}>()

interface RecorderAssetValue {
  src: string
  name: string
  mimeType: string | null
  size: number | null
  lastModified: number | null
}

const fileInput = ref<HTMLInputElement | null>(null)
const localObjectUrl = ref<string | null>(null)
const previewError = ref(false)
const previewLoading = ref(false)

function guessNameFromSrc(src: string): string {
  const normalized = src.split("?")[0]?.split("#")[0] ?? src
  const segment = normalized.split("/").filter(Boolean).pop()
  return segment || "asset"
}

function guessMimeType(src: string): string | null {
  const normalized = src.toLowerCase()
  if (/\.(png|jpg|jpeg|gif|webp|svg|bmp|avif|tif|tiff)$/.test(normalized)) return "image/*"
  if (/\.(mp4|mov|m4v|webm|ogv)$/.test(normalized)) return "video/*"
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/.test(normalized)) return "audio/*"
  if (/\.(pdf|doc|docx|ppt|pptx|xls|xlsx|csv|tsv|txt)$/.test(normalized)) return "application/octet-stream"
  return null
}

function normalizeAssetValue(value: unknown): RecorderAssetValue | null {
  if (!value) return null

  if (typeof value === "string") {
    const src = value.trim()
    if (!src) return null
    return {
      src,
      name: guessNameFromSrc(src),
      mimeType: guessMimeType(src),
      size: null,
      lastModified: null,
    }
  }

  if (typeof value !== "object") return null

  const candidate = value as Record<string, unknown>
  const srcValue = candidate.src ?? candidate.url ?? candidate.path ?? candidate.href
  const src = typeof srcValue === "string" ? srcValue.trim() : ""
  if (!src) return null

  const nameValue = candidate.name ?? candidate.fileName ?? candidate.filename
  const mimeTypeValue = candidate.mimeType ?? candidate.type
  const sizeValue = candidate.size
  const lastModifiedValue = candidate.lastModified

  return {
    src,
    name: typeof nameValue === "string" && nameValue.trim() ? nameValue.trim() : guessNameFromSrc(src),
    mimeType: typeof mimeTypeValue === "string" && mimeTypeValue.trim() ? mimeTypeValue.trim() : guessMimeType(src),
    size: typeof sizeValue === "number" ? sizeValue : null,
    lastModified: typeof lastModifiedValue === "number" ? lastModifiedValue : null,
  }
}

function revokeLocalObjectUrl() {
  if (!localObjectUrl.value) return
  URL.revokeObjectURL(localObjectUrl.value)
  localObjectUrl.value = null
}

const asset = computed(() => normalizeAssetValue(props.modelValue))
const displayTitle = computed(() => props.title || props.varId)
const hasAsset = computed(() => Boolean(asset.value?.src))
const resolvedAssetSrc = computed(() => {
  const src = asset.value?.src?.trim()
  if (!src) return ""
  return props.resolveSrc?.(src) ?? src
})

const resolvedPreviewMode = computed(() => {
  const explicit = props.previewMode
  if (explicit && explicit !== "download") {
    return explicit
  }

  const mimeType = asset.value?.mimeType?.toLowerCase() ?? ""
  const src = asset.value?.src?.toLowerCase() ?? ""

  if (mimeType.startsWith("image/")) return "image"
  if (mimeType.startsWith("video/")) return "video"
  if (mimeType.startsWith("audio/")) return "audio"
  if (mimeType.includes("pdf")) return "document"
  if (/\.(png|jpg|jpeg|gif|webp|svg|bmp|avif|tif|tiff)$/.test(src)) return "image"
  if (/\.(mp4|mov|m4v|webm|ogv)$/.test(src)) return "video"
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/.test(src)) return "audio"
  if (/\.(pdf|doc|docx|ppt|pptx|xls|xlsx|csv|tsv|txt)$/.test(src)) return "document"

  return "download"
})

const displayType = computed(() => {
  const raw = (props.typeLabel || "FileId").replace(/^FileId/i, "")
  return raw ? raw.toUpperCase() : "FILE"
})

const typeHint = computed(() => {
  const accept = props.accept?.trim()
  if (!accept) return displayType.value
  return `${displayType.value} (${accept})`
})

watch(
  () => asset.value?.src ?? null,
  (nextSrc) => {
    if (localObjectUrl.value && nextSrc !== localObjectUrl.value) {
      revokeLocalObjectUrl()
    }
  },
)

watch(
  () => [resolvedAssetSrc.value, resolvedPreviewMode.value],
  () => {
    previewError.value = false
    previewLoading.value = Boolean(resolvedAssetSrc.value)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  revokeLocalObjectUrl()
})

function triggerPicker() {
  if (props.disabled) return
  fileInput.value?.click()
}

function emitBlur() {
  emit("blur")
}

function clearValue() {
  revokeLocalObjectUrl()
  emit("update:modelValue", null)
  emitBlur()
  if (fileInput.value) {
    fileInput.value.value = ""
  }
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  revokeLocalObjectUrl()
  const src = URL.createObjectURL(file)
  localObjectUrl.value = src

  emit("update:modelValue", {
    src,
    name: file.name,
    mimeType: file.type || guessMimeType(file.name),
    size: file.size,
    lastModified: file.lastModified,
  })
  emitBlur()
}

function handlePreviewError() {
  previewError.value = true
  previewLoading.value = false
}

function handlePreviewLoad() {
  previewError.value = false
  previewLoading.value = false
}
</script>

<template>
  <div
    class="aimd-rec-inline aimd-field-wrapper aimd-asset-field"
    :class="{ 'aimd-asset-field--filled': hasAsset, 'aimd-asset-field--empty': !hasAsset }"
  >
    <input
      ref="fileInput"
      class="aimd-asset-field__input"
      type="file"
      :accept="accept || undefined"
      :disabled="disabled"
      @change="handleFileChange"
      @blur="emitBlur"
    >

    <div v-if="hasAsset" class="aimd-asset-field__card">
      <div class="aimd-asset-field__header">
        <div class="aimd-asset-field__header-info">
          <span class="aimd-asset-field__badge">{{ displayType }}</span>
          <div class="aimd-asset-field__meta">
            <strong>{{ asset?.name || displayTitle }}</strong>
            <span>{{ asset?.mimeType || typeHint }}</span>
          </div>
        </div>

        <div v-if="!disabled" class="aimd-asset-field__actions">
          <button type="button" class="aimd-asset-field__icon-btn" @click="triggerPicker" title="Replace file" aria-label="Replace file">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14" aria-hidden="true">
              <path d="M4 4v5h.582"></path>
              <path d="M20 11a8 8 0 0 0-15.418-2"></path>
              <path d="M20 20v-5h-.581"></path>
              <path d="M4 13a8 8 0 0 0 15.357 2"></path>
            </svg>
          </button>
          <button
            type="button"
            class="aimd-asset-field__icon-btn aimd-asset-field__icon-btn--ghost"
            @click="clearValue"
            title="Remove file"
            aria-label="Remove file"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14" aria-hidden="true">
              <path d="M3 6h18"></path>
              <path d="M8 6V4h8v2"></path>
              <path d="M19 6l-1 14H6L5 6"></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="aimd-asset-field__content">
        <div v-if="(resolvedPreviewMode === 'image' || resolvedPreviewMode === 'video' || resolvedPreviewMode === 'audio' || resolvedPreviewMode === 'document') && previewError" class="aimd-asset-field__preview-unavailable">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="32" height="32" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2"></rect>
            <path d="M8 8h.01"></path>
            <path d="M21 15l-5-5L5 21"></path>
          </svg>
          <span class="aimd-asset-field__unavailable-text">Preview unavailable</span>
          <span class="aimd-asset-field__unavailable-hint">{{ displayType }} preview could not be loaded</span>
        </div>

        <div v-else-if="resolvedPreviewMode === 'image'" class="aimd-asset-field__preview">
          <img
            class="aimd-asset-field__media aimd-asset-field__media--image"
            :src="resolvedAssetSrc"
            :alt="asset?.name || 'Image asset preview'"
            :class="{ 'aimd-asset-field__media--loading': previewLoading }"
            @error="handlePreviewError"
            @load="handlePreviewLoad"
          >
        </div>

        <div v-else-if="resolvedPreviewMode === 'video'" class="aimd-asset-field__preview">
          <video
            class="aimd-asset-field__media aimd-asset-field__media--video"
            :src="resolvedAssetSrc"
            controls
            preload="metadata"
            @error="handlePreviewError"
            @loadeddata="handlePreviewLoad"
          />
        </div>

        <div v-else-if="resolvedPreviewMode === 'audio'" class="aimd-asset-field__preview aimd-asset-field__preview--audio">
          <audio
            class="aimd-asset-field__media aimd-asset-field__media--audio"
            :src="resolvedAssetSrc"
            controls
            preload="metadata"
            @error="handlePreviewError"
            @loadeddata="handlePreviewLoad"
          />
        </div>

        <div v-else-if="resolvedPreviewMode === 'document'" class="aimd-asset-field__preview">
          <iframe
            class="aimd-asset-field__media aimd-asset-field__media--document"
            :src="resolvedAssetSrc"
            title="Document preview"
            @error="handlePreviewError"
            @load="handlePreviewLoad"
          />
        </div>

        <div v-else class="aimd-asset-field__placeholder aimd-asset-field__placeholder--file">
          <strong>{{ asset?.name || "Attached file" }}</strong>
          <span>{{ asset?.mimeType || typeHint }}</span>
          <a class="aimd-asset-field__link" :href="resolvedAssetSrc" target="_blank" rel="noreferrer">Open file</a>
        </div>
      </div>
    </div>

    <button
      v-else
      type="button"
      class="aimd-asset-field__trigger"
      :disabled="disabled"
      :title="description || displayTitle"
      @click="triggerPicker"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18" aria-hidden="true">
        <path d="M12 16V4"></path>
        <path d="M7 9l5-5 5 5"></path>
        <path d="M5 19h14"></path>
      </svg>
      <span class="aimd-asset-field__trigger-text">{{ displayTitle || "Upload file" }}</span>
      <span class="aimd-asset-field__trigger-hint">{{ typeHint }}</span>
    </button>

    <span class="aimd-var-tooltip" role="note">
      <span v-if="title" class="aimd-var-tooltip__title">{{ title }}</span>
      <span class="aimd-var-tooltip__type">{{ typeLabel || "FileId" }}</span>
      <span v-if="description" class="aimd-var-tooltip__description">{{ description }}</span>
      <span class="aimd-var-tooltip__meta">{{ varId }}</span>
    </span>
  </div>
</template>

<style scoped>
.aimd-asset-field {
  width: 100%;
  max-width: 100%;
}

.aimd-asset-field__card {
  position: relative;
  display: grid;
  gap: 0;
  overflow: hidden;
  border: 1px solid rgba(202, 213, 226, 0.72);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 252, 255, 0.98) 100%);
  transition:
    border-color 0.18s ease,
    box-shadow 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}

.aimd-asset-field__card:hover {
  border-color: rgba(150, 180, 223, 0.88);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
  transform: translateY(-1px);
}

.aimd-asset-field__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 9px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.72);
  background: rgba(246, 249, 253, 0.88);
}

.aimd-asset-field__header-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.aimd-asset-field__badge {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 2px 5px;
  border-radius: 4px;
  background: #dbeafe;
  color: #215ea8;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.03em;
}

.aimd-asset-field__meta {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.aimd-asset-field__meta strong {
  color: #1f2937;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.aimd-asset-field__meta span {
  color: #8a97ab;
  font-size: 10px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.aimd-asset-field__actions {
  display: flex;
  gap: 4px;
}

.aimd-asset-field__icon-btn {
  appearance: none;
  border: 0 none;
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 4px;
  background: transparent;
  color: #5f6f86;
  cursor: pointer;
  transition: background-color 0.16s ease, color 0.16s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.aimd-asset-field__icon-btn:hover {
  background: rgba(226, 232, 240, 0.78);
  color: #1f2937;
}

.aimd-asset-field__icon-btn--ghost:hover {
  background: rgba(254, 226, 226, 0.8);
  color: #b91c1c;
}

.aimd-asset-field__input {
  display: none;
}

.aimd-asset-field__content {
  padding: 8px;
}

.aimd-asset-field__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 112px;
  border: 1px solid rgba(230, 236, 244, 0.9);
  border-radius: 6px;
  background:
    linear-gradient(180deg, rgba(248, 251, 255, 0.94) 0%, rgba(244, 248, 252, 0.92) 100%);
  overflow: hidden;
  transition: border-color 0.18s ease, background-color 0.18s ease;
}

.aimd-asset-field__card:hover .aimd-asset-field__preview {
  border-color: rgba(196, 209, 228, 0.96);
  background: linear-gradient(180deg, rgba(250, 252, 255, 0.96) 0%, rgba(244, 248, 252, 0.94) 100%);
}

.aimd-asset-field__preview-unavailable {
  display: flex;
  min-height: 112px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 18px 16px;
  border: 1px dashed rgba(245, 158, 11, 0.34);
  border-radius: 6px;
  background: linear-gradient(145deg, rgba(255, 251, 235, 0.96), rgba(248, 250, 252, 0.92));
  text-align: center;
}

.aimd-asset-field__preview-unavailable svg {
  color: #d97706;
  opacity: 0.72;
}

.aimd-asset-field__unavailable-text {
  color: #92400e;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.3;
}

.aimd-asset-field__unavailable-hint {
  color: #7c6a56;
  font-size: 11px;
  line-height: 1.4;
}

.aimd-asset-field__preview--audio {
  padding: 8px;
}

.aimd-asset-field__media {
  display: block;
  max-width: 100%;
}

.aimd-asset-field__media--image,
.aimd-asset-field__media--video,
.aimd-asset-field__media--document {
  width: 100%;
  max-height: 240px;
  object-fit: contain;
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease;
}

.aimd-asset-field__media--loading {
  opacity: 0.56;
}

.aimd-asset-field__card:hover .aimd-asset-field__media--image {
  transform: scale(1.018);
}

.aimd-asset-field__media--audio {
  width: 100%;
}

.aimd-asset-field__placeholder {
  display: grid;
  gap: 5px;
  align-items: center;
  justify-items: center;
  min-height: 108px;
  padding: 18px 16px;
  border: 1px solid rgba(230, 236, 244, 0.9);
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(248, 251, 255, 0.94) 0%, rgba(244, 248, 252, 0.92) 100%);
  text-align: center;
}

.aimd-asset-field__placeholder--file {
  justify-items: flex-start;
  min-height: 0;
  text-align: left;
}

.aimd-asset-field__placeholder strong {
  color: #334155;
  font-size: 12px;
  font-weight: 700;
}

.aimd-asset-field__placeholder span,
.aimd-asset-field__link {
  color: #64748b;
  font-size: 11px;
  line-height: 1.45;
}

.aimd-asset-field__link {
  text-decoration: none;
}

.aimd-asset-field__trigger {
  display: flex;
  width: 100%;
  min-height: 52px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 14px 16px;
  border: 1px dashed rgba(156, 171, 189, 0.84);
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.98) 100%);
  color: #64748b;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease;
}

.aimd-asset-field__trigger:hover {
  border-color: rgba(96, 165, 250, 0.82);
  background: #f8fbff;
  color: #245ea7;
}

.aimd-asset-field__trigger-text {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
}

.aimd-asset-field__trigger-hint {
  font-size: 11px;
  line-height: 1.25;
  opacity: 0.82;
}

@media (max-width: 640px) {
  .aimd-asset-field {
    width: 100%;
  }

  .aimd-asset-field__header {
    flex-direction: column;
    align-items: stretch;
  }

  .aimd-asset-field__actions {
    justify-content: flex-start;
  }
}
</style>
