<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, shallowRef, computed, nextTick, defineComponent, h, toRef } from 'vue'
import { parseAndExtract } from '@airalogy/aimd-renderer'

// Milkdown
import { MilkdownProvider, Milkdown, useEditor, useInstance } from '@milkdown/vue'
import { defaultValueCtx, Editor, rootCtx, editorViewOptionsCtx, editorViewCtx } from '@milkdown/kit/core'
import { createTable } from '@milkdown/kit/preset/gfm'
import { commonmark, paragraphSchema, headingSchema, blockquoteSchema, bulletListSchema, orderedListSchema, codeBlockSchema, hrSchema, listItemSchema } from '@milkdown/kit/preset/commonmark'
import { commandsCtx } from '@milkdown/kit/core'
import { setBlockTypeCommand, wrapInBlockTypeCommand, addBlockTypeCommand, clearTextInCurrentBlockCommand } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { history } from '@milkdown/kit/plugin/history'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { clipboard } from '@milkdown/kit/plugin/clipboard'
import { indent } from '@milkdown/kit/plugin/indent'
import { trailing } from '@milkdown/kit/plugin/trailing'
import { block, BlockProvider } from '@milkdown/kit/plugin/block'
import { replaceAll, insert, getMarkdown, callCommand, $prose } from '@milkdown/kit/utils'
import { insertTableCommand } from '@milkdown/kit/preset/gfm'
import { tableBlock, tableBlockConfig } from '@milkdown/kit/component/table-block'
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { findParent } from '@milkdown/kit/prose'
import '@milkdown/theme-nord/style.css'
import '@milkdown/kit/prose/tables/style/tables.css'

// Internal
import { aimdMilkdownPlugins } from './milkdown-aimd-plugin'
import AimdFieldDialog from './AimdFieldDialog.vue'
import {
  AIMD_FIELD_TYPES,
  MD_TOOLBAR_ITEMS,
  getQuickAimdSyntax,
  type AimdEditorProps,
} from './types'

// Mode switch SVG icons
const modeSvgIcons = {
  source: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  wysiwyg: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
}

