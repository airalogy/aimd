import type { Editor } from '@milkdown/kit/core'

export interface AimdFieldType {
  type: string
  label: string
  icon: string
  svgIcon: string
  desc: string
  color: string
}

export interface MdToolbarItem {
  action: string
  label?: string
  title?: string
  style?: string
  svgIcon?: string
}

export interface AimdEditorProps {
  /** Initial / bound markdown content (v-model) */
  modelValue?: string
  /** Initial editor mode */
  mode?: 'source' | 'wysiwyg'
  /** Theme name for Monaco */
  theme?: string
  /** Whether to show the top toolbar (mode switch + theme toggle) */
  showTopBar?: boolean
  /** Whether to show the formatting toolbar */
  showToolbar?: boolean
  /** Whether to show the AIMD toolbar section */
  showAimdToolbar?: boolean
  /** Whether to show the Markdown toolbar section */
  showMdToolbar?: boolean
  /** Whether to enable the Milkdown block handle (plus button on left) */
  enableBlockHandle?: boolean
  /** Whether to enable the slash menu (type / to insert) */
  enableSlashMenu?: boolean
  /** Minimum height of the editor area in px */
  minHeight?: number
  /** Whether the editor is read-only */
  readonly?: boolean
  /** Monaco editor options override */
  monacoOptions?: Record<string, any>
}

export interface AimdEditorEmits {
  (e: 'update:modelValue', value: string): void
  (e: 'update:mode', mode: 'source' | 'wysiwyg'): void
  (e: 'ready', editor: { monaco?: any; milkdown?: Editor }): void
}

