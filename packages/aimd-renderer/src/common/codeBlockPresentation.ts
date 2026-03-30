import { resolveAimdTheme, type AimdThemeInput } from '@airalogy/aimd-theme'

export type CodeBlockTone = "neutral" | "client" | "server"

export interface CodeBlockPresentation {
  containerStyle: string
  headerStyle: string
  headerMainStyle: string
  titleStyle: string
  metaStyle: string
  badgeStyle: string
  bodyStyle: string
  preShellStyle: string
  preStyle: string
  codeStyle: string
  flowStyle: string
  flowGroupStyle: string
  flowLabelStyle: string
  flowListStyle: string
  flowChipStyle: string
  flowArrowStyle: string
}

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

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function buildInlineStyle(declarations: Record<string, string>): string {
  return Object.entries(declarations)
    .map(([property, value]) => `${property}:${value}`)
    .join(";")
}

export function normalizeCodeLanguage(value: string | null | undefined): string {
  const normalized = String(value || "").trim().toLowerCase()
  return normalized || "text"
}

export function resolveCodeLanguageLabel(value: string | null | undefined): string {
  const normalized = normalizeCodeLanguage(value)
  return LANGUAGE_LABELS[normalized] ?? normalized.replace(/[-_]+/g, " ").replace(/\b\w/g, char => char.toUpperCase())
}

export function resolveCodeLanguageBadge(value: string | null | undefined): string {
  const normalized = normalizeCodeLanguage(value)
  return LANGUAGE_BADGES[normalized] ?? normalized.slice(0, 6).toUpperCase()
}

function uniqueStrings(values: string[]): string[] {
  const normalized = values
    .map(value => value.trim())
    .filter(Boolean)

  return [...new Set(normalized)]
}

