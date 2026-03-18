/**
 * Parser exports
 */

export { default as remarkAimd } from './remark-aimd'
export { default as rehypeAimd } from './rehype-aimd'
export { validateClientAssignerFunctionSource } from './client-assigner-syntax'
export { validateVarDefaultType } from './field-parsers'
export {
  protectAimdInlineTemplates,
  restoreAimdInlineTemplates,
  type AimdInlineTemplateMap,
  type ProtectedAimdInlineTemplates,
} from './inline-template-protection'
export { DOM_ATTR_NAME, type DomAttrName } from './constants'
