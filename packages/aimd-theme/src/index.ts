export type AimdThemeMode = 'light' | 'dark'

type PartialRecord<T> = {
  [K in keyof T]?: T[K] extends string
    ? T[K]
    : T[K] extends readonly unknown[]
      ? T[K]
      : T[K] extends Record<string, unknown>
        ? PartialRecord<T[K]>
        : T[K]
}

export interface AimdSemanticStateTokens {
  background: string
  border: string
  text: string
  scopeBackground?: string
  scopeText?: string
  mutedText?: string
}

export interface AimdSyntaxTokens {
  punctuation: string
  keywordVariable: string
  keywordVariableTable: string
  keywordStep: string
  keywordReference: string
  variable: string
  type: string
  parameter: string
  delimiterStrong: string
  delimiterMuted: string
  string: string
  number: string
  boolean: string
  subvars: string
}

export interface AimdCodeToneTokens {
  accent: string
  accentSoft: string
  border: string
  surface: string
}

export interface AimdThemeTokens {
  mode: AimdThemeMode
  text: {
    primary: string
    muted: string
    subtle: string
    strong: string
  }
  border: {
    default: string
    muted: string
    strong: string
  }
  focus: string
  surface: {
    canvas: string
    panel: string
    panelRaised: string
    panelSubtle: string
    editor: string
    overlay: string
  }
  state: {
    brand: AimdSemanticStateTokens
    info: AimdSemanticStateTokens
    success: AimdSemanticStateTokens
    warning: AimdSemanticStateTokens
    danger: AimdSemanticStateTokens
    var: AimdSemanticStateTokens
    varTable: AimdSemanticStateTokens
    step: AimdSemanticStateTokens
    check: AimdSemanticStateTokens
    quiz: AimdSemanticStateTokens & {
      placeholderBackground: string
      placeholderBorder: string
      rubricBackground: string
      rubricBorder: string
    }
  }
  codeBlock: {
    title: string
    meta: string
    text: string
    rule: string
    shell: string
    chipText: string
    chipSurface: string
    headerSurface: string
    flowSurface: string
    shadow: string
    neutral: AimdCodeToneTokens
    client: AimdCodeToneTokens
    server: AimdCodeToneTokens
  }
  syntax: AimdSyntaxTokens
}

export type AimdThemeInput = PartialRecord<AimdThemeTokens> & {
  mode?: AimdThemeMode
}

export interface AimdSyntaxScopes {
  punctuation: string | string[]
  variableKeyword: string | string[]
  variableTableKeyword: string | string[]
  stepKeyword: string | string[]
  referenceKeyword: string | string[]
  variable: string | string[]
  type: string | string[]
  parameter: string | string[]
  delimiterStrong: string | string[]
  delimiterMuted: string | string[]
  string: string | string[]
  number: string | string[]
  boolean: string | string[]
  subvars: string | string[]
}

export interface AimdSyntaxTokenColor {
  scope: string | string[]
  settings: {
    foreground?: string
    fontStyle?: string
  }
}

export interface AimdSyntaxThemeRegistration {
  name: string
  type: AimdThemeMode
  settings: AimdSyntaxTokenColor[]
  colors: Record<string, string>
}