// SVG icon helpers – all 16×16, stroke-based, currentColor
const _si = (d: string, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${extra}>${d}</svg>`

export const AIMD_FIELD_TYPES: AimdFieldType[] = [
  { type: 'var', label: 'Variable', icon: 'x', svgIcon: _si('<path d="M7 4l10 16M17 4L7 20"/>'), desc: 'Define a variable', color: '#2563eb' },
  { type: 'var_table', label: 'Var Table', icon: '\u229e', svgIcon: _si('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>'), desc: 'Define a variable table', color: '#059669' },
  { type: 'step', label: 'Step', icon: '\u25b6', svgIcon: _si('<polygon points="5,3 19,12 5,21" fill="currentColor" stroke="none"/>'), desc: 'Define a step', color: '#d97706' },
  { type: 'check', label: 'Checkpoint', icon: '\u2713', svgIcon: _si('<polyline points="4 12 9 17 20 6"/>'), desc: 'Define a checkpoint', color: '#dc2626' },
  { type: 'ref_step', label: 'Ref Step', icon: '\u2197', svgIcon: _si('<path d="M7 17L17 7M17 7H8M17 7v9"/>'), desc: 'Reference a defined step', color: '#0891b2' },
  { type: 'ref_var', label: 'Ref Var', icon: '\u2197', svgIcon: _si('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>'), desc: 'Reference a defined variable', color: '#0891b2' },
  { type: 'ref_fig', label: 'Ref Fig', icon: '\u2197', svgIcon: _si('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><path d="M21 15l-5-5L5 21"/>'), desc: 'Reference a defined figure', color: '#0891b2' },
  { type: 'cite', label: 'Citation', icon: '\ud83d\udcd6', svgIcon: _si('<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>'), desc: 'Insert a citation', color: '#6d28d9' },
]

export const MD_TOOLBAR_ITEMS: MdToolbarItem[] = [
  { action: 'h1', label: 'H1', title: 'Heading 1', svgIcon: _si('<path d="M4 12h8M4 4v16M12 4v16"/><text x="16.5" y="14" font-size="10" fill="currentColor" stroke="none" font-weight="600">1</text>') },
  { action: 'h2', label: 'H2', title: 'Heading 2', svgIcon: _si('<path d="M4 12h8M4 4v16M12 4v16"/><path d="M16.5 8.5a2.5 2.5 0 015 0c0 2-5 4-5 6.5h5" stroke-width="1.8"/>') },
  { action: 'h3', label: 'H3', title: 'Heading 3', svgIcon: _si('<path d="M4 12h8M4 4v16M12 4v16"/><path d="M16.5 8a2 2 0 014 0 2 2 0 01-2.5 2 2 2 0 012.5 2 2 2 0 01-4 0" stroke-width="1.8"/>') },
  { action: 'bold', label: 'B', title: 'Bold', svgIcon: _si('<path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/>') },
  { action: 'italic', label: 'I', title: 'Italic', svgIcon: _si('<line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/>') },
  { action: 'strikethrough', label: 'S', title: 'Strikethrough', svgIcon: _si('<path d="M16 4c-.5-1.5-2.2-3-5-3-3 0-5 2-5 4.5 0 2 1.5 3.5 5 4.5"/><path d="M3 12h18"/><path d="M8 20c.5 1.5 2.2 3 5 3 3 0 5-2 5-4.5 0-2-1.5-3.5-5-4.5"/>') },
  { action: 'sep1' },
  { action: 'ul', label: '\u2022', title: 'Unordered List', svgIcon: _si('<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="5" cy="6" r="1" fill="currentColor"/><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="5" cy="18" r="1" fill="currentColor"/>') },
  { action: 'ol', label: '1.', title: 'Ordered List', svgIcon: _si('<line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="3" y="7.5" font-size="6" fill="currentColor" stroke="none" font-weight="600">1</text><text x="3" y="13.5" font-size="6" fill="currentColor" stroke="none" font-weight="600">2</text><text x="3" y="19.5" font-size="6" fill="currentColor" stroke="none" font-weight="600">3</text>') },
  { action: 'blockquote', label: '\u275d', title: 'Blockquote', svgIcon: _si('<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>') },
  { action: 'code', label: '<>', title: 'Inline Code', svgIcon: _si('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>') },
  { action: 'codeblock', label: '\u2317', title: 'Code Block', svgIcon: _si('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><rect x="1" y="1" width="22" height="22" rx="3" stroke-dasharray="4 2" stroke-width="1"/>') },
  { action: 'sep2' },
  { action: 'link', label: 'link', title: 'Link', svgIcon: _si('<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>') },
  { action: 'image', label: 'img', title: 'Image', svgIcon: _si('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><path d="M21 15l-5-5L5 21"/>') },
  { action: 'table', label: 'tbl', title: 'Table', svgIcon: _si('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>') },
  { action: 'hr', label: '\u2014', title: 'Horizontal Rule', svgIcon: _si('<line x1="2" y1="12" x2="22" y2="12" stroke-width="2.5"/>') },
  { action: 'math', label: '\u2211', title: 'Math Formula', svgIcon: _si('<path d="M18 4H6l6 8-6 8h12" stroke-width="2"/>') },
]

export function getDefaultAimdFields(type: string): Record<string, string> {
  switch (type) {
    case 'var': return { name: '', type: 'str', default: '', title: '' }
    case 'var_table': return { name: '', subvars: '' }
    case 'step': return { name: '', level: '1' }
    case 'check': return { name: '' }
    case 'ref_step': return { name: '' }
    case 'ref_var': return { name: '' }
    case 'ref_fig': return { name: '' }
    case 'cite': return { refs: '' }
    default: return { name: '' }
  }
}

export function buildAimdSyntax(type: string, fields: Record<string, string>): string {
  switch (type) {
    case 'var': {
      let inner = fields.name || 'my_var'
      if (fields.type) inner += ': ' + fields.type
      if (fields.default) inner += ' = ' + fields.default
      if (fields.title) inner += ', title = "' + fields.title + '"'
      return `{{var|${inner}}}`
    }
    case 'var_table': {
      const name = fields.name || 'my_table'
      const subvars = fields.subvars ? fields.subvars.split(',').map(s => s.trim()).filter(Boolean) : ['col1', 'col2']
      return `{{var_table|${name}, subvars=[${subvars.join(', ')}]}}`
    }
    case 'step': {
      const name = fields.name || 'my_step'
      const level = fields.level && fields.level !== '1' ? ', ' + fields.level : ''
      return `{{step|${name}${level}}}`
    }
    case 'check':
      return `{{check|${fields.name || 'my_check'}}}`
    case 'ref_step':
      return `{{ref_step|${fields.name || 'step_name'}}}`
    case 'ref_var':
      return `{{ref_var|${fields.name || 'var_name'}}}`
    case 'ref_fig':
      return `{{ref_fig|${fields.name || 'fig_id'}}}`
    case 'cite':
      return `{{cite|${fields.refs || 'ref1'}}}`
    default:
      return `{{${type}|${fields.name || 'name'}}}`
  }
}

export function getQuickAimdSyntax(type: string): string {
  const defaults: Record<string, string> = {
    var: '{{var|name: str}}',
    var_table: '{{var_table|table_name, subvars=[col1, col2, col3]}}',
    step: '{{step|step_name}}',
    check: '{{check|check_name}}',
    ref_step: '{{ref_step|step_name}}',
    ref_var: '{{ref_var|var_name}}',
    ref_fig: '{{ref_fig|fig_id}}',
    cite: '{{cite|ref1}}',
  }
  return defaults[type] || `{{${type}|name}}`
}
