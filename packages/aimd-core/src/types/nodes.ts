/**
 * Core AIMD Node Types
 * 
 * These types represent the parsed AIMD syntax nodes.
 * Business-specific types should remain in the application layer.
 */

/**
 * AIMD field types
 */
export type AimdFieldType = "var" | "var_table" | "step" | "check" | "ref_step" | "ref_var" | "ref_fig" | "cite" | "fig"

/**
 * AIMD scopes
 */
export type AimdScope = "rv" | "rs" | "rc" | "rt" | "rf" | "cite"

/**
 * AIMD variable definition
 */
export interface AimdVarDefinition {
  id: string
  type?: string
  default?: string | number | boolean | null
  required?: boolean
  subvars?: Record<string, AimdVarDefinition>
  /** Additional kwargs like pattern, title, description, etc. */
  kwargs?: Record<string, string | number | boolean>
}

/**
 * AIMD node base type
 */
export interface BaseNode {
  type: "aimd"
  fieldType: AimdFieldType
  name: string
  scope: AimdScope
  raw: string
}

/**
 * AIMD variable node
 */
export interface AimdVarNode extends BaseNode {
  fieldType: "var"
  definition?: AimdVarDefinition
}

/**
 * AIMD table variable node
 */
export interface AimdVarTableNode extends BaseNode {
  fieldType: "var_table"
  columns: string[]
  definition?: AimdVarDefinition
}

/**
 * Indent node (for step hierarchy)
 */
export interface IndentNode {
  parent?: IndentNode
  sequence: number
  level: number
}

/**
 * AIMD step node with hierarchy information
 */
export interface AimdStepNode extends BaseNode {
  fieldType: "step"
  /** Step level (1-3 per AIMD spec) */
  level: number
  /** Step sequence within its level (0-based) */
  sequence: number
  /** Final display indent (e.g., "1.2.3") */
  step: string
  /** Parent step name (if any) */
  parentName?: string
  /** Previous sibling step name (if any) */
  prevName?: string
  /** Next sibling step name (if any) */
  nextName?: string
  /** Whether this step has children */
  hasChildren?: boolean
  /** Whether this step has a checkbox (check=True in AIMD) */
  check?: boolean
  /** Message to display when step is checked */
  checkedMessage?: string
  /** Parent node reference (for hierarchy) */
  parent?: IndentNode
}

/**
 * AIMD checkpoint node
 */
export interface AimdCheckNode extends BaseNode {
  fieldType: "check"
  /** Display label for the checkpoint */
  label?: string
  /** Message to display when checkpoint is checked */
  checkedMessage?: string
}

/**
 * AIMD reference node
 */
export interface AimdRefNode extends BaseNode {
  fieldType: "ref_step" | "ref_var" | "ref_fig"
  refTarget: string
}

/**
 * AIMD citation node
 */
export interface AimdCiteNode extends BaseNode {
  fieldType: "cite"
  /** Citation references (comma-separated in source) */
  refs: string[]
}

/**
 * AIMD figure node
 */
export interface AimdFigNode extends BaseNode {
  fieldType: "fig"
  /** Figure ID (used for references) */
  id: string
  /** Image source (local path, URL, or Airalogy file ID) */
  src: string
  /** Figure title (optional but recommended) */
  title?: string
  /** Figure legend/caption (optional but recommended) */
  legend?: string
  /** Figure sequence number (auto-generated) */
  sequence?: number
}

/**
 * Union type of all AIMD nodes
 */
export type AimdNode = 
  | AimdVarNode 
  | AimdVarTableNode 
  | AimdStepNode 
  | AimdCheckNode 
  | AimdRefNode 
  | AimdCiteNode 
  | AimdFigNode

/**
 * Processor options
 */
export interface ProcessorOptions {
  mode?: "preview" | "edit" | "report"
  gfm?: boolean
  math?: boolean
  sanitize?: boolean
  /** Enable single line break to <br> conversion (default: true for AIMD) */
  breaks?: boolean
}

/**
 * Render context
 */
export interface RenderContext {
  mode: "preview" | "edit" | "report"
  value?: Record<string, Record<string, unknown>>
  readonly?: boolean
}

/**
 * Render modes
 */
export type RenderMode = "preview" | "edit" | "report"

/**
 * Render node
 */
export interface RenderNode {
  type: string
  [key: string]: unknown
}

/**
 * Token render rule (for compatibility)
 */
export type TokenRenderRule = (node: AimdNode, ctx: RenderContext) => unknown

// Note: The following types are re-exported for compatibility
// but their actual implementations remain in the application layer
export type {
  ExtractedAimdFields,
  AimdVarTableField,
  AimdVarField,
  AimdStepField,
  AimdCheckField,
  AimdRefField,
  AimdFigField,
} from './aimd'
