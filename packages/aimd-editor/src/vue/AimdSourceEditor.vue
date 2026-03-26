<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import type { AimdEditorMessages } from './locales'
import { ensureMonacoEnvironment } from './monaco-environment'
import {
  parseAimdSourceBlocks,
  resolveSourceCodeLanguageBadge,
  resolveSourceCodeLanguageLabel,
  type AimdSourceBlock,
} from './source-blocks'

const props = defineProps<{
  content: string
  theme: string
  minHeight: number
  readonly: boolean
  monacoOptions: Record<string, any>
  resolvedMessages: AimdEditorMessages
}>()

const emit = defineEmits<{
  (e: 'content-change', value: string): void
  (e: 'ready', editor: any): void
  (e: 'monaco-loaded', monaco: any, editor: any): void
}>()

const CLIENT_ASSIGNER_FENCE = /^\s*(```|~~~)\s*assigner(?:\s+.*\bruntime\s*=\s*(?:"client"|'client'|client)\b.*)\s*$/
const SERVER_ASSIGNER_FENCE = /^\s*(```|~~~)\s*assigner(?:\s+.*)?\s*$/
const QUIZ_FENCE = /^\s*(```|~~~)\s*quiz(?:\s+.*)?\s*$/
const GENERIC_CODE_FENCE = /^\s*(```|~~~)\s*((?:\w|[/#-])+)(?:\s+.*)?\s*$/
const EMPTY_CODE_FENCE = /^\s*(```|~~~)\s*$/

const editorContainer = ref<HTMLElement | null>(null)

let monacoEditorInstance: any = null
let monacoModule: any = null
let isSyncing = false
const loading = ref(true)
let sourceBlockDecorationCollection: any = null
let sourceBlockZoneIds: string[] = []
let sourceBlockUpdateFrame: number | null = null

function createFenceSnippet(
  header: string,
  bodyLines: string[],
) {
  return [header, ...bodyLines, '```'].join('\n')
}

function buildSourceBlockTitle(block: AimdSourceBlock): string {
  if (block.kind === 'assigner') {
    return block.runtime === 'client'
      ? props.resolvedMessages.sourceBlocks.clientAssigner
      : props.resolvedMessages.sourceBlocks.serverAssigner
  }

  return resolveSourceCodeLanguageLabel(block.language)
}

function buildSourceBlockMeta(block: AimdSourceBlock): string {
  if (block.kind === 'assigner') {
    return props.resolvedMessages.sourceBlocks.calculationLogic
  }

  return props.resolvedMessages.sourceBlocks.codeBlock
}

function createSourceBlockZoneNode(block: AimdSourceBlock): HTMLElement {
  const zone = document.createElement('div')
  zone.className = `aimd-source-block-zone aimd-source-block-zone--${block.tone} aimd-source-block-zone--${block.kind}`

  const header = document.createElement('div')
  header.className = 'aimd-source-block-zone__header'

  const titleWrap = document.createElement('div')
  titleWrap.className = 'aimd-source-block-zone__title-wrap'

  const title = document.createElement('div')
  title.className = 'aimd-source-block-zone__title'
  title.textContent = buildSourceBlockTitle(block)

  const meta = document.createElement('div')
  meta.className = 'aimd-source-block-zone__meta'
  meta.textContent = buildSourceBlockMeta(block)

  titleWrap.append(title, meta)

  const badge = document.createElement('span')
  badge.className = 'aimd-source-block-zone__badge'
  badge.textContent = resolveSourceCodeLanguageBadge(block.language)

  header.append(titleWrap, badge)
  zone.append(header)

  if (block.kind === 'assigner' && (block.dependentFields.length > 0 || block.assignedFields.length > 0)) {
    const flow = document.createElement('div')
    flow.className = 'aimd-source-block-zone__flow'

    const appendGroup = (label: string, values: string[]) => {
      if (values.length === 0) {
        return
      }

      const group = document.createElement('div')
      group.className = 'aimd-source-block-zone__group'

      const groupLabel = document.createElement('span')
      groupLabel.className = 'aimd-source-block-zone__group-label'
      groupLabel.textContent = label
      group.append(groupLabel)

      for (const value of values) {
        const chip = document.createElement('span')
        chip.className = 'aimd-source-block-zone__chip'
        chip.textContent = value
        group.append(chip)
      }

      flow.append(group)
    }

    appendGroup(props.resolvedMessages.sourceBlocks.reads, block.dependentFields)

    if (block.dependentFields.length > 0 || block.assignedFields.length > 0) {
      const arrow = document.createElement('span')
      arrow.className = 'aimd-source-block-zone__arrow'
      arrow.textContent = '→ ƒ →'
      flow.append(arrow)
    }

    appendGroup(props.resolvedMessages.sourceBlocks.writes, block.assignedFields)
    zone.append(flow)
  }

  return zone
}

function clearSourceBlockChrome() {
  if (sourceBlockDecorationCollection?.clear) {
    sourceBlockDecorationCollection.clear()
  }

  if (monacoEditorInstance) {
    monacoEditorInstance.changeViewZones((accessor: any) => {
      for (const zoneId of sourceBlockZoneIds) {
        accessor.removeZone(zoneId)
      }
    })
  }

  sourceBlockZoneIds = []
}

function updateSourceBlockChrome() {
  if (!monacoEditorInstance || !monacoModule) {
    return
  }

  const model = monacoEditorInstance.getModel()
  if (!model) {
    return
  }

  const blocks = parseAimdSourceBlocks(model.getValue())
  const decorations: any[] = []

  for (const block of blocks) {
    decorations.push({
      range: new monacoModule.Range(block.startLineNumber, 1, block.startLineNumber, 1),
      options: {
        isWholeLine: true,
        className: `aimd-source-fence aimd-source-fence--open aimd-source-fence--${block.tone}`,
        linesDecorationsClassName: `aimd-source-fence-gutter aimd-source-fence-gutter--${block.tone}`,
      },
    })

    if (block.endLineNumber - block.startLineNumber > 1) {
      decorations.push({
        range: new monacoModule.Range(block.startLineNumber + 1, 1, block.endLineNumber - 1, 1),
        options: {
          isWholeLine: true,
          className: `aimd-source-fence aimd-source-fence--body aimd-source-fence--${block.tone}`,
          linesDecorationsClassName: `aimd-source-fence-gutter aimd-source-fence-gutter--${block.tone}`,
        },
      })
    }

    if (block.endLineNumber > block.startLineNumber) {
      decorations.push({
        range: new monacoModule.Range(block.endLineNumber, 1, block.endLineNumber, 1),
        options: {
          isWholeLine: true,
          className: `aimd-source-fence aimd-source-fence--close aimd-source-fence--${block.tone}`,
          linesDecorationsClassName: `aimd-source-fence-gutter aimd-source-fence-gutter--${block.tone}`,
        },
      })
    }
  }

  if (!sourceBlockDecorationCollection && typeof monacoEditorInstance.createDecorationsCollection === 'function') {
    sourceBlockDecorationCollection = monacoEditorInstance.createDecorationsCollection([])
  }

  if (sourceBlockDecorationCollection?.set) {
    sourceBlockDecorationCollection.set(decorations)
  }

  monacoEditorInstance.changeViewZones((accessor: any) => {
    for (const zoneId of sourceBlockZoneIds) {
      accessor.removeZone(zoneId)
    }
    sourceBlockZoneIds = []

    for (const block of blocks) {
      const zoneId = accessor.addZone({
        afterLineNumber: Math.max(block.startLineNumber - 1, 0),
        heightInPx: block.kind === 'assigner' && (block.dependentFields.length > 0 || block.assignedFields.length > 0) ? 54 : 34,
        domNode: createSourceBlockZoneNode(block),
      })
      sourceBlockZoneIds.push(zoneId)
    }
  })
}

function scheduleSourceBlockChromeUpdate() {
  if (sourceBlockUpdateFrame !== null) {
    cancelAnimationFrame(sourceBlockUpdateFrame)
  }

  sourceBlockUpdateFrame = requestAnimationFrame(() => {
    sourceBlockUpdateFrame = null
    updateSourceBlockChrome()
  })
}

function registerAimdLanguage(monaco: any) {
  const messages = props.resolvedMessages
  const langs = monaco.languages.getLanguages()
  if (langs.some((l: any) => l.id === 'aimd')) return

  monaco.languages.register({
    id: 'aimd',
    extensions: ['.aimd'],
    aliases: ['AIMD', 'aimd'],
    mimetypes: ['text/x-aimd'],
  })

  monaco.languages.setLanguageConfiguration('aimd', {
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '`', close: '`' },
      { open: '{{', close: '}}' },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '`', close: '`' },
    ],
  })

  monaco.languages.setMonarchTokensProvider('aimd', {
    defaultToken: '',
    tokenPostfix: '.aimd',
    tokenizer: {
      root: [
        [/\{\{/, { token: 'delimiter.bracket.aimd', next: '@aimdField' }],
        [/^#{1,6}\s.*$/, 'keyword.md'],
        [QUIZ_FENCE, { token: 'string.code', next: '@embeddedCodeblock', nextEmbedded: 'yaml' }],
        [CLIENT_ASSIGNER_FENCE, { token: 'string.code', next: '@embeddedCodeblock', nextEmbedded: 'javascript' }],
        [SERVER_ASSIGNER_FENCE, { token: 'string.code', next: '@embeddedCodeblock', nextEmbedded: 'python' }],
        [GENERIC_CODE_FENCE, { token: 'string.code', next: '@embeddedCodeblock', nextEmbedded: '$2' }],
        [EMPTY_CODE_FENCE, { token: 'string.code', next: '@codeblock' }],
        [/`[^`]+`/, 'string.code'],
        [/\*\*[^*]+\*\*/, 'strong'],
        [/__[^_]+__/, 'strong'],
        [/\*[^*]+\*/, 'emphasis'],
        [/_[^_]+_/, 'emphasis'],
        [/\[[^\]]+\]\([^)]+\)/, 'string.link'],
        [/!\[[^\]]*\]\([^)]+\)/, 'string.link'],
        [/^>.*$/, 'comment.quote'],
        [/^\s*[-*+]\s/, 'keyword.list'],
        [/^\s*\d+\.\s/, 'keyword.list'],
        [/^[-*_]{3,}\s*$/, 'keyword.hr'],
        [/<\/?[\w-][^>]*>/, 'tag'],
      ],
      aimdField: [
        [/\}\}/, { token: 'delimiter.bracket.aimd', next: '@pop' }],
        [/\b(var_table|var|step|check|ref_step|ref_var|ref_fig|cite)\b/, 'keyword.aimd'],
        [/\|/, 'delimiter.aimd'],
        [/:/, 'delimiter'],
        [/\b(str|int|float|bool|list|dict|any)\b/, 'type.aimd'],
        [/\b[A-Z][A-Za-z0-9_]*(?:\[[A-Za-z0-9_,\s]+\])?\b/, 'type.aimd'],
        [/[[\]()]/, 'delimiter.bracket'],
        [/=/, 'delimiter'],
        [/"[^"]*"/, 'string'],
        [/'[^']*'/, 'string'],
        [/-?\d+\.?\d*/, 'number'],
        [/\b(true|false|True|False|null|None)\b/, 'constant'],
        [/\bsubvars\b/, 'keyword'],
        [/,/, 'delimiter'],
        [/[A-Za-z_]\w*/, 'variable.aimd'],
        [/\s+/, ''],
      ],
      codeblock: [
        [/^```\s*$/, { token: 'string.code', next: '@pop' }],
        [/^~~~\s*$/, { token: 'string.code', next: '@pop' }],
        [/.*$/, 'string.code'],
      ],
      embeddedCodeblock: [
        [/^```\s*$/, { token: 'string.code', next: '@pop', nextEmbedded: '@pop' }],
        [/^~~~\s*$/, { token: 'string.code', next: '@pop', nextEmbedded: '@pop' }],
        [/.*$/, ''],
      ],
    },
  } as any)

  monaco.languages.registerCompletionItemProvider('aimd', {
    provideCompletionItems: () => {
      const inlineKeywords = ['var', 'var_table', 'step', 'check', 'ref_step', 'ref_var', 'ref_fig', 'cite']
      const placeholderByKeyword: Record<string, string> = {
        var: 'var_id',
        var_table: 'table_id',
        step: 'step_id',
        check: 'check_id',
        ref_step: 'step_id',
        ref_var: 'var_id',
        ref_fig: 'fig_id',
        cite: 'ref_id',
      }
      const suggestions = inlineKeywords.map(keyword => ({
        label: `{{${keyword}|}}`,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: `{{${keyword}|\${1:${placeholderByKeyword[keyword] ?? 'id'}}}}`,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: messages.completions.insertAimdField(keyword),
      }))
      suggestions.push({
        label: messages.completions.quizBlockLabel,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: [
          '```quiz',
          'id: ${1:quiz_choice_1}',
          'type: choice',
          'mode: single',
          'stem: |',
          `  \${2:${messages.defaults.questionStem}}`,
          'options:',
          '  - key: A',
          `    text: ${messages.defaults.optionText('A')}`,
          '  - key: B',
          `    text: ${messages.defaults.optionText('B')}`,
          'answer: A',
          '```',
        ].join('\n'),
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: messages.completions.quizBlock,
      } as any)
      suggestions.push({
        label: messages.completions.clientAssignerLabel,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: createFenceSnippet('```assigner runtime=client', [
          'assigner(',
          '  {',
          '    mode: "auto",',
          '    dependent_fields: ["${1:input_field}"],',
          '    assigned_fields: ["${2:output_field}"],',
          '  },',
          '  function ${3:calculate_output}({ ${1:input_field} }) {',
          '    return {',
          '      ${2:output_field}: ${4:${1:input_field}},',
          '    };',
          '  }',
          ');',
        ]),
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: messages.completions.clientAssigner,
      } as any)
      suggestions.push({
        label: messages.completions.pythonCodeFenceLabel,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: createFenceSnippet('```python', ['${1:result = run_analysis()}']),
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: messages.completions.pythonCodeFence,
      } as any)
      suggestions.push({
        label: messages.completions.jsonCodeFenceLabel,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: createFenceSnippet('```json', ['{', '  "${1:key}": "${2:value}"', '}']),
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: messages.completions.jsonCodeFence,
      } as any)
      suggestions.push({
        label: messages.completions.yamlCodeFenceLabel,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: createFenceSnippet('```yaml', ['${1:key}: ${2:value}']),
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: messages.completions.yamlCodeFence,
      } as any)
      return { suggestions } as any
    },
  })

  monaco.editor.defineTheme('aimd-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'delimiter.bracket.aimd', foreground: '2563eb' },
      { token: 'keyword.aimd', foreground: '2563eb', fontStyle: 'bold' },
      { token: 'delimiter.aimd', foreground: '6b7280' },
      { token: 'type.aimd', foreground: '7c3aed' },
      { token: 'variable.aimd', foreground: '059669' },
      { token: 'keyword.md', foreground: '1e40af' },
      { token: 'string.code', foreground: 'be185d' },
      { token: 'strong', fontStyle: 'bold' },
      { token: 'emphasis', fontStyle: 'italic' },
      { token: 'string.link', foreground: '2563eb' },
      { token: 'comment.quote', foreground: '6b7280', fontStyle: 'italic' },
    ],
    colors: {},
  })

  monaco.editor.defineTheme('aimd-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'delimiter.bracket.aimd', foreground: '60a5fa' },
      { token: 'keyword.aimd', foreground: '60a5fa', fontStyle: 'bold' },
      { token: 'delimiter.aimd', foreground: '9ca3af' },
      { token: 'type.aimd', foreground: 'a78bfa' },
      { token: 'variable.aimd', foreground: '34d399' },
      { token: 'keyword.md', foreground: '93c5fd' },
      { token: 'string.code', foreground: 'f472b6' },
      { token: 'strong', fontStyle: 'bold' },
      { token: 'emphasis', fontStyle: 'italic' },
      { token: 'string.link', foreground: '60a5fa' },
      { token: 'comment.quote', foreground: '9ca3af', fontStyle: 'italic' },
    ],
    colors: {},
  })
}