function extractQuotedValues(source: string, fieldName: string): string[] {
  const match = source.match(new RegExp(`${fieldName}\\s*[:=]\\s*\\[([\\s\\S]*?)\\]`, "m"))
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

export function extractAssignerFieldSummary(source: string): {
  dependentFields: string[]
  assignedFields: string[]
} {
  const dependentFields = extractQuotedValues(source, "dependent_fields")
  const assignedFields = uniqueStrings([
    ...extractQuotedValues(source, "assigned_fields"),
    ...extractReturnedObjectKeys(source),
  ])

  return {
    dependentFields,
    assignedFields,
  }
}

export function getCodeBlockPresentation(
  tone: CodeBlockTone = "neutral",
  themeInput?: AimdThemeInput,
): CodeBlockPresentation {
  const theme = resolveAimdTheme(themeInput)
  const toneTokens = theme.codeBlock[tone]
  const accent = toneTokens.accent
  const accentSoft = toneTokens.accentSoft
  const border = toneTokens.border
  const rule = theme.codeBlock.rule
  const surface = toneTokens.surface

  return {
    containerStyle: buildInlineStyle({
      margin: "1rem 0",
      border: `1px solid ${border}`,
      "border-radius": "18px",
      overflow: "hidden",
      background: surface,
      "box-shadow": theme.codeBlock.shadow,
    }),
    headerStyle: buildInlineStyle({
      display: "flex",
      "align-items": "flex-start",
      "justify-content": "space-between",
      gap: "0.85rem",
      padding: "0.85rem 1rem 0.8rem",
      background: theme.codeBlock.headerSurface,
      "border-bottom": `1px solid ${rule}`,
    }),
    headerMainStyle: buildInlineStyle({
      display: "flex",
      "flex-direction": "column",
      gap: "0.3rem",
      "min-width": "0",
    }),
    titleStyle: buildInlineStyle({
      color: theme.codeBlock.title,
      "font-size": "0.95rem",
      "font-weight": "700",
      "line-height": "1.3",
      "letter-spacing": "-0.01em",
    }),
    metaStyle: buildInlineStyle({
      color: theme.codeBlock.meta,
      "font-size": "0.76rem",
      "font-weight": "600",
      "line-height": "1.4",
      "letter-spacing": "0.04em",
      "text-transform": "uppercase",
    }),
    badgeStyle: buildInlineStyle({
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      padding: "0.2rem 0.55rem",
      "border-radius": "999px",
      border: `1px solid ${border}`,
      background: accentSoft,
      color: accent,
      "font-size": "0.72rem",
      "font-weight": "800",
      "letter-spacing": "0.08em",
      "text-transform": "uppercase",
      "white-space": "nowrap",
    }),
    bodyStyle: buildInlineStyle({
      display: "flex",
      "flex-direction": "column",
      gap: "0",
    }),
    preShellStyle: buildInlineStyle({
      overflow: "auto",
      background: theme.codeBlock.shell,
    }),
    preStyle: buildInlineStyle({
      margin: "0",
      padding: "0.95rem 1rem 1rem",
      "font-size": "0.88rem",
      "line-height": "1.65",
      "tab-size": "2",
    }),
    codeStyle: buildInlineStyle({
      display: "block",
      color: theme.codeBlock.text,
      background: "transparent",
      "font-family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
      "font-size": "0.88rem",
      "line-height": "1.65",
      "white-space": "pre",
      padding: "0",
    }),
    flowStyle: buildInlineStyle({
      display: "flex",
      "align-items": "center",
      gap: "0.55rem",
      "flex-wrap": "wrap",
      padding: "0 1rem 0.8rem",
      background: theme.codeBlock.flowSurface,
      "border-bottom": `1px solid ${rule}`,
    }),
    flowGroupStyle: buildInlineStyle({
      display: "inline-flex",
      "align-items": "center",
      gap: "0.45rem",
      "flex-wrap": "wrap",
      "min-width": "0",
    }),
    flowLabelStyle: buildInlineStyle({
      color: theme.codeBlock.meta,
      "font-size": "0.72rem",
      "font-weight": "700",
      "letter-spacing": "0.08em",
      "text-transform": "uppercase",
      "white-space": "nowrap",
    }),
    flowListStyle: buildInlineStyle({
      display: "inline-flex",
      "align-items": "center",
      gap: "0.35rem",
      "flex-wrap": "wrap",
    }),
    flowChipStyle: buildInlineStyle({
      display: "inline-flex",
      "align-items": "center",
      padding: "0.18rem 0.45rem",
      "border-radius": "999px",
      background: theme.codeBlock.chipSurface,
      border: `1px solid ${border}`,
      color: theme.codeBlock.chipText,
      "font-size": "0.76rem",
      "font-weight": "600",
      "line-height": "1.25",
    }),
    flowArrowStyle: buildInlineStyle({
      color: accent,
      "font-size": "0.9rem",
      "font-weight": "700",
      "letter-spacing": "0.04em",
      "white-space": "nowrap",
    }),
  }
}

export function decorateHighlightedCodeHtml(
  html: string,
  presentation: Pick<CodeBlockPresentation, "preStyle">,
): string {
  const preStyle = `${presentation.preStyle};background:transparent`
  if (/<pre\b[^>]*style="/.test(html)) {
    return html.replace(/<pre\b([^>]*)style="([^"]*)"/, `<pre$1style="${preStyle};$2"`)
  }

  return html.replace(/<pre\b/, `<pre style="${preStyle}"`)
}

function renderFlowGroupHtml(
  label: string,
  values: string[],
  presentation: CodeBlockPresentation,
): string {
  if (values.length === 0) {
    return ""
  }

  return `<span class="aimd-assigner-preview__group" style="${presentation.flowGroupStyle}">`
    + `<span class="aimd-assigner-preview__group-label" style="${presentation.flowLabelStyle}">${escapeHtml(label)}</span>`
    + `<span class="aimd-assigner-preview__group-list" style="${presentation.flowListStyle}">`
    + values.map(value =>
      `<span class="aimd-assigner-preview__chip" style="${presentation.flowChipStyle}">${escapeHtml(value)}</span>`,
    ).join("")
    + "</span>"
    + "</span>"
}

export function renderAssignerFlowHtml(
  source: string,
  presentation: CodeBlockPresentation,
): string {
  const { dependentFields, assignedFields } = extractAssignerFieldSummary(source)
  if (dependentFields.length === 0 && assignedFields.length === 0) {
    return ""
  }

  const sections = [
    renderFlowGroupHtml("Reads", dependentFields, presentation),
    dependentFields.length > 0 || assignedFields.length > 0
      ? `<span aria-hidden="true" class="aimd-assigner-preview__arrow" style="${presentation.flowArrowStyle}">→ ƒ →</span>`
      : "",
    renderFlowGroupHtml("Writes", assignedFields, presentation),
  ].filter(Boolean)

  return `<div class="aimd-assigner-preview__flow" style="${presentation.flowStyle}">${sections.join("")}</div>`
}
