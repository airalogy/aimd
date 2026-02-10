import type { Code, PhrasingContent, Root, Text } from "mdast"
import type { Plugin } from "unified"
import type {
  AimdCheckNode,
  AimdCiteNode,
  AimdFieldType,
  AimdFigNode,
  AimdNode,
  AimdScope,
  AimdStepNode,
  AimdVarDefinition,
  AimdVarNode,
  AimdVarTableNode,
} from "../types/nodes"
import type { ExtractedAimdFields } from "../types/aimd"
import { SKIP, visit } from "unist-util-visit"

/**
 * Scope mapping
 */
const SCOPE_MAP: Record<AimdFieldType, AimdScope> = {
  var: "rv",
  var_table: "rt",
  step: "rs",
  check: "rc",
  ref_step: "rs",
  ref_var: "rv",
  ref_fig: "rf",
  cite: "cite",
  fig: "rf",
}

/**
 * Step context for building hierarchy
 */
interface StepContext {
  /** Steps organized by level */
  byLevel: Map<number, AimdStepNode[]>
  /** Steps indexed by name */
  byName: Map<string, AimdStepNode>
  /** All steps in order */
  allSteps: AimdStepNode[]
}

/**
 * Create initial step context
 */
function createStepContext(): StepContext {
  return {
    byLevel: new Map(),
    byName: new Map(),
    allSteps: [],
  }
}

/**
 * Parse key-value parameters from content
 * Handles formats like: key=value, key="value", key='value'
 */
function parseKeyValueParams(content: string): Record<string, string | boolean | number> {
  const params: Record<string, string | boolean | number> = {}
  // Match key=value, key="value", key='value', or key=r"value" (Python raw string)
  const kvPattern = /(\w+)\s*=\s*(?:r?"([^"]*)"|r?'([^']*)'|(\S+?)(?=,|$|\s))/g
  let match: RegExpExecArray | null = kvPattern.exec(content)

  while (match !== null) {
    const key = match[1]
    let value = match[2] ?? match[3] ?? match[4]

    // Remove Python raw string prefix if present
    if (value && typeof value === "string") {
      // If the original match included r" or r', the value is already extracted without r
      // But we need to handle the case where it's in match[4]
      if (match[4] && match[4].startsWith("r\"")) {
        value = match[4].slice(2, -1) // Remove r" and trailing "
      }
      else if (match[4] && match[4].startsWith("r'")) {
        value = match[4].slice(2, -1) // Remove r' and trailing '
      }
    }

    // Parse boolean
    if (value === "True" || value === "true") {
      params[key] = true
    }
    else if (value === "False" || value === "false") {
      params[key] = false
    }
    else if (/^-?\d+$/.test(value)) {
      params[key] = Number.parseInt(value, 10)
    }
    else if (/^-?\d+\.\d+$/.test(value)) {
      params[key] = Number.parseFloat(value)
    }
    else {
      params[key] = value
    }
    match = kvPattern.exec(content)
  }

  return params
}

/**
 * Parse step content according to AIMD spec
 * Supports formats:
 * - "step_id"
 * - "step_id, 2" (level as second param)
 * - "step_id, 2, check=True"
 * - "step_id, 2, check=True, checked_message='message'"
 */
function parseStepContent(content: string): {
  name: string
  level: number
  check: boolean
  checkedMessage?: string
  props: Record<string, string | boolean | number>
} {
  const trimmed = content.trim()
  const parts = trimmed.split(/,\s*/)
  const name = parts[0].trim()
  let level = 1 // Default level is 1 per spec
  let check = false
  let checkedMessage: string | undefined

  // Parse remaining parts
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim()

    // Check if it's a standalone number (level)
    if (/^\d+$/.test(part)) {
      level = Number.parseInt(part, 10)
      continue
    }

    // Parse key=value pairs
    const kvParams = parseKeyValueParams(part)
    if ("check" in kvParams) {
      check = Boolean(kvParams.check)
    }
    if ("checked_message" in kvParams) {
      checkedMessage = String(kvParams.checked_message)
    }
    if ("level" in kvParams) {
      level = Number(kvParams.level)
    }
  }

  // Ensure level is within bounds (1-3 per spec)
  level = Math.max(1, Math.min(3, level))

  // Parse all key-value params from the entire content
  const props = parseKeyValueParams(trimmed)

  return { name, level, check, checkedMessage, props }
}

/**
 * Parse checkpoint content according to AIMD spec
 * Supports formats:
 * - "checkpoint_id"
 * - "checkpoint_id, checked_message='message'"
 */
