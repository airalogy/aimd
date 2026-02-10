import type { Element, Root as HastRoot, Text as HastText } from "hast"
import type { VFile } from "vfile"
import type { VNode } from "vue"
import type {
  AimdNode,
  AimdStepNode,
  ProcessorOptions,
  RenderContext,
} from "@airalogy/aimd-core/types"
import type { ExtractedAimdFields } from "@airalogy/aimd-core/types"

/**
 * Render result
 */
export interface RenderResult {
  nodes: VNode[]
  fields: ExtractedAimdFields
}

import { toHtml } from "hast-util-to-html"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"

import { remarkAimd } from "@airalogy/aimd-core/parser"
import { renderToVNodes, type VueRendererOptions } from "../vue/vue-renderer"

/**
 * Map field type to CSS class modifier (BEM format)
 */
function getFieldTypeClass(fieldType: AimdNode["fieldType"]): string {
  switch (fieldType) {
    case "var_table":
      return "var-table"
    default:
      return fieldType
  }
}

/**
 * Custom handler for AIMD nodes in remark-rehype
 * Converts MDAST AIMD nodes to HAST elements
 */
function aimdHandler(state: any, node: AimdNode): Element {
  // Build full node data including step hierarchy
  const nodeData: Record<string, unknown> = {
    type: node.type,
    fieldType: node.fieldType,
    name: node.name,
    scope: node.scope,
    raw: node.raw,
  }

  // Add type-specific fields
  if ("definition" in node)
    nodeData.definition = node.definition
  if ("columns" in node)
    nodeData.columns = node.columns
  if ("label" in node)
    nodeData.label = node.label
  if ("refTarget" in node)
    nodeData.refTarget = node.refTarget
  if ("checkedMessage" in node)
    nodeData.checkedMessage = node.checkedMessage

  // Add fig-specific fields
  if (node.fieldType === "fig") {
    const figNode = node as any
    nodeData.id = figNode.id
    nodeData.src = figNode.src
    nodeData.title = figNode.title
    nodeData.legend = figNode.legend
    nodeData.sequence = figNode.sequence
  }

  // Add step-specific fields
  if (node.fieldType === "step") {
    const stepNode = node as AimdStepNode
    nodeData.level = stepNode.level
    nodeData.sequence = stepNode.sequence
    nodeData.step = stepNode.step
    nodeData.parentName = stepNode.parentName
    nodeData.prevName = stepNode.prevName
    nodeData.nextName = stepNode.nextName
    nodeData.hasChildren = stepNode.hasChildren
    nodeData.check = stepNode.check
  }

  // Serialize AIMD node data to JSON for preservation through rehypeRaw
  const aimdJson = JSON.stringify(nodeData)

  const fieldType = node.fieldType
  const name = node.name
  const typeClass = getFieldTypeClass(fieldType)

  // Determine if this is a reference type
  const isRef = fieldType === "ref_step" || fieldType === "ref_var" || fieldType === "ref_fig"
  const isCite = fieldType === "cite"
  const isFig = fieldType === "fig"
  const baseClass = isRef ? "aimd-ref" : (isCite ? "aimd-cite" : (isFig ? "aimd-figure" : "aimd-field"))
  const modifierClass = isRef
    ? `aimd-ref--${fieldType === "ref_step" ? "step" : (fieldType === "ref_var" ? "var" : "fig")}`
    : (isCite ? "" : (isFig ? "" : `aimd-field--${typeClass}`))

  // Generate children based on field type
  const children: (Element | HastText)[] = []

  if (isRef) {
    // Reference: blockquote-style with appropriate content
    if (fieldType === "ref_step") {
      // Step reference: just show the step name with research-step__sequence class
      children.push({
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-ref__content"] },
        children: [
          {
            type: "element",
            tagName: "span",
            properties: { className: ["research-step__sequence"] },
            children: [{ type: "text", value: name }],
          } as Element,
        ],
      } as Element)
    }
    else {
      // Variable or figure reference: show as field with scope + name
      const scopeLabel = fieldType === "ref_var" ? "VAR" : "FIGURE"
      children.push({
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-ref__content"] },
        children: [
          {
            type: "element",
            tagName: "span",
            properties: { className: ["aimd-field", "aimd-field--var"] },
            children: [
              {
                type: "element",
                tagName: "span",
                properties: { className: ["aimd-field__scope"] },
                children: [{ type: "text", value: scopeLabel }],
              } as Element,
              {
                type: "element",
                tagName: "span",
                properties: { className: ["aimd-field__name"] },
                children: [{ type: "text", value: name }],
              } as Element,
            ],
          } as Element,
        ],
      } as Element)
    }
  }
  else if (isCite) {
    // Citation: [refs]
    const refs = "refs" in node ? (node as any).refs : [name]
    children.push({
      type: "element",
      tagName: "span",
      properties: { className: ["aimd-cite__refs"] },
      children: [{ type: "text", value: `[${refs.join(", ")}]` }],
    } as Element)
  }
  else if (fieldType === "var") {
    // Variable: type label + name + optional type annotation
    const definition = "definition" in node ? node.definition : undefined
    children.push(
      {
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-field__scope"] },
        children: [{ type: "text", value: "VAR" }],
      } as Element,
      {
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-field__name"] },
        children: [{ type: "text", value: name }],
      } as Element,
    )
    if (definition?.type) {
      children.push({
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-field__type"] },
        children: [{ type: "text", value: `: ${definition.type}` }],
      } as Element)
    }
  }
  else if (fieldType === "var_table") {
    // var_table: render header + table preview
    const columns = "columns" in node ? (node as any).columns as string[] : []
    children.push(
      {
        type: "element",
        tagName: "div",
        properties: { className: ["aimd-field__header"] },
        children: [
          {
            type: "element",
            tagName: "span",
            properties: { className: ["aimd-field__scope"] },
            children: [{ type: "text", value: "TABLE" }],
          } as Element,
          {
            type: "element",
            tagName: "span",
            properties: { className: ["aimd-field__name"] },
            children: [{ type: "text", value: name }],
          } as Element,
        ],
      } as Element,
    )
    if (columns && columns.length > 0) {
      children.push({
        type: "element",
        tagName: "table",
        properties: { className: ["aimd-field__table-preview"] },
        children: [
          {
            type: "element",
            tagName: "thead",
            properties: {},
            children: [
              {
                type: "element",
                tagName: "tr",
                properties: {},
                children: columns.map(col => ({
                  type: "element",
                  tagName: "th",
                  properties: {},
                  children: [{ type: "text", value: col }],
                } as Element)),
              } as Element,
            ],
          } as Element,
          {
            type: "element",
            tagName: "tbody",
            properties: {},
            children: [
              {
                type: "element",
                tagName: "tr",
                properties: {},
                children: columns.map(() => ({
                  type: "element",
                  tagName: "td",
                  properties: {},
                  children: [{ type: "text", value: "..." }],
                } as Element)),
              } as Element,
            ],
          } as Element,
        ],
      } as Element)
    }
  }
  else if (fieldType === "step") {
    // Step: scope label + step number + name
    const stepNode = node as AimdStepNode
    const stepNum = stepNode.step || "1"

    children.push(
      {
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-field__scope"] },
        children: [{ type: "text", value: "STEP" }],
      } as Element,
      {
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-field__step-num"] },
        children: [{ type: "text", value: `Step ${stepNum}` }],
      } as Element,
      {
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-field__name"] },
        children: [{ type: "text", value: name }],
      } as Element,
    )
  }
  else if (fieldType === "check") {
    // Check: checkbox + label
    const label = "label" in node ? node.label : name
    children.push(
      {
        type: "element",
        tagName: "input",
        properties: { type: "checkbox", className: ["aimd-checkbox"], disabled: true },
        children: [],
      } as Element,
      {
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-field__label"] },
        children: [{ type: "text", value: label || name }],
      } as Element,
    )
  }
  else if (fieldType === "fig") {
    // Figure: image + title + legend
    const figNode = node as any
    const figId = figNode.id || name
    const figSrc = figNode.src || ""
    const figTitle = figNode.title
    const figLegend = figNode.legend

    // Create img element
    children.push({
      type: "element",
      tagName: "img",
      properties: {
        src: figSrc,
        alt: figTitle || figId,
        className: ["aimd-figure__image"],
      },
      children: [],
    } as Element)

    // Create figcaption if title or legend exists
    if (figTitle || figLegend) {
      const captionChildren: (Element | HastText)[] = []

      if (figTitle) {
        captionChildren.push({
          type: "element",
          tagName: "div",
          properties: { className: ["aimd-figure__title"] },
          children: [{ type: "text", value: figTitle }],
        } as Element)
      }

      if (figLegend) {
        captionChildren.push({
          type: "element",
          tagName: "div",
          properties: { className: ["aimd-figure__legend"] },
          children: [{ type: "text", value: figLegend }],
        } as Element)
      }

      children.push({
        type: "element",
        tagName: "figcaption",
        properties: { className: ["aimd-figure__caption"] },
        children: captionChildren,
      } as Element)
    }
  }

  // Build properties
  const properties: Record<string, unknown> = {
    "className": [baseClass, modifierClass],
    "data-aimd-type": node.fieldType,
    "data-aimd-name": node.name,
    "data-aimd-scope": node.scope,
    "data-aimd-raw": node.raw,
    "data-aimd-json": aimdJson,
  }

  // Add reference href
  if (isRef) {
    properties.href = `#${node.scope}-${name}`
  }

  // Add step-specific properties
  if (node.fieldType === "step") {
    const stepNode = node as AimdStepNode
    properties["data-aimd-step"] = stepNode.step
    properties["data-aimd-level"] = stepNode.level
    properties.id = `rs-${name}`
  }

  // Add check id
  if (node.fieldType === "check") {
    properties.id = `rc-${name}`
  }

  // Add var id
  if (node.fieldType === "var") {
    properties.id = `rv-${name}`
  }

  // Add var_table id
  if (node.fieldType === "var_table") {
    properties.id = `rt-${name}`
  }

  // Add fig id
  if (node.fieldType === "fig") {
    const figNode = node as any
    properties.id = `rf-${figNode.id || name}`
    properties["data-aimd-fig-id"] = figNode.id
    properties["data-aimd-fig-src"] = figNode.src
  }

  const element: Element = {
    type: "element",
    tagName: isRef ? "a" : (isFig ? "figure" : (fieldType === "var_table" ? "div" : "span")),
    properties,
    children,
  }
  // Store AIMD data for Vue renderer (may be lost after rehypeRaw)
  ;(element as any).data = { aimd: node }
  return element
}