function createEditor(monaco: any) {
  if (!editorContainer.value || monacoEditorInstance) return
  const MONACO_OPTIONS_BLACKLIST = new Set(['value', 'language', 'model'])
  const safeMonacoOptions = Object.fromEntries(
    Object.entries(props.monacoOptions).filter(([key]) => !MONACO_OPTIONS_BLACKLIST.has(key)),
  )

  monacoEditorInstance = monaco.editor.create(editorContainer.value, {
    value: props.content,
    language: 'aimd',
    theme: props.theme,
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: 'on',
    wordWrap: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    padding: { top: 12 },
    readOnly: props.readonly,
    ...safeMonacoOptions,
  })
  monacoEditorInstance.onDidChangeModelContent(() => {
    if (!isSyncing) {
      emit('content-change', monacoEditorInstance.getValue())
    }
    scheduleSourceBlockChromeUpdate()
  })
  scheduleSourceBlockChromeUpdate()
  emit('ready', monacoEditorInstance)
  emit('monaco-loaded', monaco, monacoEditorInstance)
}

onMounted(async () => {
  try {
    loading.value = true
    ensureMonacoEnvironment()
    const monaco = await import('monaco-editor')
    monacoModule = monaco
    registerAimdLanguage(monaco)
    createEditor(monaco)
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  if (sourceBlockUpdateFrame !== null) {
    cancelAnimationFrame(sourceBlockUpdateFrame)
    sourceBlockUpdateFrame = null
  }
  clearSourceBlockChrome()
  monacoEditorInstance?.dispose()
})

watch(() => props.content, (content) => {
  if (!monacoEditorInstance || content === monacoEditorInstance.getValue()) {
    return
  }

  isSyncing = true
  monacoEditorInstance.setValue(content)
  isSyncing = false
  scheduleSourceBlockChromeUpdate()
})

watch(() => props.theme, (theme) => {
  if (monacoModule) {
    monacoModule.editor.setTheme(theme)
    scheduleSourceBlockChromeUpdate()
  }
})

watch(() => props.readonly, (readonly) => {
  monacoEditorInstance?.updateOptions({ readOnly: readonly })
})

// Expose internal references for parent to set values, etc.
function getEditor() { return monacoEditorInstance }
function getMonaco() { return monacoModule }

function setValue(val: string) {
  if (monacoEditorInstance) {
    isSyncing = true
    monacoEditorInstance.setValue(val)
    isSyncing = false
  }
}

function getSelection() {
  return monacoEditorInstance?.getSelection()
}

function executeEdits(source: string, edits: any[]) {
  monacoEditorInstance?.executeEdits(source, edits)
}

function focus() {
  monacoEditorInstance?.focus()
}

function getModel() {
  return monacoEditorInstance?.getModel()
}

function getPosition() {
  return monacoEditorInstance?.getPosition()
}

function getValue() {
  return monacoEditorInstance?.getValue()
}

defineExpose({
  getEditor,
  getMonaco,
  setValue,
  getSelection,
  executeEdits,
  focus,
  getModel,
  getPosition,
  getValue,
  loading,
})
</script>

<template>
  <div class="aimd-editor-source-mode" :style="minHeight > 0 ? { height: minHeight + 'px' } : { height: '100%' }">
    <div v-if="loading" class="aimd-editor-loading">{{ resolvedMessages.common.loadingEditor }}</div>
    <div ref="editorContainer" class="aimd-editor-container" />
  </div>
</template>

<style scoped>
.aimd-editor-source-mode {
  position: relative;
}

.aimd-editor-container {
  height: 100%;
}

.aimd-editor-source-mode :deep(.aimd-source-fence) {
  background: rgba(248, 250, 252, 0.78);
}

.aimd-editor-source-mode :deep(.aimd-source-fence--neutral) {
  background: rgba(248, 250, 252, 0.82);
}

.aimd-editor-source-mode :deep(.aimd-source-fence--client) {
  background: rgba(240, 253, 250, 0.92);
}

.aimd-editor-source-mode :deep(.aimd-source-fence--server) {
  background: rgba(255, 247, 237, 0.92);
}

.aimd-editor-source-mode :deep(.aimd-source-fence--open) {
  border-top: 1px solid rgba(148, 163, 184, 0.24);
}

.aimd-editor-source-mode :deep(.aimd-source-fence--close) {
  border-bottom: 1px solid rgba(148, 163, 184, 0.24);
}

.aimd-editor-source-mode :deep(.aimd-source-fence-gutter) {
  margin-left: 6px;
  border-left: 3px solid rgba(100, 116, 139, 0.22);
}

.aimd-editor-source-mode :deep(.aimd-source-fence-gutter--client) {
  border-left-color: rgba(13, 148, 136, 0.55);
}

.aimd-editor-source-mode :deep(.aimd-source-fence-gutter--server) {
  border-left-color: rgba(217, 119, 6, 0.55);
}

.aimd-editor-source-mode :deep(.aimd-source-block-zone) {
  box-sizing: border-box;
  margin: 0 12px 0 18px;
  padding: 6px 10px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-bottom: 0;
  border-radius: 12px 12px 0 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(248, 250, 252, 0.96) 100%);
}