function parseCheckContent(content: string): {
  name: string
  checkedMessage?: string
  label: string
} {
  const trimmed = content.trim()
  const parts = trimmed.split(/,\s*/)
  const name = parts[0].trim()
  let checkedMessage: string | undefined

  // Parse key-value params
  for (let i = 1; i < parts.length; i++) {
    const kvParams = parseKeyValueParams(parts[i])
    if ("checked_message" in kvParams) {
      checkedMessage = String(kvParams.checked_message)
    }
  }

  return { name, checkedMessage, label: name }
}

/**
 * Calculate the final step indent (e.g., "1.2.3")
 */
function calculateStepIndent(step: AimdStepNode, context: StepContext): string {
  const { sequence, level, parentName } = step
  let indent = String(sequence + 1)

  if (level === 1) {
    return indent
  }

  // Build indent by traversing up the hierarchy
  let currentParentName = parentName
  while (currentParentName) {
    const parent = context.byName.get(currentParentName)
    if (parent) {
      indent = `${parent.sequence + 1}.${indent}`
      currentParentName = parent.parentName
    }
    else {
      break
    }
  }

  return indent
}

/**
 * Register a step node in the context and set up hierarchy
 */
function registerStep(node: AimdStepNode, context: StepContext): void {
  const { name, level } = node

  // Convert level to 0-based for internal use
  const internalLevel = level - 1

  // Add to byName
  context.byName.set(name, node)

  // Add to allSteps
  context.allSteps.push(node)

  // Get or create level array
  if (!context.byLevel.has(internalLevel)) {
    context.byLevel.set(internalLevel, [])
  }
  const levelSteps = context.byLevel.get(internalLevel)!

  // Find parent (last step at level - 1)
  if (internalLevel > 0) {
    const parentLevel = context.byLevel.get(internalLevel - 1)
    if (parentLevel && parentLevel.length > 0) {
      const parent = parentLevel[parentLevel.length - 1]
      node.parentName = parent.name
      parent.hasChildren = true
    }
  }

  // Find previous sibling (last step at same level with same parent)
  const siblings = levelSteps.filter(s => s.parentName === node.parentName)
  if (siblings.length > 0) {
    const prevSibling = siblings[siblings.length - 1]
    node.prevName = prevSibling.name
    node.sequence = prevSibling.sequence + 1
    prevSibling.nextName = name
  }
  else {
    node.sequence = 0
  }

  // Add to level array
  levelSteps.push(node)

  // Calculate final step indent
  node.step = calculateStepIndent(node, context)
}

/**
 * Parse variable type definition syntax according to AIMD spec
 * Supported formats:
 * - name
 * - name: str
 * - name: str = "default"
 * - name: int = 0, title="Title", description="Desc"
 * - name: list[Student], subvars=[a, b]
 */
function parseVarDefinition(content: string): AimdVarDefinition & {
  subvars?: string[]
  subvarDefs?: Record<string, AimdVarDefinition>
  title?: string
  description?: string
} {
  const trimmed = content.trim()

  // Check for subvars first
  // Use a more robust approach to extract subvars content
  // Handle nested brackets in patterns like [^\]]
  const subvarsStart = trimmed.indexOf("subvars")
  let subvarsContent: string | undefined
  let subvars: string[] | undefined
  let subvarDefs: Record<string, AimdVarDefinition> | undefined

  if (subvarsStart !== -1) {
    const afterSubvars = trimmed.slice(subvarsStart)
    const openBracketIndex = afterSubvars.indexOf("[")
    if (openBracketIndex !== -1) {
      // Find matching closing bracket, counting nested brackets
      let depth = 0
      let closeBracketIndex = -1
      for (let i = openBracketIndex; i < afterSubvars.length; i++) {
        if (afterSubvars[i] === "[") {
          depth++
        }
        else if (afterSubvars[i] === "]") {
          depth--
          if (depth === 0) {
            closeBracketIndex = i
            break
          }
        }
      }
      if (closeBracketIndex !== -1) {
        subvarsContent = afterSubvars.slice(openBracketIndex + 1, closeBracketIndex)
      }
    }
  }

  if (subvarsContent) {
    // Parse subvars - can be simple names or typed definitions
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    const subvarParts = subvarsContent.split(/,\s*(?![^(]*\))/).map(s => s.trim()).filter(Boolean)
    subvars = []
    subvarDefs = {}

    for (const part of subvarParts) {
      // Check if it's a typed definition (contains :)
      if (part.includes(":")) {
        const subDef = parseSimpleVarDef(part)
        subvars.push(subDef.id)
        subvarDefs[subDef.id] = subDef
      }
      else {
        // Simple name
        const name = part.replace(/^var\s*\(\s*|\s*\)$/g, "").trim()
        subvars.push(name)
        subvarDefs[name] = { id: name }
      }
    }
  }

  // Remove subvars from content for further parsing
  let contentWithoutSubvars = trimmed
  if (subvarsStart !== -1 && subvarsContent !== undefined) {
    // Remove the entire subvars=[ ... ] part
    const subvarsEndIndex = trimmed.indexOf("]", subvarsStart + "subvars".length)
    if (subvarsEndIndex !== -1) {
      contentWithoutSubvars = trimmed.slice(0, subvarsStart) + trimmed.slice(subvarsEndIndex + 1)
      contentWithoutSubvars = contentWithoutSubvars.replace(/,\s*,/, ",").replace(/,\s*$/, "").trim()
    }
  }

  // Parse the main var definition
  const def = parseSimpleVarDef(contentWithoutSubvars)

  // Parse additional kwargs (title, description, etc.)
  const kvParams = parseKeyValueParams(contentWithoutSubvars)

  return {
    ...def,
    subvars: subvarDefs,
    title: kvParams.title ? String(kvParams.title) : undefined,
    description: kvParams.description ? String(kvParams.description) : undefined,
  } as AimdVarDefinition
}

