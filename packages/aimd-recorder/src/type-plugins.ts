import { defineAsyncComponent, h } from 'vue'
import { BUILT_IN_CODE_STR_TYPES } from './code-types'
import { normalizeDnaSequenceValue } from './composables/useDnaSequence'
import { normalizeAimdTypeName } from './type-utils'
import type { AimdTypePlugin } from './types'

const AimdDnaSequenceField = defineAsyncComponent(() => import('./components/AimdDnaSequenceField.vue'))
const AimdMarkdownField = defineAsyncComponent(() => import('./components/AimdMarkdownField.vue'))
const AimdAssetField = defineAsyncComponent(() => import('./components/AimdAssetField.vue'))
const BUILT_IN_CODE_STR_TYPE_PLUGINS: AimdTypePlugin[] = BUILT_IN_CODE_STR_TYPES.map(type => ({
  type,
  inputKind: 'code' as const,
}))

const BUILT_IN_FILE_ID_TYPE_ALIASES = [
  'FileId',
  'FileIdPNG',
  'FileIdJPG',
  'FileIdJPEG',
  'FileIdTIFF',
  'FileIdTIF',
  'FileIdGIF',
  'FileIdWEBP',
  'FileIdSVG',
  'FileIdPDF',
  'FileIdCSV',
  'FileIdTSV',
  'FileIdTXT',
  'FileIdMP4',
  'FileIdMOV',
  'FileIdWEBM',
  'FileIdMP3',
  'FileIdWAV',
]

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function formatTimezoneOffset(date: Date): string {
  const totalMinutes = -date.getTimezoneOffset()
  const sign = totalMinutes >= 0 ? '+' : '-'
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

function resolveNowDate(now: Date | string | number | undefined): Date {
  if (now instanceof Date) {
    return Number.isNaN(now.getTime()) ? new Date() : now
  }

  if (typeof now === 'string' || typeof now === 'number') {
    const parsed = new Date(now)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return new Date()
}

function getVarTitle(node: { definition?: { kwargs?: Record<string, unknown> } }): string | undefined {
  const title = node.definition?.kwargs?.title
  return typeof title === 'string' && title.trim() ? title.trim() : undefined
}

function getVarDescription(node: { definition?: { kwargs?: Record<string, unknown> } }): string | undefined {
  const description = node.definition?.kwargs?.description
  return typeof description === 'string' && description.trim() ? description.trim() : undefined
}

function getFileTypeAccept(type: string | undefined): string {
  const normalized = normalizeAimdTypeName(type)
  if (normalized.endsWith('png')) return '.png,image/png'
  if (normalized.endsWith('jpg') || normalized.endsWith('jpeg')) return '.jpg,.jpeg,image/jpeg'
  if (normalized.endsWith('tiff') || normalized.endsWith('tif')) return '.tif,.tiff,image/tiff'
  if (normalized.endsWith('gif')) return '.gif,image/gif'
  if (normalized.endsWith('webp')) return '.webp,image/webp'
  if (normalized.endsWith('svg')) return '.svg,image/svg+xml'
  if (normalized.endsWith('pdf')) return '.pdf,application/pdf'
  if (normalized.endsWith('csv')) return '.csv,text/csv'
  if (normalized.endsWith('tsv')) return '.tsv,text/tab-separated-values,text/plain'
  if (normalized.endsWith('txt')) return '.txt,text/plain'
  if (normalized.endsWith('mp4')) return '.mp4,video/mp4'
  if (normalized.endsWith('mov')) return '.mov,video/quicktime'
  if (normalized.endsWith('webm')) return '.webm,video/webm'
  if (normalized.endsWith('mp3')) return '.mp3,audio/mpeg,audio/mp3'
  if (normalized.endsWith('wav')) return '.wav,audio/wav'
  return ''
}

function getFileTypePreviewMode(type: string | undefined): 'image' | 'video' | 'audio' | 'document' | 'download' {
  const normalized = normalizeAimdTypeName(type)
  if (
    normalized.endsWith('png')
    || normalized.endsWith('jpg')
    || normalized.endsWith('jpeg')
    || normalized.endsWith('tiff')
    || normalized.endsWith('tif')
    || normalized.endsWith('gif')
    || normalized.endsWith('webp')
    || normalized.endsWith('svg')
  ) {
    return 'image'
  }
  if (normalized.endsWith('mp4') || normalized.endsWith('mov') || normalized.endsWith('webm')) {
    return 'video'
  }
  if (normalized.endsWith('mp3') || normalized.endsWith('wav')) {
    return 'audio'
  }
  if (normalized.endsWith('pdf')) {
    return 'document'
  }
  return 'download'
}

export const BUILT_IN_AIMD_TYPE_PLUGINS: AimdTypePlugin[] = [
  ...BUILT_IN_CODE_STR_TYPE_PLUGINS,
  {
    type: 'CurrentTime',
    inputKind: 'datetime',
    getInitialValue: ({ now }) => formatDateTimeWithTimezone(resolveNowDate(now)),
  },
  {
    type: 'UserName',
    getInitialValue: ({ currentUserName }) => currentUserName ?? '',
  },
  {
    type: 'AiralogyMarkdown',
    inputKind: 'textarea',
    renderField: ({
      node,
      value,
      disabled,
      locale,
      messages,
      extraClasses,
      emitChange,
      emitBlur,
    }) => h(AimdMarkdownField, {
      class: extraClasses,
      varId: node.id,
      modelValue: value,
      disabled,
      locale,
      messages,
      'onUpdate:modelValue': (nextValue: string) => emitChange(nextValue),
      onBlur: emitBlur,
    }),
  },
  {
    type: 'DNASequence',
    inputKind: 'dna',
    getInitialValue: () => normalizeDnaSequenceValue(undefined),
    normalizeValue: ({ value }) => normalizeDnaSequenceValue(value),
    renderField: ({
      node,
      value,
      disabled,
      placeholder,
      messages,
      extraClasses,
      emitChange,
      emitBlur,
    }) => h(AimdDnaSequenceField, {
      class: extraClasses,
      varId: node.id,
      modelValue: value,
      disabled,
      placeholder,
      messages,
      'onUpdate:modelValue': (nextValue: unknown) => emitChange(nextValue),
      onBlur: emitBlur,
    }),
  },
  {
    type: 'FileId',
    aliases: BUILT_IN_FILE_ID_TYPE_ALIASES,
    inputKind: 'text',
    renderField: ({
      type,
      node,
      value,
      disabled,
      resolveFile,
      extraClasses,
      emitChange,
      emitBlur,
    }) => h(AimdAssetField, {
      class: ['aimd-rec-inline--var', ...extraClasses],
      varId: node.id,
      title: getVarTitle(node),
      description: getVarDescription(node),
      typeLabel: type || 'FileId',
      modelValue: value,
      accept: getFileTypeAccept(type),
      previewMode: getFileTypePreviewMode(type),
      resolveSrc: resolveFile,
      disabled,
      'onUpdate:modelValue': (nextValue: unknown) => emitChange(nextValue),
      onBlur: emitBlur,
    }),
  },
]

export function resolveAimdTypePlugin(
  type: string | undefined,
  typePlugins: AimdTypePlugin[] | undefined,
): AimdTypePlugin | undefined {
  if (!typePlugins?.length) {
    return undefined
  }

  const normalizedType = normalizeAimdTypeName(type)
  return typePlugins.find((plugin) => {
    if (normalizeAimdTypeName(plugin.type) === normalizedType) {
      return true
    }

    return (plugin.aliases ?? []).some(alias => normalizeAimdTypeName(alias) === normalizedType)
  })
}

export function createAimdTypePlugins(typePlugins?: AimdTypePlugin[]): AimdTypePlugin[] {
  return [...(typePlugins ?? []), ...BUILT_IN_AIMD_TYPE_PLUGINS]
}
