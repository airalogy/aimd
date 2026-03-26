const AIMD_INLINE_TEMPLATE_PATTERN = /\{\{(var_table|var|step|check|ref_step|ref_var|ref_fig|cite)\s*\|[^}]+?\}\}/g
const MARKDOWN_ESCAPABLE_PATTERN = /\\([\\!"#$%&'()*+,./:;<=>?@[\\\]^_`{|}~-])/g

function normalizeSingleAimdInlineTemplate(template: string): string {
  return template.replace(MARKDOWN_ESCAPABLE_PATTERN, '$1')
}

export function normalizeAimdInlineTemplateMarkdownEscapes(content: string): string {
  return content.replace(AIMD_INLINE_TEMPLATE_PATTERN, normalizeSingleAimdInlineTemplate)
}