/**
 * Parse simple var definition: name, name: type, name: type = default
 * Also handles var(...) wrapper syntax
 * Now also parses kwargs like pattern, title, description, etc.
 */
function parseSimpleVarDef(content: string): AimdVarDefinition {
  let trimmed = content.trim()

  // Handle var(...) wrapper syntax - extract content inside var()
  // Use a simple string check to avoid regex backtracking issues
  if (trimmed.startsWith("var(") && trimmed.endsWith(")")) {
    trimmed = trimmed.slice(4, -1).trim()
  }
  else if (trimmed.startsWith("var (") && trimmed.endsWith(")")) {
    trimmed = trimmed.slice(5, -1).trim()
  }

  // Parse kwargs (like pattern, title, description) before removing them
  const kvParams = parseKeyValueParams(trimmed)

  // Remove any trailing kwargs to get main part
  const mainPart = trimmed.split(/,\s*(?=\w+\s*=)/)[0].trim()

  // Simple variable name (no type annotation)
  if (!mainPart.includes(":")) {
    // Check for = (default value without type)
    const eqIndex = mainPart.indexOf("=")
    if (eqIndex > 0) {
      const result: AimdVarDefinition = {
        id: mainPart.slice(0, eqIndex).trim(),
        default: parseDefaultValue(mainPart.slice(eqIndex + 1).trim()),
      }
      if (Object.keys(kvParams).length > 0) {
        result.kwargs = kvParams
      }
      return result
    }
    const result: AimdVarDefinition = { id: mainPart.split(/\s/)[0].trim() }
    if (Object.keys(kvParams).length > 0) {
      result.kwargs = kvParams
    }
    return result
  }

  // Parse typed definition
  const colonIndex = mainPart.indexOf(":")
  const id = mainPart.slice(0, colonIndex).trim()
  const rest = mainPart.slice(colonIndex + 1).trim()

  // Parse type and default value
  const eqIndex = rest.indexOf("=")
  let type: string
  let defaultValue: string | number | boolean | null | undefined

  if (eqIndex > 0) {
    type = rest.slice(0, eqIndex).trim()
    defaultValue = parseDefaultValue(rest.slice(eqIndex + 1).trim())
  }
  else {
    type = rest.trim()
  }

  const result: AimdVarDefinition = { id, type }

  if (defaultValue !== undefined) {
    result.default = defaultValue
  }

  // Add kwargs if present (pattern, title, description, etc.)
  if (Object.keys(kvParams).length > 0) {
    result.kwargs = kvParams
  }

  return result
}

/**
 * Parse default value
 */
function parseDefaultValue(value: string): string | number | boolean | null {
  const trimmed = value.trim()

  // Boolean
  if (trimmed === "true" || trimmed === "True")
    return true
  if (trimmed === "false" || trimmed === "False")
    return false

  // null
  if (trimmed === "null" || trimmed === "None")
    return null

  // Number
  if (/^-?\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10)
  }
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    return Number.parseFloat(trimmed)
  }

  // String (remove quotes)
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\""))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