/**
 * Create base processor
 */
function createBaseProcessor(options: ProcessorOptions = {}) {
  const { gfm = true, math = true, breaks = true } = options

  const processor = unified()
    .use(remarkParse)

  // GFM support (tables, strikethrough, task lists, etc.)
  if (gfm) {
    processor.use(remarkGfm)
  }

  // Math formula support
  if (math) {
    processor.use(remarkMath)
  }

  // AIMD syntax support - MUST run before remarkBreaks
  // to properly parse multiline AIMD syntax like var_table with subvars
  processor.use(remarkAimd)

  // Single line break to <br> conversion (default enabled for AIMD)
  if (breaks) {
    processor.use(remarkBreaks)
  }

  return processor
}

/**
 * Create HTML output processor
 */
export function createHtmlProcessor(options: ProcessorOptions = {}) {
  const { math = true, sanitize = true } = options

  const processor = createBaseProcessor(options)
    .use(remarkRehype, {
      allowDangerousHtml: true,
      handlers: {
        // Custom handler for AIMD nodes
        aimd: aimdHandler,
      },
    })
    .use(rehypeRaw)

  // Math formula rendering
  if (math) {
    processor.use(rehypeKatex)
  }

  return processor
}

/**
 * Render Markdown/AIMD to HTML string
 */
