/**
 * AIMD (Airalogy Interactive Markdown) Unified Type Definitions
 *
 * This file defines the canonical types for AIMD field parsing.
 * All AIMD-related code should use these types to ensure consistency.
 */

// ===== Base Types for Compatibility =====

/**
 * Scope field key (for referencing fields)
 */
export type ScopeFieldKey = `${AimdScopeKey}:${string}`

/**
 * Field key type
 */
export type FieldKey = string

/**
 * Field response key
 */
export type FieldResponseKey = string

/**
 * Field name type
 */
export type FiledName = string

/**
 * Record data key
 */
export type IRecordDataKey = string

/**
 * Record data item
 */
export interface IRecordDataItem {
  [key: string]: unknown
}

/**
 * Record data structure
 */
export interface IRecordData {
  [key: string]: IRecordDataItem
}

/**
 * Field item
 */
export interface IFieldItem {
  name: string
  type?: string
  [key: string]: unknown
}

/**
 * File data item
 */
export interface IFileDataItem {
  name: string
  url: string
  size?: number
  [key: string]: unknown
}

/**
 * Annotation data item
 */
export interface IAnnotationDataItem {
  id: string
  content: string
  [key: string]: unknown
}

/**
 * Dynamic table node
 */
export interface IDynamicTableNode {
  name: string
  columns: string[]
  rows?: unknown[][]
  [key: string]: unknown
}

/**
 * Field record
 */
export interface FieldRecord {
  [key: string]: unknown
}

/**
 * Extract result
 */
export interface ExtractResult {
  fields: ExtractedAimdFields
  [key: string]: unknown
}

// ===== AIMD-Specific Types =====

/**
 * Scope keys used in AIMD
 */
export type AimdScopeKey =
  | "var"
  | "var_table"
  | "quiz"
  | "step"
  | "check"
  | "ref_step"
  | "ref_var"
  | "ref_fig"
  | "cite"
  | "fig"

/**
 * High-level scope names for semantic grouping
 */
export type AimdScopeName =
  | "var"
  | "step"
  | "check"
  | "quiz"
  | "workflow"

/**
 * AIMD field types
 */
export type AimdFieldType =
  | "var"
  | "var_table"
  | "quiz"
  | "step"
  | "check"
  | "ref_step"
  | "ref_var"
  | "ref_fig"
  | "cite"
  | "fig"

/**
 * Variable type annotation (e.g., str, int, float, bool, list)
 */
export type AimdVarType = "str" | "int" | "float" | "bool" | "list" | "date" | "file" | string

/**
 * Subvar definition for var_table
 * This is the canonical format - all subvars should be normalized to this
 */
export interface AimdSubvar {
  /** Column/field name */
  name: string
  /** Type annotation (str, int, float, bool, etc.) */
  type?: AimdVarType
  /** Default value */
  default?: unknown
  /** Display title */
  title?: string
  /** Description/tooltip */
  description?: string
  /** Additional kwargs from AIMD syntax */
  kwargs?: Record<string, unknown>
  /** Position info from parser */
  start_line?: number
  end_line?: number
  start_col?: number
  end_col?: number
}

/**
 * Table link definition for linked tables
 */
export interface AimdTableLink {
  source: {
    name: string
    prop: string
  }
  target: {
    name: string
    prop: string
  }
  isSource: boolean
}

/**
 * Var table field definition
 */
export interface AimdVarTableField {
  /** Table name */
  name: string
  /** Scope key */
  scope: "var_table"
  /** Column definitions - always use AimdSubvar[] format */
  subvars: AimdSubvar[]
  /** Table link for linked tables */
  link?: AimdTableLink
  /** Type annotation (e.g., list, list[CustomType]) */
  type_annotation?: string
  /** Auto-generated item type name */
  auto_item_type?: string | null
  /** Explicit list item type */
  list_item_type?: string | null
  /** Position info */
  start_line?: number
  end_line?: number
  start_col?: number
  end_col?: number
}