/**
 * Parse fig code block content (YAML format)
 * Expected format:
 * id: fig_1
 * src: path/to/image.png
 * title: Optional title
 * legend: Optional legend (can be multiline)
 */
function parseFigContent(content: string): {
  id: string
  src: string
  title?: string
  legend?: string
} {
  // Simple line-by-line YAML parsing
  const lines = content.split("\n")
  const result: Record<string, string> = {}
  let currentKey: string | null = null
  let currentValue = ""
  let isMultiline = false

  for (const line of lines) {
    const trimmedLine = line.trim()

    // Skip empty lines when not in multiline mode
    if (!trimmedLine && !isMultiline) {
      continue
    }

    // Check for new key-value pair (key: value or key: |)
    const match = trimmedLine.match(/^(\w+):\s*(.*)$/)
    if (match) {
      // Save previous key-value if exists
      if (currentKey) {
        result[currentKey] = currentValue.trim()
      }

      // Start new key
      currentKey = match[1]
      const value = match[2]

      // Check if this is a multiline indicator
      if (value === "|") {
        isMultiline = true
        currentValue = ""
      }
      else {
        isMultiline = false
        currentValue = value
      }
    }
    else if (currentKey && (isMultiline || trimmedLine)) {
      // Multi-line value continuation
      if (currentValue) {
        currentValue += `\n${line}`
      }
      else {
        currentValue = line
      }
    }
  }

  // Save last key-value
  if (currentKey) {
    result[currentKey] = currentValue.trim()
  }

  if (!result.id || !result.src) {
    throw new Error("fig block must have \"id\" and \"src\" fields")
  }

  return {
    id: result.id,
    src: result.src,
    title: result.title,
    legend: result.legend,
  }
}

/**
 * Parse table column definition (for var_table)
 */
function parseTableColumns(content: string): { name: string, columns: string[], definition?: AimdVarDefinition } {
  // Check for subvars syntax first: name, subvars=[col1, col2]
  // Use simple indexOf check instead of regex to handle nested brackets
  if (content.includes("subvars")) {
    const def = parseVarDefinition(content)
    // def.subvars is stored as Record (subvarDefs) in parseVarDefinition; normalize to string[] for columns
    const raw = def.subvars
    const columns = Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? Object.keys(raw) : [])
    return {
      name: def.id,
      columns,
      definition: def,
    }
  }

  // Legacy format: tableName(col1, col2, col3)
  const parenMatch = content.match(/^(\w+)\s*\(([^)]+)\)/)
  if (parenMatch) {
    return {
      name: parenMatch[1],
      columns: parenMatch[2].split(",").map(s => s.trim()).filter(Boolean),
    }
  }

  // Simple format: just the name
  const def = parseVarDefinition(content)
  return {
    name: def.id,
    columns: [],
    definition: def,
  }
}

/**
 * Determine if content represents a var_table (has subvars)
 */