export const defaultLight: AimdThemeTokens = {
  mode: 'light',
  text: {
    primary: '#334155',
    muted: '#667085',
    subtle: '#98a2b3',
    strong: '#101828',
  },
  border: {
    default: '#d8dee8',
    muted: '#e5e7eb',
    strong: '#d1d5db',
  },
  focus: '#4181fd',
  surface: {
    canvas: '#ffffff',
    panel: '#ffffff',
    panelRaised: '#ffffff',
    panelSubtle: '#f8fafc',
    editor: '#ffffff',
    overlay: 'rgba(255, 255, 255, 0.96)',
  },
  state: {
    brand: {
      background: '#f3f8ff',
      border: '#c9dcff',
      text: '#1c4e90',
      scopeBackground: '#dceaff',
      scopeText: '#255eab',
      mutedText: '#3b5b86',
    },
    info: {
      background: '#f8fbff',
      border: '#d1d9e6',
      text: '#334155',
      scopeBackground: '#edf4ff',
      scopeText: '#245ea7',
      mutedText: '#64748b',
    },
    success: {
      background: '#edf6ee',
      border: '#dee7df',
      text: '#446a4f',
      scopeBackground: '#dcefdc',
      scopeText: '#166534',
      mutedText: '#5b625f',
    },
    warning: {
      background: '#fff8ea',
      border: '#f1d39a',
      text: '#9a5800',
      scopeBackground: '#ffe8bf',
      scopeText: '#8a5a12',
      mutedText: '#7b4300',
    },
    danger: {
      background: '#fff3f6',
      border: '#f4b3c1',
      text: '#b4234d',
      scopeBackground: '#fde0e7',
      scopeText: '#b91c1c',
      mutedText: '#e03050',
    },
    var: {
      background: '#e3f2fd',
      border: '#90caf9',
      text: '#1565c0',
      scopeBackground: '#bbdefb',
      scopeText: '#1976d2',
      mutedText: '#7b1fa2',
    },
    varTable: {
      background: '#e8f5e9',
      border: '#a5d6a7',
      text: '#2e7d32',
      scopeBackground: '#c8e6c9',
      scopeText: '#388e3c',
      mutedText: '#6b7280',
    },
    step: {
      background: '#fff3e0',
      border: '#ffcc80',
      text: '#e65100',
      scopeBackground: '#ffecb3',
      scopeText: '#8d6e63',
      mutedText: '#6d4c41',
    },
    check: {
      background: '#f0f0f0',
      border: '#d0d0d0',
      text: '#333333',
      scopeBackground: '#e8e8e8',
      scopeText: '#4f5f77',
      mutedText: '#667085',
    },
    quiz: {
      background: '#fff8e1',
      border: '#ffe082',
      text: '#4e342e',
      scopeBackground: '#ffecb3',
      scopeText: '#8d6e63',
      mutedText: '#6d4c41',
      placeholderBackground: '#fffde7',
      placeholderBorder: '#f9a825',
      rubricBackground: '#fff3cd',
      rubricBorder: '#ffcc80',
    },
  },
  codeBlock: {
    title: '#101828',
    meta: '#667085',
    text: '#101828',
    rule: 'rgba(148, 163, 184, 0.18)',
    shell: '#ffffff',
    chipText: '#475467',
    chipSurface: '#f8fafc',
    headerSurface: '#ffffff',
    flowSurface: '#f8fafc',
    shadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    neutral: {
      accent: '#475467',
      accentSoft: 'rgba(71, 84, 103, 0.08)',
      border: 'rgba(148, 163, 184, 0.22)',
      surface: '#ffffff',
    },
    client: {
      accent: '#0f766e',
      accentSoft: 'rgba(15, 118, 110, 0.08)',
      border: 'rgba(148, 163, 184, 0.22)',
      surface: '#ffffff',
    },
    server: {
      accent: '#b45309',
      accentSoft: 'rgba(180, 83, 9, 0.08)',
      border: 'rgba(148, 163, 184, 0.22)',
      surface: '#ffffff',
    },
  },
  syntax: {
    punctuation: '#059669',
    keywordVariable: '#2563EB',
    keywordVariableTable: '#059669',
    keywordStep: '#D97706',
    keywordReference: '#0891B2',
    variable: '#7C3AED',
    type: '#6D28D9',
    parameter: '#7C3AED',
    delimiterStrong: '#6B7280',
    delimiterMuted: '#9CA3AF',
    string: '#059669',
    number: '#0D9488',
    boolean: '#1D4ED8',
    subvars: '#5B21B6',
  },
}