.aimd-editor-source-mode :deep(.aimd-source-block-zone--client) {
  background: linear-gradient(180deg, rgba(240, 253, 250, 0.98) 0%, rgba(248, 250, 252, 0.96) 100%);
}

.aimd-editor-source-mode :deep(.aimd-source-block-zone--server) {
  background: linear-gradient(180deg, rgba(255, 247, 237, 0.98) 0%, rgba(248, 250, 252, 0.96) 100%);
}

.aimd-editor-source-mode :deep(.aimd-source-block-zone__header) {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.aimd-editor-source-mode :deep(.aimd-source-block-zone__title-wrap) {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.aimd-editor-source-mode :deep(.aimd-source-block-zone__title) {
  color: #0f172a;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: 0.01em;
}

.aimd-editor-source-mode :deep(.aimd-source-block-zone__meta),
.aimd-editor-source-mode :deep(.aimd-source-block-zone__group-label) {
  color: #64748b;
  font-size: 9px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.aimd-editor-source-mode :deep(.aimd-source-block-zone__badge) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(71, 84, 103, 0.08);
  color: #475467;
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.aimd-editor-source-mode :deep(.aimd-source-block-zone--client .aimd-source-block-zone__badge) {
  background: rgba(13, 148, 136, 0.10);
  color: #0f766e;
}

.aimd-editor-source-mode :deep(.aimd-source-block-zone--server .aimd-source-block-zone__badge) {
  background: rgba(217, 119, 6, 0.10);
  color: #b45309;
}

.aimd-editor-source-mode :deep(.aimd-source-block-zone__flow) {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 5px;
}

.aimd-editor-source-mode :deep(.aimd-source-block-zone__group) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.aimd-editor-source-mode :deep(.aimd-source-block-zone__chip) {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.18);
  color: #0f172a;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.25;
}

.aimd-editor-source-mode :deep(.aimd-source-block-zone__arrow) {
  color: #667085;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}
</style>