const props = withDefaults(defineProps<AimdEditorProps>(), {
  modelValue: '',
  mode: 'source',
  theme: 'aimd-light',
  showTopBar: true,
  showToolbar: true,
  showAimdToolbar: true,
  showMdToolbar: true,
  enableBlockHandle: true,
  enableSlashMenu: true,
  minHeight: 500,
  readonly: false,
  monacoOptions: () => ({}),
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:mode', mode: 'source' | 'wysiwyg'): void
  (e: 'ready', editor: { monaco?: any; milkdown?: Editor }): void
}>()

// --- State ---
const editorMode = ref<'source' | 'wysiwyg'>(props.mode)
const editorContainer = ref<HTMLElement | null>(null)
const monacoEditor = shallowRef<any>(null)
const monacoInstance = shallowRef<any>(null)
const monacoLoading = ref(true)
const currentTheme = ref(props.theme)
const content = ref(props.modelValue)
const showAimdDialog = ref(false)
const aimdDialogType = ref('var')
const milkdownEditorRef = shallowRef<Editor | null>(null)

let isSyncing = false

// Sync external modelValue changes
watch(() => props.modelValue, (val) => {
  if (val !== content.value) {
    isSyncing = true
    content.value = val
    if (editorMode.value === 'source' && monacoEditor.value) {
      monacoEditor.value.setValue(val)
    } else if (editorMode.value === 'wysiwyg' && milkdownEditorRef.value) {
      try { milkdownEditorRef.value.action(replaceAll(val)) } catch {}
    }
    isSyncing = false
  }
})

watch(() => props.mode, (m) => {
  if (m !== editorMode.value) switchMode(m)
})

// Emit content changes
watch(content, (val) => {
  if (!isSyncing) {
    emit('update:modelValue', val)
  }
})

// --- Extracted fields for reference suggestions ---
const extractedFields = computed(() => {
  try { return parseAndExtract(content.value) } catch { return null }
})

const refSuggestions = computed(() => {
  const fields = extractedFields.value
  if (!fields) return []
  const type = aimdDialogType.value
  if (type === 'ref_step') return fields.step || []
  if (type === 'ref_var') return fields.var || []
  if (type === 'ref_fig') return fields.ref_fig || []
  return []
})

// --- Monaco Editor ---
onMounted(async () => {
  try {
    monacoLoading.value = true
    const monaco = await import('monaco-editor')
    monacoInstance.value = monaco
    registerAimdLanguage(monaco)
    createMonacoEditor(monaco)
  } finally {
    monacoLoading.value = false
  }
})

function registerAimdLanguage(monaco: any) {
  // Check if already registered
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
        [/^```\w*$/, { token: 'string.code', next: '@codeblock' }],
        [/^~~~\w*$/, { token: 'string.code', next: '@codeblock' }],
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
        [/\b(var_table|var|step|check|ref_step|ref_var)\b/, 'keyword.aimd'],
        [/\|/, 'delimiter.aimd'],
        [/:/, 'delimiter'],
        [/\b(str|int|float|bool|list|dict|any)\b/, 'type.aimd'],
        [/[[\]()]/, 'delimiter.bracket'],
        [/=/, 'delimiter'],
        [/"[^"]*"/, 'string'],
        [/'[^']*'/, 'string'],
        [/-?\d+\.?\d*/, 'number'],
        [/\b(true|false|True|False|null|None)\b/, 'constant'],
        [/\bsubvars\b/, 'keyword'],
        [/,/, 'delimiter'],
        [/[a-z_]\w*/i, 'variable.aimd'],
        [/\s+/, ''],
      ],
      codeblock: [
        [/^```\s*$/, { token: 'string.code', next: '@pop' }],
        [/^~~~\s*$/, { token: 'string.code', next: '@pop' }],
        [/.*$/, 'string.code'],
      ],
    },
  } as any)

  monaco.languages.registerCompletionItemProvider('aimd', {
    provideCompletionItems: () => {
      const keywords = ['var', 'var_table', 'step', 'check', 'ref_step', 'ref_var']
      const suggestions = keywords.map(keyword => ({
        label: `{{${keyword}|}}`,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: `{{${keyword}|\${1:name}}}`,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: `Insert AIMD ${keyword} field`,
      }))
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

function createMonacoEditor(monaco: any) {
  if (!editorContainer.value || monacoEditor.value) return
  monacoEditor.value = monaco.editor.create(editorContainer.value, {
    value: content.value,
    language: 'aimd',
    theme: currentTheme.value,
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: 'on',
    wordWrap: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    padding: { top: 12 },
    readOnly: props.readonly,
    ...props.monacoOptions,
  })
  monacoEditor.value.onDidChangeModelContent(() => {
    if (!isSyncing) {
      content.value = monacoEditor.value.getValue()
    }
  })
  emit('ready', { monaco: monacoEditor.value })
}

watch(currentTheme, (theme) => {
  if (monacoInstance.value) monacoInstance.value.editor.setTheme(theme)
})

onBeforeUnmount(() => {
  monacoEditor.value?.dispose()
  blockProviderRef.value?.destroy()
  document.removeEventListener('click', closeBlockMenu)
})

// --- Milkdown WYSIWYG ---
function onMilkdownMarkdownUpdated(_ctx: any, markdown: string, _prev: string) {
  if (!isSyncing) {
    isSyncing = true
    content.value = markdown
    isSyncing = false
  }
}

function onMilkdownReady(editor: Editor) {
  milkdownEditorRef.value = editor
  emit('ready', { milkdown: editor })
}

// --- Mode switching ---
async function switchMode(mode: 'source' | 'wysiwyg') {
  if (mode === editorMode.value) return

  if (editorMode.value === 'source' && monacoEditor.value) {
    content.value = monacoEditor.value.getValue()
  }

  if (editorMode.value === 'wysiwyg' && milkdownEditorRef.value) {
    try {
      const md = milkdownEditorRef.value.action(getMarkdown())
      if (typeof md === 'string') content.value = md
    } catch {}
  }

  editorMode.value = mode
  emit('update:mode', mode)

  if (mode === 'source') {
    await nextTick()
    if (monacoEditor.value) {
      isSyncing = true
      monacoEditor.value.setValue(content.value)
      isSyncing = false
    }
  } else if (mode === 'wysiwyg') {
    await nextTick()
    if (milkdownEditorRef.value) {
      try {
        isSyncing = true
        milkdownEditorRef.value.action(replaceAll(content.value))
        isSyncing = false
      } catch { isSyncing = false }
    }
  }
}

function toggleTheme() {
  currentTheme.value = currentTheme.value === 'aimd-light' ? 'aimd-dark' : 'aimd-light'
}

// --- Markdown toolbar actions ---
function insertTextIntoActiveEditor(text: string) {
  if (editorMode.value === 'source' && monacoEditor.value) {
    const selection = monacoEditor.value.getSelection()
    monacoEditor.value.executeEdits('toolbar', [{
      range: selection,
      text,
      forceMoveMarkers: true,
    }])
    monacoEditor.value.focus()
  } else if (editorMode.value === 'wysiwyg' && milkdownEditorRef.value) {
    try { milkdownEditorRef.value.action(insert(text)) } catch {}
  }
}

function insertAtCursor(before: string, after: string = '', placeholder: string = '') {
  if (editorMode.value === 'source' && monacoEditor.value) {
    const selection = monacoEditor.value.getSelection()
    const selectedText = monacoEditor.value.getModel().getValueInRange(selection) || placeholder
    const text = before + selectedText + after
    monacoEditor.value.executeEdits('toolbar', [{
      range: selection,
      text,
      forceMoveMarkers: true,
    }])
    monacoEditor.value.focus()
  } else if (editorMode.value === 'wysiwyg' && milkdownEditorRef.value) {
    try { milkdownEditorRef.value.action(insert(before + placeholder + after)) } catch {}
  }
}

function insertLine(prefix: string, placeholder: string = '') {
  if (editorMode.value === 'source' && monacoEditor.value) {
    const position = monacoEditor.value.getPosition()
    const model = monacoEditor.value.getModel()
    const lineContent = model.getLineContent(position.lineNumber)
    if (lineContent.trim() === '') {
      const range = { startLineNumber: position.lineNumber, startColumn: 1, endLineNumber: position.lineNumber, endColumn: lineContent.length + 1 }
      monacoEditor.value.executeEdits('toolbar', [{ range, text: prefix + placeholder, forceMoveMarkers: true }])
    } else {
      const range = { startLineNumber: position.lineNumber, startColumn: lineContent.length + 1, endLineNumber: position.lineNumber, endColumn: lineContent.length + 1 }
      monacoEditor.value.executeEdits('toolbar', [{ range, text: '\n' + prefix + placeholder, forceMoveMarkers: true }])
    }
    monacoEditor.value.focus()
  } else if (editorMode.value === 'wysiwyg' && milkdownEditorRef.value) {
    try { milkdownEditorRef.value.action(insert('\n' + prefix + placeholder)) } catch {}
  }
}

function handleMdAction(action: string) {
  switch (action) {
    case 'h1': insertLine('# ', 'Heading'); break
    case 'h2': insertLine('## ', 'Heading'); break
    case 'h3': insertLine('### ', 'Heading'); break
    case 'bold': insertAtCursor('**', '**', 'bold text'); break
    case 'italic': insertAtCursor('*', '*', 'italic text'); break
    case 'strikethrough': insertAtCursor('~~', '~~', 'strikethrough'); break
    case 'ul': insertLine('- ', 'list item'); break
    case 'ol': insertLine('1. ', 'list item'); break
    case 'blockquote': insertLine('> ', 'quote'); break
    case 'code': insertAtCursor('`', '`', 'code'); break
    case 'codeblock': insertAtCursor('```\n', '\n```', 'code block'); break
    case 'link': insertAtCursor('[', '](url)', 'link text'); break
    case 'image': insertAtCursor('![', '](url)', 'alt text'); break
    case 'hr': insertLine('---'); break
    case 'math': insertAtCursor('$', '$', 'E = mc^2'); break
    case 'table':
      if (editorMode.value === 'wysiwyg' && milkdownEditorRef.value) {
        try { milkdownEditorRef.value.action(callCommand(insertTableCommand.key, { row: 3, col: 3 })) } catch {}
      } else {
        insertLine('| Col A | Col B | Col C |\n|-------|-------|-------|\n| ', ' |  |  |')
      }
      break
  }
}

// --- AIMD field insertion ---
function openAimdDialog(type: string) {
  aimdDialogType.value = type
  showAimdDialog.value = true
}

function quickInsertAimd(type: string) {
  insertTextIntoActiveEditor(getQuickAimdSyntax(type))
}

function onDialogInsert(syntax: string) {
  insertTextIntoActiveEditor(syntax)
}

// --- Block add menu ---
const showBlockMenu = ref(false)
const blockMenuPos = ref({ x: 0, y: 0 })
const blockProviderRef = shallowRef<BlockProvider | null>(null)

interface BlockMenuItem {
  label: string
  icon: string
  onRun: (ctx: any) => void
}

interface BlockMenuGroup {
  label: string
  items: BlockMenuItem[]
}

// Block menu SVG icon helper (14x14)
const _bsi = (d: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`

const BLOCK_MENU_GROUPS: BlockMenuGroup[] = [
  {
    label: 'Text',
    items: [
      {
        label: 'Text', icon: 'T',
        onRun: (ctx) => {
          const commands = ctx.get(commandsCtx)
          commands.call(clearTextInCurrentBlockCommand.key)
          commands.call(setBlockTypeCommand.key, { nodeType: paragraphSchema.type(ctx) })
        },
      },
      {
        label: 'Heading 1', icon: 'H1',
        onRun: (ctx) => {
          const commands = ctx.get(commandsCtx)
          commands.call(clearTextInCurrentBlockCommand.key)
          commands.call(setBlockTypeCommand.key, { nodeType: headingSchema.type(ctx), attrs: { level: 1 } })
        },
      },
      {
        label: 'Heading 2', icon: 'H2',
        onRun: (ctx) => {
          const commands = ctx.get(commandsCtx)
          commands.call(clearTextInCurrentBlockCommand.key)
          commands.call(setBlockTypeCommand.key, { nodeType: headingSchema.type(ctx), attrs: { level: 2 } })
        },
      },
      {
        label: 'Heading 3', icon: 'H3',
        onRun: (ctx) => {
          const commands = ctx.get(commandsCtx)
          commands.call(clearTextInCurrentBlockCommand.key)
          commands.call(setBlockTypeCommand.key, { nodeType: headingSchema.type(ctx), attrs: { level: 3 } })
        },
      },
      {
        label: 'Quote', icon: _bsi('<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>'),
        onRun: (ctx) => {
          const commands = ctx.get(commandsCtx)
          commands.call(clearTextInCurrentBlockCommand.key)
          commands.call(wrapInBlockTypeCommand.key, { nodeType: blockquoteSchema.type(ctx) })
        },
      },
      {
        label: 'Divider', icon: _bsi('<line x1="2" y1="12" x2="22" y2="12" stroke-width="2.5"/>'),
        onRun: (ctx) => {
          const commands = ctx.get(commandsCtx)
          commands.call(clearTextInCurrentBlockCommand.key)
          commands.call(addBlockTypeCommand.key, { nodeType: hrSchema.type(ctx) })
        },
      },
    ],
  },
  {
    label: 'List',
    items: [
      {
        label: 'Bullet List', icon: _bsi('<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="5" cy="6" r="1" fill="currentColor"/><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="5" cy="18" r="1" fill="currentColor"/>'),
        onRun: (ctx) => {
          const commands = ctx.get(commandsCtx)
          commands.call(clearTextInCurrentBlockCommand.key)
          commands.call(wrapInBlockTypeCommand.key, { nodeType: bulletListSchema.type(ctx) })
        },
      },
      {
        label: 'Ordered List', icon: _bsi('<line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="3" y="7.5" font-size="6" fill="currentColor" stroke="none" font-weight="600">1</text><text x="3" y="13.5" font-size="6" fill="currentColor" stroke="none" font-weight="600">2</text><text x="3" y="19.5" font-size="6" fill="currentColor" stroke="none" font-weight="600">3</text>'),
        onRun: (ctx) => {
          const commands = ctx.get(commandsCtx)
          commands.call(clearTextInCurrentBlockCommand.key)
          commands.call(wrapInBlockTypeCommand.key, { nodeType: orderedListSchema.type(ctx) })
        },
      },
    ],
  },
  {
    label: 'Advanced',
    items: [
      {
        label: 'Code Block', icon: _bsi('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
        onRun: (ctx) => {
          const commands = ctx.get(commandsCtx)
          commands.call(clearTextInCurrentBlockCommand.key)
          commands.call(setBlockTypeCommand.key, { nodeType: codeBlockSchema.type(ctx) })
        },
      },
      {
        label: 'Table', icon: _bsi('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>'),
        onRun: (ctx) => {
          const commands = ctx.get(commandsCtx)
          const view = ctx.get(editorViewCtx)
          commands.call(clearTextInCurrentBlockCommand.key)
          const { from } = view.state.selection
          commands.call(addBlockTypeCommand.key, { nodeType: createTable(ctx, 3, 3) })
        },
      },
    ],
  },
  {
    label: 'AIMD',
    items: AIMD_FIELD_TYPES.map((ft) => ({
      label: ft.label, icon: ft.svgIcon,
      onRun: (_ctx: any) => {
        // Open AIMD field dialog (same behavior as toolbar buttons)
        openAimdDialog(ft.type)
      },
    })),
  },
]

function onBlockMenuClick(item: BlockMenuItem) {
  showBlockMenu.value = false
  if (!milkdownEditorRef.value) return
  const editor = milkdownEditorRef.value

  try {
    editor.action((ctx) => {
      item.onRun(ctx)
      // Ensure focus after command execution
      nextTick(() => {
        try {
          const view = ctx.get(editorViewCtx)
          view.focus()
        } catch {}
      })
    })
  } catch {}
}

function closeBlockMenu(e: MouseEvent) {
  const menu = document.querySelector('.aimd-block-add-menu')
  const btn = document.querySelector('.aimd-block-handle-btn')
  if (menu && !menu.contains(e.target as Node) && !(btn && btn.contains(e.target as Node))) {
    showBlockMenu.value = false
  }
}

watch(showBlockMenu, (val) => {
  if (val) {
    setTimeout(() => document.addEventListener('click', closeBlockMenu), 0)
  } else {
    document.removeEventListener('click', closeBlockMenu)
  }
})

// --- Placeholder plugin (shows "Please enter..." on empty paragraphs) ---
const placeholderPlugin = $prose(() => {
  return new Plugin({
    key: new PluginKey('AIMD_PLACEHOLDER'),
    props: {
      decorations: (state) => {
        const { selection } = state
        if (!selection.empty) return null

        const $pos = selection.$anchor
        const node = $pos.parent
        if (node.content.size > 0) return null

        const inTable = findParent((n) => n.type.name === 'table')($pos)
        if (inTable) return null

        const before = $pos.before()
        const deco = Decoration.node(before, before + node.nodeSize, {
          class: 'aimd-placeholder',
          'data-placeholder': 'Please enter...',
        })
        return DecorationSet.create(state.doc, [deco])
      },
    },
  })
})

// --- Table block icon SVGs (from Milkdown Crepe) ---
const tableIcons = {
  plus: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g clip-path="url(#clip0_971_7676)"><path d="M18 13H13V18C13 18.55 12.55 19 12 19C11.45 19 11 18.55 11 18V13H6C5.45 13 5 12.55 5 12C5 11.45 5.45 11 6 11H11V6C11 5.45 11.45 5 12 5C12.55 5 13 5.45 13 6V11H18C18.55 11 19 11.45 19 12C19 12.55 18.55 13 18 13Z"/></g><defs><clipPath id="clip0_971_7676"><rect width="24" height="24"/></clipPath></defs></svg>`,
  remove: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M7.30775 20.4997C6.81058 20.4997 6.385 20.3227 6.031 19.9687C5.677 19.6147 5.5 19.1892 5.5 18.692V5.99973H5.25C5.0375 5.99973 4.85942 5.92782 4.71575 5.78398C4.57192 5.64015 4.5 5.46198 4.5 5.24948C4.5 5.03682 4.57192 4.85873 4.71575 4.71523C4.85942 4.57157 5.0375 4.49973 5.25 4.49973H9C9 4.2549 9.08625 4.04624 9.25875 3.87374C9.43108 3.7014 9.63967 3.61523 9.8845 3.61523H14.1155C14.3603 3.61523 14.5689 3.7014 14.7413 3.87374C14.9138 4.04624 15 4.2549 15 4.49973H18.75C18.9625 4.49973 19.1406 4.57165 19.2843 4.71548C19.4281 4.85932 19.5 5.03748 19.5 5.24998C19.5 5.46265 19.4281 5.64073 19.2843 5.78423C19.1406 5.9279 18.9625 5.99973 18.75 5.99973H18.5V18.692C18.5 19.1892 18.323 19.6147 17.969 19.9687C17.615 20.3227 17.1894 20.4997 16.6923 20.4997H7.30775ZM17 5.99973H7V18.692C7 18.7818 7.02883 18.8556 7.0865 18.9132C7.14417 18.9709 7.21792 18.9997 7.30775 18.9997H16.6923C16.7821 18.9997 16.8558 18.9709 16.9135 18.9132C16.9712 18.8556 17 18.7818 17 18.692V5.99973ZM10.1543 16.9997C10.3668 16.9997 10.5448 16.9279 10.6885 16.7842C10.832 16.6404 10.9037 16.4622 10.9037 16.2497V8.74973C10.9037 8.53723 10.8318 8.35907 10.688 8.21523C10.5443 8.07157 10.3662 7.99973 10.1535 7.99973C9.941 7.99973 9.76292 8.07157 9.61925 8.21523C9.47575 8.35907 9.404 8.53723 9.404 8.74973V16.2497C9.404 16.4622 9.47583 16.6404 9.6195 16.7842C9.76333 16.9279 9.94158 16.9997 10.1543 16.9997ZM13.8465 16.9997C14.059 16.9997 14.2371 16.9279 14.3807 16.7842C14.5243 16.6404 14.596 16.4622 14.596 16.2497V8.74973C14.596 8.53723 14.5242 8.35907 14.3805 8.21523C14.2367 8.07157 14.0584 7.99973 13.8458 7.99973C13.6333 7.99973 13.4552 8.07157 13.3115 8.21523C13.168 8.35907 13.0962 8.53723 13.0962 8.74973V16.2497C13.0962 16.4622 13.1682 16.6404 13.312 16.7842C13.4557 16.9279 13.6338 16.9997 13.8465 16.9997Z"/></svg>`,
  alignLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M4.25 20.5C4.0375 20.5 3.85942 20.4281 3.71575 20.2843C3.57192 20.1404 3.5 19.9622 3.5 19.7498C3.5 19.5371 3.57192 19.359 3.71575 19.2155C3.85942 19.0718 4.0375 19 4.25 19H19.75C19.9625 19 20.1406 19.0719 20.2843 19.2158C20.4281 19.3596 20.5 19.5378 20.5 19.7502C20.5 19.9629 20.4281 20.141 20.2843 20.2845C20.1406 20.4282 19.9625 20.5 19.75 20.5H4.25ZM4.25 16.625C4.0375 16.625 3.85942 16.5531 3.71575 16.4093C3.57192 16.2654 3.5 16.0872 3.5 15.8748C3.5 15.6621 3.57192 15.484 3.71575 15.3405C3.85942 15.1968 4.0375 15.125 4.25 15.125H13.75C13.9625 15.125 14.1406 15.1969 14.2843 15.3408C14.4281 15.4846 14.5 15.6628 14.5 15.8753C14.5 16.0879 14.4281 16.266 14.2843 16.4095C14.1406 16.5532 13.9625 16.625 13.75 16.625H4.25ZM4.25 12.75C4.0375 12.75 3.85942 12.6781 3.71575 12.5343C3.57192 12.3904 3.5 12.2122 3.5 11.9998C3.5 11.7871 3.57192 11.609 3.71575 11.4655C3.85942 11.3218 4.0375 11.25 4.25 11.25H19.75C19.9625 11.25 20.1406 11.3219 20.2843 11.4658C20.4281 11.6096 20.5 11.7878 20.5 12.0003C20.5 12.2129 20.4281 12.391 20.2843 12.5345C20.1406 12.6782 19.9625 12.75 19.75 12.75H4.25ZM4.25 8.875C4.0375 8.875 3.85942 8.80308 3.71575 8.65925C3.57192 8.51542 3.5 8.33725 3.5 8.12475C3.5 7.91208 3.57192 7.734 3.71575 7.5905C3.85942 7.44683 4.0375 7.375 4.25 7.375H13.75C13.9625 7.375 14.1406 7.44692 14.2843 7.59075C14.4281 7.73458 14.5 7.91275 14.5 8.12525C14.5 8.33792 14.4281 8.516 14.2843 8.6595C14.1406 8.80317 13.9625 8.875 13.75 8.875H4.25ZM4.25 5C4.0375 5 3.85942 4.92808 3.71575 4.78425C3.57192 4.64042 3.5 4.46225 3.5 4.24975C3.5 4.03708 3.57192 3.859 3.71575 3.7155C3.85942 3.57183 4.0375 3.5 4.25 3.5H19.75C19.9625 3.5 20.1406 3.57192 20.2843 3.71575C20.4281 3.85958 20.5 4.03775 20.5 4.25025C20.5 4.46292 20.4281 4.641 20.2843 4.7845C20.1406 4.92817 19.9625 5 19.75 5H4.25Z"/></svg>`,
  alignCenter: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M4.25 20.5C4.0375 20.5 3.85942 20.4281 3.71575 20.2843C3.57192 20.1404 3.5 19.9622 3.5 19.7498C3.5 19.5371 3.57192 19.359 3.71575 19.2155C3.85942 19.0718 4.0375 19 4.25 19H19.75C19.9625 19 20.1406 19.0719 20.2843 19.2158C20.4281 19.3596 20.5 19.5378 20.5 19.7502C20.5 19.9629 20.4281 20.141 20.2843 20.2845C20.1406 20.4282 19.9625 20.5 19.75 20.5H4.25ZM8.25 16.625C8.0375 16.625 7.85942 16.5531 7.71575 16.4093C7.57192 16.2654 7.5 16.0872 7.5 15.8748C7.5 15.6621 7.57192 15.484 7.71575 15.3405C7.85942 15.1968 8.0375 15.125 8.25 15.125H15.75C15.9625 15.125 16.1406 15.1969 16.2843 15.3408C16.4281 15.4846 16.5 15.6628 16.5 15.8753C16.5 16.0879 16.4281 16.266 16.2843 16.4095C16.1406 16.5532 15.9625 16.625 15.75 16.625H8.25ZM4.25 12.75C4.0375 12.75 3.85942 12.6781 3.71575 12.5343C3.57192 12.3904 3.5 12.2122 3.5 11.9998C3.5 11.7871 3.57192 11.609 3.71575 11.4655C3.85942 11.3218 4.0375 11.25 4.25 11.25H19.75C19.9625 11.25 20.1406 11.3219 20.2843 11.4658C20.4281 11.6096 20.5 11.7878 20.5 12.0003C20.5 12.2129 20.4281 12.391 20.2843 12.5345C20.1406 12.6782 19.9625 12.75 19.75 12.75H4.25ZM8.25 8.875C8.0375 8.875 7.85942 8.80308 7.71575 8.65925C7.57192 8.51542 7.5 8.33725 7.5 8.12475C7.5 7.91208 7.57192 7.734 7.71575 7.5905C7.85942 7.44683 8.0375 7.375 8.25 7.375H15.75C15.9625 7.375 16.1406 7.44692 16.2843 7.59075C16.4281 7.73458 16.5 7.91275 16.5 8.12525C16.5 8.33792 16.4281 8.516 16.2843 8.6595C16.1406 8.80317 15.9625 8.875 15.75 8.875H8.25ZM4.25 5C4.0375 5 3.85942 4.92808 3.71575 4.78425C3.57192 4.64042 3.5 4.46225 3.5 4.24975C3.5 4.03708 3.57192 3.859 3.71575 3.7155C3.85942 3.57183 4.0375 3.5 4.25 3.5H19.75C19.9625 3.5 20.1406 3.57192 20.2843 3.71575C20.4281 3.85958 20.5 4.03775 20.5 4.25025C20.5 4.46292 20.4281 4.641 20.2843 4.7845C20.1406 4.92817 19.9625 5 19.75 5H4.25Z"/></svg>`,
  alignRight: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M4.25 5C4.0375 5 3.85942 4.92808 3.71575 4.78425C3.57192 4.64042 3.5 4.46225 3.5 4.24975C3.5 4.03708 3.57192 3.859 3.71575 3.7155C3.85942 3.57183 4.0375 3.5 4.25 3.5H19.75C19.9625 3.5 20.1406 3.57192 20.2843 3.71575C20.4281 3.85958 20.5 4.03775 20.5 4.25025C20.5 4.46292 20.4281 4.641 20.2843 4.7845C20.1406 4.92817 19.9625 5 19.75 5H4.25ZM10.25 8.875C10.0375 8.875 9.85942 8.80308 9.71575 8.65925C9.57192 8.51542 9.5 8.33725 9.5 8.12475C9.5 7.91208 9.57192 7.734 9.71575 7.5905C9.85942 7.44683 10.0375 7.375 10.25 7.375H19.75C19.9625 7.375 20.1406 7.44692 20.2843 7.59075C20.4281 7.73458 20.5 7.91275 20.5 8.12525C20.5 8.33792 20.4281 8.516 20.2843 8.6595C20.1406 8.80317 19.9625 8.875 19.75 8.875H10.25ZM4.25 12.75C4.0375 12.75 3.85942 12.6781 3.71575 12.5343C3.57192 12.3904 3.5 12.2122 3.5 11.9998C3.5 11.7871 3.57192 11.609 3.71575 11.4655C3.85942 11.3218 4.0375 11.25 4.25 11.25H19.75C19.9625 11.25 20.1406 11.3219 20.2843 11.4658C20.4281 11.6096 20.5 11.7878 20.5 12.0003C20.5 12.2129 20.4281 12.391 20.2843 12.5345C20.1406 12.6782 19.9625 12.75 19.75 12.75H4.25ZM10.25 16.625C10.0375 16.625 9.85942 16.5531 9.71575 16.4093C9.57192 16.2654 9.5 16.0872 9.5 15.8748C9.5 15.6621 9.57192 15.484 9.71575 15.3405C9.85942 15.1968 10.0375 15.125 10.25 15.125H19.75C19.9625 15.125 20.1406 15.1969 20.2843 15.3408C20.4281 15.4846 20.5 15.6628 20.5 15.8753C20.5 16.0879 20.4281 16.266 20.2843 16.4095C20.1406 16.5532 19.9625 16.625 19.75 16.625H10.25ZM4.25 20.5C4.0375 20.5 3.85942 20.4281 3.71575 20.2843C3.57192 20.1404 3.5 19.9622 3.5 19.7498C3.5 19.5371 3.57192 19.359 3.71575 19.2155C3.85942 19.0718 4.0375 19 4.25 19H19.75C19.9625 19 20.1406 19.0719 20.2843 19.2158C20.4281 19.3596 20.5 19.5378 20.5 19.7502C20.5 19.9629 20.4281 20.141 20.2843 20.2845C20.1406 20.4282 19.9625 20.5 19.75 20.5H4.25Z"/></svg>`,
  dragHandle: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M3.5 9.83366C3.35833 9.83366 3.23961 9.78571 3.14383 9.68983C3.04794 9.59394 3 9.47516 3 9.33349C3 9.19171 3.04794 9.07299 3.14383 8.97733C3.23961 8.88155 3.35833 8.83366 3.5 8.83366H12.5C12.6417 8.83366 12.7604 8.8816 12.8562 8.97749C12.9521 9.07338 13 9.19216 13 9.33383C13 9.4756 12.9521 9.59433 12.8562 9.68999C12.7604 9.78577 12.6417 9.83366 12.5 9.83366H3.5ZM3.5 7.16699C3.35833 7.16699 3.23961 7.11905 3.14383 7.02316C3.04794 6.92727 3 6.80849 3 6.66683C3 6.52505 3.04794 6.40633 3.14383 6.31066C3.23961 6.21488 3.35833 6.16699 3.5 6.16699H12.5C12.6417 6.16699 12.7604 6.21494 12.8562 6.31083C12.9521 6.40671 13 6.52549 13 6.66716C13 6.80894 12.9521 6.92766 12.8562 7.02333C12.7604 7.1191 12.6417 7.16699 12.5 7.16699H3.5Z"/></svg>`,
}

// --- Milkdown inner component ---
const MilkdownEditorInner = defineComponent({
  name: 'MilkdownEditorInner',
  props: {
    defaultValue: { type: String, default: '' },
    enableBlockHandle: { type: Boolean, default: true },
  },
  emits: ['ready', 'markdown-updated'],
  setup(innerProps, { emit: innerEmit }) {
    const defaultVal = toRef(innerProps, 'defaultValue')

    useEditor((root) => {
      const editor = Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root)
          ctx.set(defaultValueCtx, defaultVal.value)
          ctx.set(editorViewOptionsCtx, {
            attributes: { class: 'milkdown-editor-content', spellcheck: 'false' },
          })
          ctx.get(listenerCtx)
            .markdownUpdated((_ctx, markdown, prev) => {
              if (markdown !== prev) {
                innerEmit('markdown-updated', _ctx, markdown, prev)
              }
            })
        })
        .use(commonmark)
        .use(gfm)
        .use(history)
        .use(listener)
        .use(clipboard)
        .use(indent)
        .use(trailing)
        .use(aimdMilkdownPlugins)
        .use(tableBlock)
        .use(placeholderPlugin)
        .config((ctx) => {
          ctx.update(tableBlockConfig.key, (defaultConfig) => ({
            ...defaultConfig,
            renderButton: (renderType: string) => {
              switch (renderType) {
                case 'add_row': return tableIcons.plus
                case 'add_col': return tableIcons.plus
                case 'delete_row': return tableIcons.remove
                case 'delete_col': return tableIcons.remove
                case 'align_col_left': return tableIcons.alignLeft
                case 'align_col_center': return tableIcons.alignCenter
                case 'align_col_right': return tableIcons.alignRight
                case 'col_drag_handle': return tableIcons.dragHandle
                case 'row_drag_handle': return tableIcons.dragHandle
                default: return ''
              }
            },
          }))
        })

      if (innerProps.enableBlockHandle) {
        editor.use(block)
      }

      return editor
    })

    const [loading, getInstance] = useInstance()

    watch(loading, (isLoading) => {
      if (!isLoading) {
        const editorInstance = getInstance()
        if (editorInstance) {
          innerEmit('ready', editorInstance)

          if (innerProps.enableBlockHandle) {
            nextTick(() => {
              try {
                editorInstance.action((ctx) => {
                  const blockContent = document.createElement('div')
                  blockContent.className = 'aimd-block-handle'

                  const btn = document.createElement('div')
                  btn.className = 'aimd-block-handle-btn'
                  btn.title = 'Click to add block'
                  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`

                  btn.addEventListener('mousedown', (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  })
                  blockContent.appendChild(btn)

                  // eslint-disable-next-line prefer-const
                  let providerRef: any = null

                  btn.addEventListener('click', (e) => {
                    e.preventDefault()
                    e.stopPropagation()

                    // Capture button position BEFORE hiding the block handle
                    const rect = btn.getBoundingClientRect()

                    // Match official Crepe onAdd: insert paragraph, focus, then show menu
                    const view = ctx.get(editorViewCtx)
                    if (!view.hasFocus()) view.focus()

                    const active = providerRef?.active
                    if (!active) return

                    const { state, dispatch } = view
                    const pos = active.$pos.pos + active.node.nodeSize
                    let tr = state.tr.insert(pos, paragraphSchema.type(ctx).create())
                    tr = tr.setSelection(TextSelection.near(tr.doc.resolve(pos)))
                    dispatch(tr.scrollIntoView())

                    // Hide block handle and show menu at captured position
                    providerRef?.hide()

                    // Show menu - position will be adjusted after render
                    blockMenuPos.value = { x: rect.right + 8, y: rect.top }
                    showBlockMenu.value = true

                    // After menu renders, check if it overflows viewport bottom
                    nextTick(() => {
                      const menuEl = document.querySelector('.aimd-block-add-menu') as HTMLElement
                      if (menuEl) {
                        const menuRect = menuEl.getBoundingClientRect()
                        const viewportHeight = window.innerHeight
                        if (menuRect.bottom > viewportHeight) {
                          // Flip: align menu bottom to button top
                          const newTop = rect.top - menuRect.height
                          blockMenuPos.value = { x: rect.right + 8, y: Math.max(4, newTop) }
                        }
                      }
                    })
                  })

                  const provider = new BlockProvider({
                    ctx,
                    content: blockContent,
                    getOffset: () => ({ mainAxis: 16, crossAxis: 0 }),
                    getPlacement: () => 'left',
                  })
                  provider.update()
                  // Disable draggable set by BlockProvider#init
                  blockContent.draggable = false
                  providerRef = provider
                  blockProviderRef.value = provider
                })
              } catch (e) {
                console.warn('BlockProvider init failed:', e)
              }
            })
          }
        }
      }
    }, { immediate: true })

    return () => h(Milkdown)
  },
})

// Expose for external access
defineExpose({
  getContent: () => content.value,
  setContent: (val: string) => {
    content.value = val
    if (editorMode.value === 'source' && monacoEditor.value) {
      monacoEditor.value.setValue(val)
    } else if (milkdownEditorRef.value) {
      try { milkdownEditorRef.value.action(replaceAll(val)) } catch {}
    }
  },
  getMode: () => editorMode.value,
  setMode: (mode: 'source' | 'wysiwyg') => switchMode(mode),
  getMonacoEditor: () => monacoEditor.value,
  getMilkdownEditor: () => milkdownEditorRef.value,
  insertText: insertTextIntoActiveEditor,
})
</script>

<template>
  <div class="aimd-editor">
    <!-- Unified toolbar: mode switch + markdown + aimd -->
    <div v-if="showToolbar" class="aimd-editor-toolbar">
      <!-- Mode switch (inside toolbar) -->
      <div v-if="showTopBar" class="aimd-editor-mode-switch">
        <button
          :class="['aimd-editor-mode-btn', { active: editorMode === 'source' }]"
          @click="switchMode('source')"
          title="Source Mode"
        >
          <span class="aimd-editor-mode-icon" v-html="modeSvgIcons.source" />
          <span>Source</span>
        </button>
        <button
          :class="['aimd-editor-mode-btn', { active: editorMode === 'wysiwyg' }]"
          @click="switchMode('wysiwyg')"
          title="WYSIWYG Mode"
        >
          <span class="aimd-editor-mode-icon" v-html="modeSvgIcons.wysiwyg" />
          <span>WYSIWYG</span>
        </button>
      </div>

      <div v-if="showTopBar && showMdToolbar" class="aimd-editor-toolbar-sep" />

      <!-- Markdown buttons -->
      <template v-if="showMdToolbar">
        <template v-for="item in MD_TOOLBAR_ITEMS" :key="item.action">
          <div v-if="item.action.startsWith('sep')" class="aimd-editor-toolbar-sep" />
          <button
            v-else
            class="aimd-editor-fmt-btn"
            :title="item.title"
            @click="handleMdAction(item.action)"
            v-html="item.svgIcon"
          />
        </template>
      </template>

      <div v-if="showMdToolbar && showAimdToolbar" class="aimd-editor-toolbar-divider" />

      <!-- AIMD buttons -->
      <template v-if="showAimdToolbar">
        <button
          v-for="ft in AIMD_FIELD_TYPES"
          :key="ft.type"
          class="aimd-editor-fmt-btn aimd-editor-aimd-btn"
          :title="ft.desc"
          :style="{ '--aimd-color': ft.color }"
          @click="openAimdDialog(ft.type)"
          @click.middle.prevent="quickInsertAimd(ft.type)"
        >
          <span class="aimd-editor-aimd-btn-icon" v-html="ft.svgIcon" />
          <span class="aimd-editor-aimd-btn-label">{{ ft.label }}</span>
        </button>
      </template>
    </div>

    <!-- Editor area -->
    <div class="aimd-editor-panel" :style="{ minHeight: minHeight + 'px' }">
      <!-- Source mode: Monaco -->
      <div v-show="editorMode === 'source'" class="aimd-editor-source-mode" :style="{ height: minHeight + 'px' }">
        <div v-if="monacoLoading" class="aimd-editor-loading">Loading Editor...</div>
        <div ref="editorContainer" class="aimd-editor-container" />
      </div>

      <!-- WYSIWYG mode: Milkdown -->
      <div v-show="editorMode === 'wysiwyg'" class="aimd-editor-wysiwyg-mode" :style="{ height: minHeight + 'px', overflowY: 'auto' }">
        <MilkdownProvider>
          <MilkdownEditorInner
            :default-value="content"
            :enable-block-handle="enableBlockHandle"
            @ready="onMilkdownReady"
            @markdown-updated="onMilkdownMarkdownUpdated"
          />
        </MilkdownProvider>
      </div>
    </div>

    <!-- Block add menu (teleported to body for correct positioning) -->
    <Teleport to="body">
      <div v-if="showBlockMenu" class="aimd-block-add-menu" :style="{ top: blockMenuPos.y + 'px', left: blockMenuPos.x + 'px' }">
        <template v-for="(group, gi) in BLOCK_MENU_GROUPS" :key="group.label">
          <div v-if="gi > 0" class="aimd-block-add-menu-divider" />
          <div class="aimd-block-add-menu-group-label">{{ group.label }}</div>
          <button
            v-for="item in group.items"
            :key="item.label"
            class="aimd-block-add-menu-item"
            @click="onBlockMenuClick(item)"
          >
            <span class="aimd-block-add-menu-icon" v-html="item.icon" />
            <span>{{ item.label }}</span>
          </button>
        </template>
      </div>
    </Teleport>

    <!-- AIMD Field Dialog -->
    <AimdFieldDialog
      :visible="showAimdDialog"
      :initial-type="aimdDialogType"
      :ref-suggestions="refSuggestions"
      @update:visible="showAimdDialog = $event"
      @insert="onDialogInsert"
    />
  </div>
</template>

<style>
.aimd-editor {
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

/* --- Unified toolbar --- */
.aimd-editor-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  background: #fafbfc;
  border-bottom: 1px solid #e0e0e0;
  overflow-x: auto;
  flex-wrap: wrap;
}

.aimd-editor-mode-switch {
  display: flex;
  background: #eceef1;
  border-radius: 5px;
  padding: 2px;
  gap: 1px;
  flex-shrink: 0;
}

.aimd-editor-mode-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: #777;
  transition: all 0.15s;
  white-space: nowrap;
}

.aimd-editor-mode-btn:hover {
  color: #444;
  background: rgba(255,255,255,0.5);
}

.aimd-editor-mode-btn.active {
  background: #fff;
  color: #1a73e8;
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
}

.aimd-editor-mode-icon {
  display: flex;
  align-items: center;
}

.aimd-editor-toolbar-sep {
  width: 1px;
  height: 20px;
  background: #ddd;
  margin: 0 4px;
  flex-shrink: 0;
}

.aimd-editor-toolbar-divider {
  width: 1px;
  height: 22px;
  background: #ccc;
  margin: 0 6px;
  flex-shrink: 0;
}

.aimd-editor-fmt-btn {
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: #555;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s;
  padding: 0;
  flex-shrink: 0;
}

.aimd-editor-fmt-btn:hover {
  background: #eceef1;
  color: #222;
}

.aimd-editor-fmt-btn:active {
  background: #dfe1e5;
}

.aimd-editor-fmt-btn svg {
  width: 16px;
  height: 16px;
  display: block;
}

/* AIMD buttons */
.aimd-editor-aimd-btn {
  width: auto;
  gap: 3px;
  padding: 0 7px;
  border: 1px solid color-mix(in srgb, var(--aimd-color, #2563eb) 18%, transparent);
  background: color-mix(in srgb, var(--aimd-color, #2563eb) 4%, transparent);
  border-radius: 4px;
}

.aimd-editor-aimd-btn:hover {
  background: color-mix(in srgb, var(--aimd-color, #2563eb) 12%, transparent);
  border-color: color-mix(in srgb, var(--aimd-color, #2563eb) 35%, transparent);
  color: var(--aimd-color, #2563eb);
}

.aimd-editor-aimd-btn-icon {
  display: flex;
  align-items: center;
}

.aimd-editor-aimd-btn-icon svg {
  width: 13px;
  height: 13px;
}

.aimd-editor-aimd-btn-label {
  font-size: 11px;
  font-weight: 500;
}

/* --- Editor panel --- */
.aimd-editor-panel {
  background: #fff;
  overflow: hidden;
}

.aimd-editor-source-mode {
  overflow: hidden;
}

.aimd-editor-container {
  height: 100%;
}

.aimd-editor-loading {
  padding: 40px;
  text-align: center;
  color: #888;
}

/* --- WYSIWYG mode (Milkdown) --- */
.aimd-editor-wysiwyg-mode .milkdown {
  height: 100%;
}

.aimd-editor-wysiwyg-mode .milkdown-editor-content {
  padding: 0 20px 6px;
  min-height: 100%;
  outline: none;
  font-size: 15px;
  line-height: 1.8;
}

.aimd-editor-wysiwyg-mode .milkdown-editor-content .ProseMirror {
  outline: none;
}

.aimd-editor-wysiwyg-mode h1 { font-size: 1.8em; margin: 0.6em 0 0.3em; font-weight: 700; }
.aimd-editor-wysiwyg-mode h2 { font-size: 1.4em; margin: 0.5em 0 0.3em; color: #333; font-weight: 600; border-bottom: 1px solid #eee; padding-bottom: 0.2em; }
.aimd-editor-wysiwyg-mode h3 { font-size: 1.2em; margin: 0.4em 0 0.2em; font-weight: 600; }
.aimd-editor-wysiwyg-mode p { margin: 0.5em 0; }
.aimd-editor-wysiwyg-mode blockquote { border-left: 4px solid #dfe2e5; padding: 8px 16px; margin: 8px 0; color: #666; background: #fafafa; border-radius: 0 4px 4px 0; }
.aimd-editor-wysiwyg-mode ul,
.aimd-editor-wysiwyg-mode ol { padding-left: 24px; margin: 4px 0; }
.aimd-editor-wysiwyg-mode code { background: #f0f2f5; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; font-family: 'SF Mono', 'Fira Code', monospace; }
.aimd-editor-wysiwyg-mode pre { background: #1e1e2e; color: #cdd6f4; padding: 16px; border-radius: 8px; overflow-x: auto; }
.aimd-editor-wysiwyg-mode pre code { background: none; padding: 0; color: inherit; }
.aimd-editor-wysiwyg-mode hr { border: none; border-top: 2px solid #e8e8e8; margin: 16px 0; }
.aimd-editor-wysiwyg-mode img { max-width: 100%; border-radius: 4px; }
.aimd-editor-wysiwyg-mode a { color: #1a73e8; text-decoration: none; }
.aimd-editor-wysiwyg-mode a:hover { text-decoration: underline; }
.aimd-editor-wysiwyg-mode li { margin: 2px 0; }
.aimd-editor-wysiwyg-mode .tableWrapper { overflow-x: auto; margin: 12px 0; }

/* Block handle (BlockProvider - follows cursor line) */
.aimd-block-handle {
  position: absolute;
  z-index: 10;
  transition: top 0.15s ease, left 0.15s ease;
}
.aimd-block-handle[data-show="false"] {
  opacity: 0;
  pointer-events: none;
}
.aimd-block-handle-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: #fff;
  border: 1px solid #e0e0e0;
  color: #aaa;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.aimd-block-handle-btn:hover {
  background: #f0f2f5;
  border-color: #c0c0c0;
  color: #555;
}

/* Block add menu popup */
.aimd-block-add-menu {
  position: fixed;
  z-index: 10000;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  padding: 4px;
  min-width: 200px;
  max-height: 400px;
  overflow-y: auto;
}
.aimd-block-add-menu-group-label {
  padding: 6px 12px 2px;
  font-size: 11px;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.aimd-block-add-menu-divider {
  height: 1px;
  background: #eee;
  margin: 4px 8px;
}
.aimd-block-add-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 13px;
  color: #333;
  text-align: left;
  transition: background 0.1s;
}
.aimd-block-add-menu-item:hover {
  background: #f0f2f5;
}
.aimd-block-add-menu-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: #f0f2f5;
  color: #666;
  flex-shrink: 0;
}

.aimd-block-add-menu-icon svg {
  width: 14px;
  height: 14px;
}

/* ── Table block component (official milkdown style) ── */
.milkdown-table-block {
  display: block;
  margin: 4px 0;
}
.milkdown-table-block table {
  margin: 0 !important;
  border-radius: 0 !important;
}
.milkdown-table-block .handle {
  position: absolute;
  z-index: 50;
  cursor: grab;
  font-size: 14px;
}
.milkdown-table-block .cell-handle {
  left: -999px;
  top: -999px;
  z-index: 100;
  height: 24px;
  transition: opacity 0.2s ease 0.2s;
  background-color: #a8d4ff;
  padding: 0 8px;
  border-radius: 8px;
  position: absolute;
}
.milkdown-table-block .cell-handle[data-role="col-drag-handle"] {
  transform: translateY(50%);
}
.milkdown-table-block .cell-handle[data-role="row-drag-handle"] {
  transform: translateX(50%);
}
.milkdown-table-block .cell-handle[data-show="false"] {
  opacity: 0;
}
.milkdown-table-block .line-handle[data-show="false"] {
  opacity: 0;
}
.milkdown-table-block .handle:hover {
  opacity: 1;
}
.milkdown-table-block .cell-handle .button-group {
  position: absolute;
  height: 30px;
  top: -32px;
  display: flex;
  transform: translateX(-50%);
  left: 50%;
  background-color: #fff;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.milkdown-table-block .cell-handle .button-group[data-show="false"] {
  display: none;
}
.milkdown-table-block .cell-handle .button-group button {
  padding-left: 8px;
  padding-right: 8px;
  width: max-content;
  border: none;
  background: none;
  cursor: pointer;
}
.milkdown-table-block .cell-handle .button-group button:hover {
  background-color: #f0f0f0;
}
.milkdown-table-block .line-handle {
  background-color: #a8d4ff;
  transition: opacity 0.2s ease-in-out;
}
.milkdown-table-block .line-handle[data-role="x-line-drag-handle"] {
  height: 2px;
}
.milkdown-table-block .line-handle[data-role="y-line-drag-handle"] {
  width: 2px;
}
.milkdown-table-block .line-handle .add-button {
  color: #1a73e8;
  border: 1px solid #a8d4ff;
  padding: 0 4px;
  border-radius: 8px;
  width: max-content;
  background: #fff;
  cursor: pointer;
}
.milkdown-table-block .line-handle[data-role="x-line-drag-handle"] .add-button {
  position: absolute;
  transform: translateX(-100%);
  top: -12px;
  height: 24px;
}
.milkdown-table-block .line-handle[data-role="y-line-drag-handle"] .add-button {
  position: absolute;
  transform: translateX(-50%);
  top: -24px;
  height: 24px;
}
.milkdown-table-block .line-handle[data-display-type="indicator"] .add-button {
  display: none;
}
.milkdown-table-block .drag-preview {
  position: absolute;
  z-index: 100;
  border: 1px solid #ccc;
  opacity: 0.5;
  display: flex;
  flex-direction: column;
}
.milkdown-table-block .drag-preview table {
  margin: 0;
}
.milkdown-table-block .drag-preview[data-show="false"] {
  display: none;
}

/* Table cell styles */
.aimd-editor-wysiwyg-mode th,
.aimd-editor-wysiwyg-mode td {
  border: 1px solid #ddd;
  padding: 4px 16px;
  position: relative;
}
.aimd-editor-wysiwyg-mode th {
  background: #f5f7fa;
  font-weight: 600;
}
/* Remove browser default blue outline, add custom selection border */
.aimd-editor-wysiwyg-mode .ProseMirror-selectednode {
  outline: none !important;
}
.milkdown-table-block .ProseMirror-selectednode {
  outline: none !important;
  background-color: transparent !important;
}
/* Table cell click selection border */
.aimd-editor-wysiwyg-mode td:has(.ProseMirror-selectednode),
.aimd-editor-wysiwyg-mode th:has(.ProseMirror-selectednode) {
  outline: 1px solid #a8a8a8;
  outline-offset: -1px;
}
.aimd-editor-wysiwyg-mode .selectedCell {
  position: relative;
}
.aimd-editor-wysiwyg-mode .selectedCell::after {
  content: '';
  position: absolute;
  inset: 0;
  background-color: #d5d5d5;
  opacity: 0.4;
  pointer-events: none;
}
.aimd-editor-wysiwyg-mode .selectedCell::selection {
  background: transparent;
}

/* Table button icon sizing */
.milkdown-table-block .cell-handle .button-group button svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}
.milkdown-table-block .cell-handle svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}
.milkdown-table-block .line-handle .add-button svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

/* Placeholder for empty paragraphs */
.aimd-placeholder {
  position: relative;
}
.aimd-placeholder::before {
  content: attr(data-placeholder);
  position: absolute;
  color: #aaa;
  pointer-events: none;
  font-style: italic;
}

/* AIMD inline field chip styles (fallback) */
.aimd-editor-wysiwyg-mode aimd-field {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 8px 1px 6px;
  border-radius: 4px;
  font-size: 13px;
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  line-height: 1.6;
  vertical-align: baseline;
  border: 1px solid rgba(37, 99, 235, 0.2);
  background: rgba(37, 99, 235, 0.05);
  color: #2563eb;
}
</style>