export async function renderToHtml(
  content: string,
  options: ProcessorOptions = {},
): Promise<{ html: string, fields: ExtractedAimdFields }> {
  const processor = createHtmlProcessor(options)

  const tree = processor.parse(content)
  const file: VFile = { data: {} } as VFile
  const hastTree = await processor.run(tree, file) as HastRoot

  const html = toHtml(hastTree, { allowDangerousHtml: true })
  const fields = (file.data.aimdFields as ExtractedAimdFields) || {
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

  return { html, fields }
}

/**
 * Render Markdown/AIMD to Vue VNodes
 */
export async function renderToVue(
  content: string,
  options: ProcessorOptions & VueRendererOptions = {},
): Promise<RenderResult> {
  const processor = createHtmlProcessor(options)

  const tree = processor.parse(content)
  const file: VFile = { data: {} } as VFile
  const hastTree = await processor.run(tree, file) as HastRoot

  const nodes = renderToVNodes(hastTree, options)
  const fields = (file.data.aimdFields as ExtractedAimdFields) || {
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

  return { nodes, fields }
}

/**
 * Parse Markdown/AIMD and extract field information (no rendering)
 */
export function parseAndExtract(content: string): ExtractedAimdFields {
  const processor = unified()
    .use(remarkParse)
    .use(remarkAimd)

  const file: VFile = { data: {} } as VFile
  const tree = processor.parse(content)
  processor.runSync(tree, file)

  return (file.data.aimdFields as ExtractedAimdFields) || {
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
}

/**
 * Synchronous render to HTML (for simple scenarios)
 */
export function renderToHtmlSync(
  content: string,
  options: ProcessorOptions = {},
): { html: string, fields: ExtractedAimdFields } {
  const { gfm = true, math = false, breaks = true } = options

  // Sync mode does not support KaTeX (requires async loading)
  const processor = unified()
    .use(remarkParse)

  if (gfm) {
    processor.use(remarkGfm)
  }

  // AIMD syntax support - MUST run before remarkBreaks
  // to properly parse multiline AIMD syntax like var_table with subvars
  processor.use(remarkAimd)

  // Single line break to <br> conversion (default enabled for AIMD)
  if (breaks) {
    processor.use(remarkBreaks)
  }

  processor
    .use(remarkRehype, {
      allowDangerousHtml: true,
      handlers: {
        aimd: aimdHandler,
      },
    })
    .use(rehypeRaw)

  const file: VFile = { data: {} } as VFile
  const tree = processor.parse(content)
  const hastTree = processor.runSync(tree, file) as HastRoot

  const html = toHtml(hastTree, { allowDangerousHtml: true })
  const fields = (file.data.aimdFields as ExtractedAimdFields) || {
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

  return { html, fields }
}

/**
 * Create reusable renderer instance
 */
export function createRenderer(options: ProcessorOptions = {}) {
  const processor = createHtmlProcessor(options)

  return {
    /**
     * Render to HTML
     */
    async toHtml(content: string): Promise<{ html: string, fields: ExtractedAimdFields }> {
      return renderToHtml(content, options)
    },

    /**
     * Render to Vue VNodes
     */
    async toVue(
      content: string,
      renderOptions?: VueRendererOptions,
    ): Promise<RenderResult> {
      return renderToVue(content, { ...options, ...renderOptions })
    },

    /**
     * Extract fields only
     */
    extractFields(content: string): ExtractedAimdFields {
      return parseAndExtract(content)
    },
  }
}

// Export default renderer
export const defaultRenderer = createRenderer()