function isVarTable(content: string): boolean {
  return /subvars\s*=\s*\[/.test(content)
}

/**
 * Create AIMD node
 */
function createAimdNode(
  fieldType: AimdFieldType,
  content: string,
  raw: string,
  stepContext?: StepContext,
): AimdNode {
  const scope = SCOPE_MAP[fieldType]

  switch (fieldType) {
    case "var": {
      // Check if this is actually a var_table (has subvars)
      if (isVarTable(content)) {
        const { name, columns, definition } = parseTableColumns(content)
        return {
          type: "aimd",
          fieldType: "var_table",
          name,
          scope: "rt",
          raw,
          columns,
          definition,
        } as AimdVarTableNode
      }

      const definition = parseVarDefinition(content)
      return {
        type: "aimd",
        fieldType: "var",
        name: definition.id,
        scope,
        raw,
        definition,
      } as AimdVarNode
    }

    case "var_table": {
      const { name, columns, definition } = parseTableColumns(content)
      return {
        type: "aimd",
        fieldType: "var_table",
        name,
        scope,
        raw,
        columns,
        definition,
      } as AimdVarTableNode
    }

    case "step": {
      const { name, level, check, checkedMessage, props } = parseStepContent(content)
      const stepNode: AimdStepNode = {
        type: "aimd",
        fieldType: "step",
        name,
        scope,
        raw,
        level,
        sequence: 0,
        step: "1",
        hasChildren: false,
        check,
      }

      // Add checked_message if present
      if (checkedMessage) {
        (stepNode as any).checkedMessage = checkedMessage
      }

      // Register step in context if provided
      if (stepContext) {
        registerStep(stepNode, stepContext)
      }

      return stepNode
    }

    case "check": {
      const { name, checkedMessage, label } = parseCheckContent(content)
      const checkNode: AimdCheckNode = {
        type: "aimd",
        fieldType: "check",
        name,
        scope,
        raw,
        label,
      }

      // Add checked_message if present
      if (checkedMessage) {
        (checkNode as any).checkedMessage = checkedMessage
      }

      return checkNode
    }

    case "ref_step":
    case "ref_var":
    case "ref_fig":
      return {
        type: "aimd",
        fieldType,
        name: content.trim(),
        scope,
        raw,
        refTarget: content.trim(),
      }

    case "cite": {
      // Parse citation references (comma-separated)
      const refs = content.split(",").map(r => r.trim()).filter(Boolean)
      return {
        type: "aimd",
        fieldType: "cite",
        name: refs[0] || content.trim(), // Use first ref as name
        scope,
        raw,
        refs,
      } as AimdCiteNode
    }
  }
}

/**
 * Find and replace AIMD syntax in text nodes
 * Pattern: {{type|content}}
 */
function processTextNode(node: Text, stepContext: StepContext): PhrasingContent[] {
  const { value } = node
  const result: PhrasingContent[] = []
  let lastIndex = 0

  // Pattern matches: {{type|content}}
  // Types: var_table, var, step, check, ref_step, ref_var, ref_fig, cite
  // Note: var_table must come before var to match correctly
  // eslint-disable-next-line regexp/no-super-linear-backtracking
  const pattern = /\{\{(var_table|var|step|check|ref_step|ref_var|ref_fig|cite)\s*\|\s*([^}]+?)\s*\}\}/g

  let match: RegExpExecArray | null = pattern.exec(value)
  while (match !== null) {
    const [fullMatch, type, content] = match
    const startIndex = match.index

    // Add text before the variable tag
    if (startIndex > lastIndex) {
      result.push({
        type: "text",
        value: value.slice(lastIndex, startIndex),
      })
    }

    // Create AIMD node
    const aimdNode = createAimdNode(type as AimdFieldType, content, fullMatch, stepContext)
    result.push(aimdNode)

    lastIndex = startIndex + fullMatch.length
    match = pattern.exec(value)
  }

  // Add remaining text
  if (lastIndex < value.length) {
    result.push({
      type: "text",
      value: value.slice(lastIndex),
    })
  }

  return result.length > 0 ? result : [node]
}

export interface RemarkAimdOptions {
  /**
   * Whether to extract field information to VFile data
   * @default true
   */
  extractFields?: boolean
  /**
   * Typed configuration for field properties
   */
  typed?: Record<string, Record<string, any>>
}

/**
 * remark-aimd plugin
 * Processes AIMD custom syntax {{type|content}}
 *
 * Supported syntax:
 * - {{var|name}} - Simple variable
 * - {{var|name: type}} - Typed variable
 * - {{var|name: type = default}} - Variable with default
 * - {{var|name, subvars=[a, b]}} - Variable table
 * - {{step|name}} - Step (level 1)
 * - {{step|name, 2}} - Step with level
 * - {{step|name, 2, check=True}} - Step with check
 * - {{check|name}} - Checkpoint
 * - {{ref_step|name}} - Step reference
 * - {{ref_var|name}} - Variable reference
 */
