export type AimdSourceBlockKind = 'code' | 'assigner'
export type AimdSourceBlockTone = 'neutral' | 'client' | 'server'

export interface AimdSourceBlock {
  kind: AimdSourceBlockKind
  tone: AimdSourceBlockTone
  language: string
  startLineNumber: number
  endLineNumber: number
  runtime?: 'client' | 'server'
  dependentFields: string[]
  assignedFields: string[]
}

const CLIENT_ASSIGNER_FENCE = /^\s*(```|~~~)\s*assigner(?:\s+.*\bruntime\s*=\s*(?:"client"|'client'|client)\b.*)\s*$/
const SERVER_ASSIGNER_FENCE = /^\s*(```|~~~)\s*assigner(?:\s+.*)?\s*$/
const GENERIC_CODE_FENCE = /^\s*(```|~~~)\s*((?:\w|[/#-])+)(?:\s+.*)?\s*$/
const EMPTY_CODE_FENCE = /^\s*(```|~~~)\s*$/

const LANGUAGE_LABELS: Record<string, string> = {
  text: "Text",
  plaintext: "Plain Text",
  shell: "Shell",
  bash: "Bash",
  zsh: "Zsh",
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  json: "JSON",
  yaml: "YAML",
  toml: "TOML",
  ini: "INI",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  less: "Less",
  xml: "XML",
}

const LANGUAGE_BADGES: Record<string, string> = {
  text: "TXT",
  plaintext: "TXT",
  shell: "SH",
  bash: "SH",
  zsh: "SH",
  javascript: "JS",
  typescript: "TS",
  python: "PY",
  json: "JSON",
  yaml: "YAML",
  toml: "TOML",
  ini: "INI",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  less: "LESS",
  xml: "XML",
}

function normalizeCodeLanguage(value: string | null | undefined): string {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized || 'text'
}

function uniqueStrings(values: string[]): string[] {
  const normalized = values
    .map(value => value.trim())
    .filter(Boolean)

  return [...new Set(normalized)]
}

function extractQuotedValues(source: string, fieldName: string): string[] {
  const match = source.match(new RegExp(`${fieldName}\\s*[:=]\\s*\\[([\\s\\S]*?)\\]`, 'm'))
  if (!match) {
    return []
  }

  const values: string[] = []
  const quotedValuePattern = /["'`]([^"'`]+)["'`]/g
  let quotedMatch: RegExpExecArray | null = null
  while ((quotedMatch = quotedValuePattern.exec(match[1])) !== null) {
    values.push(quotedMatch[1])
  }

  return uniqueStrings(values)
}

function extractReturnedObjectKeys(source: string): string[] {
  const match = source.match(/return\s*\{([\s\S]*?)\}/m)
  if (!match) {
    return []
  }

  const keys: string[] = []
  const keyPattern = /(?:^|[,{]\s*)(['"`]?)([A-Za-z_][\w.-]*)\1\s*:/gm
  let keyMatch: RegExpExecArray | null = null
  while ((keyMatch = keyPattern.exec(match[1])) !== null) {
    keys.push(keyMatch[2])
  }

  return uniqueStrings(keys)
}

export function extractSourceAssignerFieldSummary(source: string): {
  dependentFields: string[]
  assignedFields: string[]
} {
  const dependentFields = extractQuotedValues(source, 'dependent_fields')
  const assignedFields = uniqueStrings([
    ...extractQuotedValues(source, 'assigned_fields'),
    ...extractReturnedObjectKeys(source),
  ])

  return {
    dependentFields,
    assignedFields,
  }
}

export function resolveSourceCodeLanguageLabel(value: string | null | undefined): string {
  const normalized = normalizeCodeLanguage(value)
  return LANGUAGE_LABELS[normalized] ?? normalized.replace(/[-_]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

export function resolveSourceCodeLanguageBadge(value: string | null | undefined): string {
  const normalized = normalizeCodeLanguage(value)
  return LANGUAGE_BADGES[normalized] ?? normalized.slice(0, 6).toUpperCase()
}

function findFenceEnd(lines: string[], startIndex: number, fenceMarker: string): number {
  const escapedFence = fenceMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const fencePattern = new RegExp(`^\\s*${escapedFence}\\s*$`)

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (fencePattern.test(lines[index])) {
      return index
    }
  }

  return lines.length - 1
}

export function parseAimdSourceBlocks(content: string): AimdSourceBlock[] {
  const lines = content.split(/\r?\n/)
  const blocks: AimdSourceBlock[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const clientMatch = line.match(CLIENT_ASSIGNER_FENCE)
    const serverMatch = !clientMatch ? line.match(SERVER_ASSIGNER_FENCE) : null
    const genericMatch = !clientMatch && !serverMatch ? line.match(GENERIC_CODE_FENCE) : null
    const emptyMatch = !clientMatch && !serverMatch && !genericMatch ? line.match(EMPTY_CODE_FENCE) : null

    if (!clientMatch && !serverMatch && !genericMatch && !emptyMatch) {
      continue
    }

    const fenceMarker = clientMatch?.[1] || serverMatch?.[1] || genericMatch?.[1] || emptyMatch?.[1] || '```'
    const endIndex = findFenceEnd(lines, index, fenceMarker)
    const body = lines.slice(index + 1, endIndex).join('\n')

    if (clientMatch || serverMatch) {
      const runtime = clientMatch ? 'client' : 'server'
      const summary = extractSourceAssignerFieldSummary(body)

      blocks.push({
        kind: 'assigner',
        tone: runtime,
        language: runtime === 'client' ? 'javascript' : 'python',
        startLineNumber: index + 1,
        endLineNumber: endIndex + 1,
        runtime,
        dependentFields: summary.dependentFields,
        assignedFields: summary.assignedFields,
      })

      index = endIndex
      continue
    }

    const rawLanguage = genericMatch?.[2]?.trim() || 'text'
    blocks.push({
      kind: 'code',
      tone: 'neutral',
      language: rawLanguage || 'text',
      startLineNumber: index + 1,
      endLineNumber: endIndex + 1,
      dependentFields: [],
      assignedFields: [],
    })
    index = endIndex
  }

  return blocks
}
