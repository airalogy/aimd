import { extractAssignerFieldSummary } from '@airalogy/aimd-renderer'

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
      const summary = extractAssignerFieldSummary(body)

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