const remarkAimd: Plugin<[RemarkAimdOptions?], Root> = (options = {}) => {
  const { extractFields = true } = options

  return (tree, file) => {
    // Initialize field collection
    const fields: ExtractedAimdFields = {
      var: [],
      var_table: [],
      step: [],
      check: [],
      ref_step: [],
      ref_var: [],
      ref_fig: [],
      cite: [],
      fig: [],
    }

    // Step context for hierarchy building
    const stepContext = createStepContext()

    // First pass: Process fig code blocks
    visit(tree, "code", (node: Code, index, parent) => {
      if (index === undefined || !parent)
        return

      // Check if this is a fig code block
      if (node.lang === "fig") {
        try {
          // Parse the YAML content
          const figData = parseFigContent(node.value)

          // Create AIMD fig node
          const figNode: AimdFigNode = {
            type: "aimd",
            fieldType: "fig",
            name: figData.id,
            scope: "rf",
            raw: node.value,
            id: figData.id,
            src: figData.src,
            title: figData.title,
            legend: figData.legend,
          }

          // Replace code node with AIMD fig node
          parent.children[index] = figNode as any

          // Collect field information
          if (extractFields && fields.fig) {
            const existingFig = fields.fig.find(f => f.id === figData.id)
            if (!existingFig) {
              fields.fig.push({
                id: figData.id,
                src: figData.src,
                title: figData.title,
                legend: figData.legend,
              })
            }
          }
        }
        catch (error) {
          console.error("Failed to parse fig block:", error)
        }
      }
    })

    // Traverse all text nodes
    visit(tree, "text", (node, index, parent) => {
      if (index === undefined || !parent)
        return

      const processed = processTextNode(node, stepContext)

      // Skip if no changes
      if (processed.length === 1 && processed[0] === node)
        return

      // Replace node
      parent.children.splice(index, 1, ...processed)

      // Collect field information
      if (extractFields) {
        for (const child of processed) {
          if (child.type === "aimd") {
            const aimdNode = child as AimdNode
            switch (aimdNode.fieldType) {
              case "var":
                if (!fields.var.includes(aimdNode.name)) {
                  fields.var.push(aimdNode.name)
                }
                break
              case "var_table": {
                if (!fields.var_table.find(t => t.name === aimdNode.name)) {
                  const tableNode = aimdNode as AimdVarTableNode
                  const def = tableNode.definition
                  // def.subvars is Record<string, AimdVarDefinition> (object), not array; columns may be non-array at runtime
                  const namesSource = def?.subvars ?? tableNode.columns ?? []
                  const names = Array.isArray(namesSource)
                    ? namesSource
                    : namesSource && typeof namesSource === "object"
                      ? Object.keys(namesSource)
                      : []
                  const subvars = names.map((name: string) => {
                    const subDef = def?.subvars && typeof def.subvars === "object" && !Array.isArray(def.subvars) ? def.subvars[name] : undefined
                    return subDef
                      ? {
                        name,
                        type: subDef.type,
                        default: subDef.default,
                        title: subDef.title || name,
                        description: subDef.description,
                        kwargs: subDef.kwargs, // Include kwargs (pattern, etc.)
                      }
                      : { name }
                  })
                  const columns = Array.isArray(tableNode.columns) ? tableNode.columns : []
                  fields.var_table.push({
                    name: aimdNode.name,
                    scope: "rt",
                    columns,
                    // Extended fields for full AimdVarTableField compatibility
                    subvars,
                    type_annotation: def?.type,
                  })
                }
                break
              }
              case "step":
                if (!fields.step.includes(aimdNode.name)) {
                  fields.step.push(aimdNode.name)
                }
                break
              case "check":
                if (!fields.check.includes(aimdNode.name)) {
                  fields.check.push(aimdNode.name)
                }
                break
              case "ref_step":
                if (!fields.ref_step.includes(aimdNode.name)) {
                  fields.ref_step.push(aimdNode.name)
                }
                break
              case "ref_var":
                if (!fields.ref_var.includes(aimdNode.name)) {
                  fields.ref_var.push(aimdNode.name)
                }
                break
              case "ref_fig":
                if (!fields.ref_fig) fields.ref_fig = []
                if (!fields.ref_fig.includes(aimdNode.name)) {
                  fields.ref_fig.push(aimdNode.name)
                }
                break
              case "cite":
                // For cite, add all refs
                if (!fields.cite) fields.cite = []
                if ("refs" in aimdNode) {
                  for (const ref of (aimdNode as AimdCiteNode).refs) {
                    if (!fields.cite.includes(ref)) {
                      fields.cite.push(ref)
                    }
                  }
                }
                break
            }
          }
        }
      }

      // Skip the newly inserted nodes to avoid infinite loop
      return [SKIP, index + processed.length] as const
    })

    // Build step hierarchy information
    if (extractFields && stepContext.allSteps.length > 0) {
      fields.stepHierarchy = stepContext.allSteps.map(step => ({
        name: step.name,
        level: step.level,
        sequence: step.sequence,
        step: Number.parseInt(step.step) || 0,
        parentName: step.parentName,
        prevName: step.prevName,
        nextName: step.nextName,
        hasChildren: step.hasChildren,
      }))
    }

    // Store extracted fields to VFile
    if (extractFields) {
      file.data.aimdFields = fields
    }

    // Store step context for later use
    file.data.stepContext = {
      byName: Object.fromEntries(stepContext.byName),
      allSteps: stepContext.allSteps,
    }
  }
}

export default remarkAimd