export const defaultDark: AimdThemeTokens = {
  mode: 'dark',
  text: {
    primary: '#e2e8f0',
    muted: '#94a3b8',
    subtle: '#7b8ea3',
    strong: '#f8fafc',
  },
  border: {
    default: '#334155',
    muted: '#2a3441',
    strong: '#475569',
  },
  focus: '#60a5fa',
  surface: {
    canvas: '#0f172a',
    panel: '#111827',
    panelRaised: '#111827',
    panelSubtle: '#1f2937',
    editor: '#111827',
    overlay: 'rgba(17, 24, 39, 0.96)',
  },
  state: {
    brand: {
      background: '#132742',
      border: '#315b94',
      text: '#b8d4ff',
      scopeBackground: '#1a3558',
      scopeText: '#c7dcff',
      mutedText: '#91b4e8',
    },
    info: {
      background: '#142234',
      border: '#425770',
      text: '#d9e4f1',
      scopeBackground: '#1c3149',
      scopeText: '#9bc2ff',
      mutedText: '#9fb0c5',
    },
    success: {
      background: '#13281f',
      border: '#2f6f53',
      text: '#c8f1dd',
      scopeBackground: '#183325',
      scopeText: '#87deb0',
      mutedText: '#8bb49b',
    },
    warning: {
      background: '#332314',
      border: '#8f6132',
      text: '#ffd7aa',
      scopeBackground: '#45301c',
      scopeText: '#ffcf84',
      mutedText: '#d5b082',
    },
    danger: {
      background: '#341720',
      border: '#994660',
      text: '#ffc1d0',
      scopeBackground: '#431d29',
      scopeText: '#ff9eb8',
      mutedText: '#e595aa',
    },
    var: {
      background: '#14263e',
      border: '#3d6aa6',
      text: '#abd2ff',
      scopeBackground: '#1b3560',
      scopeText: '#8ec4ff',
      mutedText: '#d7a9ff',
    },
    varTable: {
      background: '#14261b',
      border: '#3a7a56',
      text: '#bfe9cb',
      scopeBackground: '#1b3526',
      scopeText: '#8cd3a1',
      mutedText: '#a8b7ad',
    },
    step: {
      background: '#35220f',
      border: '#a96f2e',
      text: '#ffd3a0',
      scopeBackground: '#432c15',
      scopeText: '#ffc37a',
      mutedText: '#cbaa86',
    },
    check: {
      background: '#1e293b',
      border: '#42536a',
      text: '#e2e8f0',
      scopeBackground: '#2a3950',
      scopeText: '#bfd0e5',
      mutedText: '#9fb0c5',
    },
    quiz: {
      background: '#342814',
      border: '#a68538',
      text: '#ffe7b0',
      scopeBackground: '#45351a',
      scopeText: '#ffd88a',
      mutedText: '#d6b77d',
      placeholderBackground: '#3d3118',
      placeholderBorder: '#d89c2a',
      rubricBackground: '#3b2f1f',
      rubricBorder: '#c88c52',
    },
  },
  codeBlock: {
    title: '#f8fafc',
    meta: '#94a3b8',
    text: '#e2e8f0',
    rule: 'rgba(148, 163, 184, 0.22)',
    shell: '#111827',
    chipText: '#cbd5e1',
    chipSurface: '#1f2937',
    headerSurface: '#111827',
    flowSurface: '#0f172a',
    shadow: '0 1px 2px rgba(2, 6, 23, 0.28)',
    neutral: {
      accent: '#cbd5e1',
      accentSoft: 'rgba(148, 163, 184, 0.16)',
      border: 'rgba(148, 163, 184, 0.24)',
      surface: '#111827',
    },
    client: {
      accent: '#5eead4',
      accentSoft: 'rgba(45, 212, 191, 0.14)',
      border: 'rgba(148, 163, 184, 0.24)',
      surface: '#111827',
    },
    server: {
      accent: '#fbbf24',
      accentSoft: 'rgba(251, 191, 36, 0.14)',
      border: 'rgba(148, 163, 184, 0.24)',
      surface: '#111827',
    },
  },
  syntax: {
    punctuation: '#34D399',
    keywordVariable: '#60A5FA',
    keywordVariableTable: '#34D399',
    keywordStep: '#FBBF24',
    keywordReference: '#22D3EE',
    variable: '#C084FC',
    type: '#A78BFA',
    parameter: '#C084FC',
    delimiterStrong: '#CBD5E1',
    delimiterMuted: '#94A3B8',
    string: '#6EE7B7',
    number: '#5EEAD4',
    boolean: '#93C5FD',
    subvars: '#C4B5FD',
  },
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeThemeRecord<T>(base: T, override?: PartialRecord<T>): T {
  if (!override) {
    return { ...(base as object) } as T
  }

  const result: Record<string, unknown> = { ...(base as object) }
  for (const [key, value] of Object.entries(override as object)) {
    if (value === undefined) {
      continue
    }

    const baseValue = result[key]
    if (isPlainRecord(baseValue) && isPlainRecord(value)) {
      result[key] = mergeThemeRecord(baseValue, value)
      continue
    }

    result[key] = value
  }

  return result as T
}

export function resolveAimdTheme(theme?: AimdThemeInput): AimdThemeTokens {
  if (!theme) {
    return defaultLight
  }

  const base = theme.mode === 'dark' ? defaultDark : defaultLight
  return mergeThemeRecord(base, theme)
}

function mapStateVars(prefix: string, state: AimdSemanticStateTokens): Record<string, string> {
  return {
    [`--aimd-${prefix}-bg`]: state.background,
    [`--aimd-${prefix}-border`]: state.border,
    [`--aimd-${prefix}-text`]: state.text,
    ...(state.scopeBackground ? { [`--aimd-${prefix}-scope-bg`]: state.scopeBackground } : {}),
    ...(state.scopeText ? { [`--aimd-${prefix}-scope-text`]: state.scopeText } : {}),
    ...(state.mutedText ? { [`--aimd-${prefix}-muted-text`]: state.mutedText } : {}),
  }
}

export function createCssVars(themeInput?: AimdThemeInput): Record<string, string> {
  const theme = resolveAimdTheme(themeInput)

  return {
    '--aimd-color-text': theme.text.primary,
    '--aimd-color-text-muted': theme.text.muted,
    '--aimd-color-text-subtle': theme.text.subtle,
    '--aimd-color-text-strong': theme.text.strong,
    '--aimd-border-default': theme.border.default,
    '--aimd-border-muted': theme.border.muted,
    '--aimd-border-strong': theme.border.strong,
    '--aimd-color-focus': theme.focus,
    '--aimd-surface-canvas': theme.surface.canvas,
    '--aimd-surface-panel': theme.surface.panel,
    '--aimd-surface-panel-raised': theme.surface.panelRaised,
    '--aimd-surface-panel-subtle': theme.surface.panelSubtle,
    '--aimd-surface-editor': theme.surface.editor,
    '--aimd-surface-overlay': theme.surface.overlay,
    '--aimd-code-title': theme.codeBlock.title,
    '--aimd-code-meta': theme.codeBlock.meta,
    '--aimd-code-text': theme.codeBlock.text,
    '--aimd-code-rule': theme.codeBlock.rule,
    '--aimd-code-shell': theme.codeBlock.shell,
    '--aimd-code-chip-text': theme.codeBlock.chipText,
    '--aimd-code-chip-surface': theme.codeBlock.chipSurface,
    '--aimd-code-header-surface': theme.codeBlock.headerSurface,
    '--aimd-code-flow-surface': theme.codeBlock.flowSurface,
    '--aimd-code-shadow': theme.codeBlock.shadow,
    '--aimd-code-neutral-accent': theme.codeBlock.neutral.accent,
    '--aimd-code-neutral-accent-soft': theme.codeBlock.neutral.accentSoft,
    '--aimd-code-neutral-border': theme.codeBlock.neutral.border,
    '--aimd-code-neutral-surface': theme.codeBlock.neutral.surface,
    '--aimd-code-client-accent': theme.codeBlock.client.accent,
    '--aimd-code-client-accent-soft': theme.codeBlock.client.accentSoft,
    '--aimd-code-client-border': theme.codeBlock.client.border,
    '--aimd-code-client-surface': theme.codeBlock.client.surface,
    '--aimd-code-server-accent': theme.codeBlock.server.accent,
    '--aimd-code-server-accent-soft': theme.codeBlock.server.accentSoft,
    '--aimd-code-server-border': theme.codeBlock.server.border,
    '--aimd-code-server-surface': theme.codeBlock.server.surface,
    ...mapStateVars('state-brand', theme.state.brand),
    ...mapStateVars('state-info', theme.state.info),
    ...mapStateVars('state-success', theme.state.success),
    ...mapStateVars('state-warning', theme.state.warning),
    ...mapStateVars('state-danger', theme.state.danger),
    ...mapStateVars('state-var', theme.state.var),
    ...mapStateVars('state-var-table', theme.state.varTable),
    ...mapStateVars('state-step', theme.state.step),
    ...mapStateVars('state-check', theme.state.check),
    ...mapStateVars('state-quiz', theme.state.quiz),
    '--aimd-state-quiz-placeholder-bg': theme.state.quiz.placeholderBackground,
    '--aimd-state-quiz-placeholder-border': theme.state.quiz.placeholderBorder,
    '--aimd-state-quiz-rubric-bg': theme.state.quiz.rubricBackground,
    '--aimd-state-quiz-rubric-border': theme.state.quiz.rubricBorder,

    // Recorder legacy aliases
    '--rec-text': theme.text.primary,
    '--rec-muted': theme.text.muted,
    '--rec-border': theme.border.muted,
    '--rec-focus': theme.focus,
    '--rec-error': theme.state.danger.text,
    '--aimd-border-color': theme.state.var.border,
    '--aimd-border-color-focus': theme.focus,
    '--aimd-var-bg': theme.state.var.background,
    '--aimd-var-scope-bg': theme.state.var.scopeBackground || theme.state.var.background,
    '--aimd-var-text': theme.state.var.text,
    '--aimd-var-scope-text': theme.state.var.scopeText || theme.state.var.text,
  }
}

function withItalic(scope: string | string[], foreground: string): AimdSyntaxTokenColor {
  return {
    scope,
    settings: {
      foreground,
      fontStyle: 'italic',
    },
  }
}

export function createAimdSyntaxTokenColors(
  scopes: AimdSyntaxScopes,
  themeInput?: AimdThemeInput,
): AimdSyntaxTokenColor[] {
  const theme = resolveAimdTheme(themeInput)
  const syntax = theme.syntax

  return [
    {
      scope: scopes.punctuation,
      settings: { foreground: syntax.punctuation },
    },
    withItalic(scopes.variableKeyword, syntax.keywordVariable),
    withItalic(scopes.variableTableKeyword, syntax.keywordVariableTable),
    withItalic(scopes.stepKeyword, syntax.keywordStep),
    withItalic(scopes.referenceKeyword, syntax.keywordReference),
    {
      scope: scopes.variable,
      settings: { foreground: syntax.variable },
    },
    withItalic(scopes.type, syntax.type),
    {
      scope: scopes.parameter,
      settings: {
        foreground: syntax.parameter,
        fontStyle: 'bold',
      },
    },
    {
      scope: scopes.delimiterStrong,
      settings: { foreground: syntax.delimiterStrong },
    },
    {
      scope: scopes.delimiterMuted,
      settings: { foreground: syntax.delimiterMuted },
    },
    {
      scope: scopes.string,
      settings: { foreground: syntax.string },
    },
    {
      scope: scopes.number,
      settings: { foreground: syntax.number },
    },
    {
      scope: scopes.boolean,
      settings: { foreground: syntax.boolean },
    },
    {
      scope: scopes.subvars,
      settings: {
        foreground: syntax.subvars,
        fontStyle: 'bold',
      },
    },
  ]
}

export function createAimdSyntaxTheme(
  scopes: AimdSyntaxScopes,
  themeInput?: AimdThemeInput,
  name = 'aimd-theme',
): AimdSyntaxThemeRegistration {
  const theme = resolveAimdTheme(themeInput)

  return {
    name,
    type: theme.mode,
    settings: createAimdSyntaxTokenColors(scopes, theme),
    colors: {},
  }
}