/**
 * Simple var field definition
 */
export interface AimdVarField {
  /** Variable name */
  name: string
  /** Type annotation */
  type?: AimdVarType
  /** Default value */
  default?: unknown
  /** Display title */
  title?: string
  /** Description */
  description?: string
}

/**
 * Quiz type
 */
export type AimdQuizType = "choice" | "blank" | "open"

/**
 * Choice mode for choice quiz
 */
export type AimdQuizMode = "single" | "multiple"

/**
 * Choice option definition
 */
export interface AimdQuizOption {
  key: string
  text: string
}

/**
 * Blank item definition
 */
export interface AimdQuizBlank {
  key: string
  answer: string
}

/**
 * Quiz field definition
 */
export interface AimdQuizField {
  /** Quiz id (also used as field key) */
  id: string
  /** Quiz type */
  type: AimdQuizType
  /** Question stem */
  stem: string
  /** Optional score */
  score?: number
  /** Choice mode */
  mode?: AimdQuizMode
  /** Choice options */
  options?: AimdQuizOption[]
  /** Standard answer */
  answer?: string | string[]
  /** Blank definitions */
  blanks?: AimdQuizBlank[]
  /** Open question rubric */
  rubric?: string
  /** Optional default value */
  default?: unknown
  /** Extra unreserved metadata */
  extra?: Record<string, unknown>
}

/**
 * Step field definition
 */
export interface AimdStepField {
  /** Step name/id */
  name: string
  /** Step number */
  step?: number
  /** Indentation level */
  level?: number
  /** Has check checkbox */
  hasCheck?: boolean
  /** Parent step name */
  parentName?: string
  /** Previous step name */
  prevName?: string
}

/**
 * Check field definition
 */
export interface AimdCheckField {
  /** Checkpoint name */
  name: string
}

/**
 * Reference field definition
 */
export interface AimdRefField {
  /** Reference name */
  name: string
  /** Reference type */
  type: "ref_step" | "ref_var" | "ref_fig"
}

/**
 * Figure field definition
 */
export interface AimdFigField {
  /** Figure ID (short ID used in references) */
  id: string
  /** Image source (local path, URL, or Airalogy file ID) */
  src: string
  /** Figure title (optional but recommended) */
  title?: string
  /** Figure legend/caption (optional but recommended) */
  legend?: string
  /** Figure sequence number (auto-generated during rendering) */
  sequence?: number
}

/**
 * Extracted AIMD fields from markdown
 * This is the canonical output format from remark-aimd
 */
export interface ExtractedAimdFields {
  /** Simple variables */
  var: string[]
  /** Variable tables with full definitions */
  var_table: AimdVarTableField[]
  /** Quiz definitions from ```quiz code blocks */
  quiz: AimdQuizField[]
  /** Steps */
  step: string[]
  /** Checkpoints */
  check: string[]
  /** Step references */
  ref_step: string[]
  /** Variable references */
  ref_var: string[]
  /** Figure references */
  ref_fig?: string[]
  /** Citations */
  cite?: string[]
  /** Figures with full definitions */
  fig?: AimdFigField[]
  /** Step hierarchy for nested steps */
  stepHierarchy?: AimdStepField[]
}

/**
 * Template environment with extracted fields
 * Used for passing data between components
 */
export interface AimdTemplateEnv {
  /** Extracted fields */
  fields: ExtractedAimdFields
  /** Typed field definitions from backend */
  typed?: Record<string, Record<string, Record<string, unknown>>>
  /** Record data for steps and refs */
  record?: {
    byName: Record<string, unknown>
    byLevel: Record<number, unknown[]>
    byScope: Record<string, Record<string, unknown>>
  }
  /** Table definitions for var_table */
  tables?: Array<[string, AimdVarTableField]>
  /** Reference definitions */
  refs?: {
    ref_step: Array<{ name: string, line: number, sequence: number }>
    ref_var: Array<{ name: string, line: number, sequence: number }>
  }
}
