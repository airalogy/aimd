/**
 * @airalogy/aimd-core
 *
 * Core AIMD (Airalogy Markdown) parser and syntax definitions
 *
 * This package provides:
 * - AIMD syntax parsing (remark plugin)
 * - Type definitions for AIMD nodes
 * - Syntax highlighting grammar (TextMate/Shiki)
 * - Utility functions for AIMD manipulation
 */

// Parser exports
export { default as remarkAimd } from './parser/remark-aimd'
export { default as rehypeAimd } from './parser/rehype-aimd'
export { DOM_ATTR_NAME, type DomAttrName } from './parser/constants'

// Type exports
export type {
  // AIMD unified types (canonical types for AIMD parsing)
  AimdCheckField,
  AimdFieldType,
  AimdRefField,
  AimdScopeKey,
  AimdScopeName,
  AimdStepField,
  AimdSubvar,
  AimdTableLink,
  AimdTemplateEnv,
  AimdVarField,
  AimdVarTableField,
  AimdVarType,
  ExtractedAimdFields,
  LegacyFieldsFormat,
} from './types/aimd'

export type {
  // Node types
  AimdCheckNode,
  AimdCiteNode,
  AimdFigNode,
  AimdNode,
  AimdRefNode,
  AimdScope,
  AimdStepNode,
  AimdVarDefinition,
  AimdVarNode,
  AimdVarTableNode,
  BaseNode,
  IndentNode,
} from './types/nodes'

export type {
  // Compatibility types for business logic
  FieldKey,
  FieldRecord,
  FieldResponseKey,
  FiledName,
  IAnnotationDataItem,
  IDynamicTableNode,
  IFieldItem,
  IFileDataItem,
  IRecordData,
  IRecordDataItem,
  IRecordDataKey,
  ScopeFieldKey,
} from './types/aimd'

// Syntax exports (for editor highlighting)
export {
  AIMD_SCOPES,
  aimdInjection,
  aimdLanguage,
  aimdTheme as aimdSyntaxTheme,
} from './syntax/aimd-grammar'

// Utility exports
export {
  findVarTable,
  getSubvarDef,
  getSubvarNames,
  hasSubvars,
  isVarTableField,
  mergeVarTableInfo,
  normalizeSubvars,
  toLegacyFieldsFormat,
  toTemplateEnv,
} from './utils/aimd-utils'
