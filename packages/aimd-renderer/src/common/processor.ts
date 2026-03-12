import type { Element, Properties, Root as HastRoot, Text as HastText } from "hast"
import type { VFile } from "vfile"
import type { VNode } from "vue"
import type {
  AimdNode,
  AimdQuizNode,
  AimdStepNode,
  ProcessorOptions,
} from "@airalogy/aimd-core/types"
import type { ExtractedAimdFields } from "@airalogy/aimd-core/types"
import type { AimdRendererI18nOptions } from "../locales"

/**
 * Render result
 */
export interface RenderResult {
  nodes: VNode[]
  fields: ExtractedAimdFields
}

export type AimdRendererOptions = ProcessorOptions & AimdRendererI18nOptions

import { toHtml } from "hast-util-to-html"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"

import { protectAimdInlineTemplates, remarkAimd } from "@airalogy/aimd-core/parser"
import {
  createAimdRendererMessages,
  getAimdRendererQuizTypeLabel,
  getAimdRendererScopeLabel,
} from "../locales"
import { renderToVNodes, type VueRendererOptions } from "../vue/vue-renderer"

let mathStylesLoadPromise: Promise<unknown> | null = null

async function ensureMathStylesLoaded(mathEnabled: boolean | undefined): Promise<void> {
  if (mathEnabled === false) {
    return
  }
  if (typeof document === "undefined") {
    return
  }
  if (!mathStylesLoadPromise) {
    mathStylesLoadPromise = import("../styles/katex.css").catch(() => undefined)
  }
  await mathStylesLoadPromise
}

function createAimdParseInput(content: string) {
  const { content: protectedContent, templates } = protectAimdInlineTemplates(content)
  const file: VFile = {
    data: {
      aimdInlineTemplates: templates,
    },
  } as unknown as VFile

  return {
    content: protectedContent,
    file,
  }
}

function buildStepSequenceMap(fields: ExtractedAimdFields): Map<string, string> {
  const sequenceMap = new Map<string, string>()

  for (const step of fields.stepHierarchy || []) {
    if (typeof step.id === "string" && step.id.trim() && typeof step.step === "string" && step.step.trim()) {
      sequenceMap.set(step.id, step.step)
    }
  }

  return sequenceMap
}

function annotateStepReferenceSequence(
  tree: HastRoot,
  fields: ExtractedAimdFields,
  options: AimdRendererOptions,
): void {
  const stepSequenceMap = buildStepSequenceMap(fields)
  if (stepSequenceMap.size === 0) {
    return
  }

  const messages = createAimdRendererMessages(options.locale, options.messages)

  const visitNode = (node: HastRoot | Element): void => {
    if (node.type === "element") {
      const element = node as Element
      const aimdType = element.properties?.["data-aimd-type"] || element.properties?.dataAimdType

      if (aimdType === "ref_step") {
        const refTarget = element.properties?.["data-aimd-id"] || element.properties?.dataAimdId
        if (typeof refTarget === "string") {
          const stepSequence = stepSequenceMap.get(refTarget)
          if (stepSequence) {
            element.properties["data-aimd-step-sequence"] = stepSequence
            element.properties.title = refTarget

            const aimdData = (element.data as { aimd?: AimdNode } | undefined)?.aimd
            if (aimdData) {
              ;(aimdData as any).stepSequence = stepSequence
            }

            const jsonData = element.properties["data-aimd-json"]
            if (typeof jsonData === "string") {
              try {
                const parsed = JSON.parse(jsonData) as Record<string, unknown>
                parsed.stepSequence = stepSequence
                element.properties["data-aimd-json"] = JSON.stringify(parsed)
              }
              catch {
                // Ignore malformed fallback JSON and keep runtime metadata only.
              }
            }

            element.children = [{
              type: "element",
              tagName: "span",
              properties: { className: ["aimd-ref__content"] },
              children: [{
                type: "element",
                tagName: "span",
                properties: { className: ["aimd-field", "aimd-field--step", "aimd-field--readonly"] },
                children: [{
                  type: "element",
                  tagName: "span",
                  properties: { className: ["research-step__sequence"] },
                  children: [{ type: "text", value: messages.step.reference(stepSequence) }],
                } as Element],
              } as Element],
            } as Element]
          }
        }
      }

      for (const child of element.children || []) {
        if (child.type === "element") {
          visitNode(child)
        }
      }
      return
    }

    for (const child of node.children) {
      if (child.type === "element") {
        visitNode(child)
      }
    }
  }

  visitNode(tree)
}

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

interface ResolvedQuizPreviewOptions {
  showAnswers: boolean
  showRubric: boolean
}

const BLANK_PLACEHOLDER_PATTERN = /\[\[([^\[\]\s]+)\]\]/g

function resolveQuizPreviewOptions(
  options: Pick<ProcessorOptions, "mode" | "quizPreview">,
): ResolvedQuizPreviewOptions {
  const mode = options.mode ?? "preview"
  const defaultReveal = mode === "report"
  return {
    showAnswers: options.quizPreview?.showAnswers ?? defaultReveal,
    showRubric: options.quizPreview?.showRubric ?? defaultReveal,
  }
}

function buildQuizStemChildren(
  quizType: AimdQuizNode["quizType"],
  stem: string,
): Array<Element | HastText> {
  if (quizType !== "blank") {
    return [{ type: "text", value: stem }]
  }

  const children: Array<Element | HastText> = []
  let lastIndex = 0

  for (const match of stem.matchAll(BLANK_PLACEHOLDER_PATTERN)) {
    const start = match.index ?? 0
    const fullMatch = match[0]
    const key = match[1]

    if (start > lastIndex) {
      children.push({
        type: "text",
        value: stem.slice(lastIndex, start),
      })
    }

    children.push({
      type: "element",
      tagName: "span",
      properties: {
        className: ["aimd-quiz__blank-placeholder"],
        "data-blank-key": key,
      },
      children: [{ type: "text", value: key }],
    } as Element)

    lastIndex = start + fullMatch.length
  }

  if (lastIndex < stem.length) {
    children.push({
      type: "text",
      value: stem.slice(lastIndex),
    })
  }

  if (children.length === 0) {
    children.push({ type: "text", value: stem })
  }

  return children
}

/**
 * Custom handler for AIMD nodes in remark-rehype
 * Converts MDAST AIMD nodes to HAST elements
 */
function createAimdHandler(options: AimdRendererOptions = {}) {
  const quizPreview = resolveQuizPreviewOptions(options)
  const messages = createAimdRendererMessages(options.locale, options.messages)

  return function aimdHandler(state: any, node: AimdNode): Element {
  // Build full node data including step hierarchy
  const nodeData: Record<string, unknown> = {
    type: node.type,
    fieldType: node.fieldType,
    id: node.id,
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

  // Add quiz-specific fields
  if (node.fieldType === "quiz") {
    const quizNode = node as AimdQuizNode
    nodeData.quizType = quizNode.quizType
    nodeData.stem = quizNode.stem
    nodeData.score = quizNode.score
    nodeData.mode = quizNode.mode
    nodeData.options = quizNode.options
    nodeData.answer = quizNode.answer
    nodeData.blanks = quizNode.blanks
    nodeData.rubric = quizNode.rubric
    nodeData.default = quizNode.default
    nodeData.extra = quizNode.extra
  }

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
    nodeData.parentId = stepNode.parentId
    nodeData.prevId = stepNode.prevId
    nodeData.nextId = stepNode.nextId
    nodeData.hasChildren = stepNode.hasChildren
    nodeData.check = stepNode.check
  }

  // Serialize AIMD node data to JSON for preservation through rehypeRaw
  const aimdJson = JSON.stringify(nodeData)

  const fieldType = node.fieldType
  const id = node.id
  const typeClass = getFieldTypeClass(fieldType)

  // Determine if this is a reference type
  const isRef = fieldType === "ref_step" || fieldType === "ref_var" || fieldType === "ref_fig"
  const isCite = fieldType === "cite"
  const isQuiz = fieldType === "quiz"
  const isFig = fieldType === "fig"
  const baseClass = isRef
    ? "aimd-ref"
    : (isCite ? "aimd-cite" : (isFig ? "aimd-figure" : "aimd-field"))
  const modifierClass = isRef
    ? `aimd-ref--${fieldType === "ref_step" ? "step" : (fieldType === "ref_var" ? "var" : "fig")}`
    : (isCite ? "" : (isFig ? "" : `aimd-field--${typeClass}`))

  // Generate children based on field type
  const children: (Element | HastText)[] = []

  if (isRef) {
    // Reference: blockquote-style with appropriate content
    if (fieldType === "ref_step") {
      // Step reference: render with step-like field styling, then patch localized sequence later.
      children.push({
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-ref__content"] },
        children: [
          {
            type: "element",
            tagName: "span",
            properties: { className: ["aimd-field", "aimd-field--step", "aimd-field--readonly"] },
            children: [{
              type: "element",
              tagName: "span",
              properties: { className: ["research-step__sequence"] },
              children: [{ type: "text", value: id }],
            } as Element],
          } as Element,
        ],
      } as Element)
    }
    else {
      // Variable or figure reference: show as field with scope + id
      const scopeLabel = fieldType === "ref_var" ? messages.scope.var : messages.scope.figure
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
                children: [{ type: "text", value: id }],
              } as Element,
            ],
          } as Element,
        ],
      } as Element)
    }
  }
  else if (isCite) {
    // Citation: [refs]
    const refs = "refs" in node ? (node as any).refs : [id]
    children.push({
      type: "element",
      tagName: "span",
      properties: { className: ["aimd-cite__refs"] },
      children: [{ type: "text", value: `[${refs.join(", ")}]` }],
    } as Element)
  }
  else if (fieldType === "var") {
    // Variable: type label + id + optional type annotation
    const definition = "definition" in node ? node.definition : undefined
    children.push(
      {
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-field__scope"] },
        children: [{ type: "text", value: getAimdRendererScopeLabel("var", messages) }],
      } as Element,
      {
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-field__name"] },
        children: [{ type: "text", value: id }],
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
            children: [{ type: "text", value: getAimdRendererScopeLabel("var_table", messages) }],
          } as Element,
          {
            type: "element",
            tagName: "span",
            properties: { className: ["aimd-field__name"] },
            children: [{ type: "text", value: id }],
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
    // Step: scope label + sequence + id
    const stepNode = node as AimdStepNode
    const stepNum = stepNode.step || "1"

    children.push(
      {
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-field__scope"] },
        children: [{ type: "text", value: getAimdRendererScopeLabel("step", messages) }],
      } as Element,
      {
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-field__step-num"] },
        children: [{ type: "text", value: stepNum }],
      } as Element,
      {
        type: "element",
        tagName: "span",
        properties: { className: ["aimd-field__name"] },
        children: [{ type: "text", value: id }],
      } as Element,
    )
  }
  else if (fieldType === "check") {
    // Check: checkbox + label
    const label = "label" in node ? node.label : id
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
        children: [{ type: "text", value: label || id }],
      } as Element,
    )
  }
  else if (fieldType === "quiz") {
    const quizNode = node as AimdQuizNode
    const quizType = quizNode.quizType
    const typeLabel = getAimdRendererQuizTypeLabel(quizType, quizNode.mode, messages)

    children.push(
      {
        type: "element",
        tagName: "div",
        properties: { className: ["aimd-quiz__meta"] },
        children: [
          {
            type: "element",
            tagName: "span",
            properties: { className: ["aimd-field__scope"] },
            children: [{ type: "text", value: getAimdRendererScopeLabel("quiz", messages) }],
          } as Element,
          {
            type: "element",
            tagName: "span",
            properties: { className: ["aimd-field__name"] },
            children: [{ type: "text", value: id }],
          } as Element,
          {
            type: "element",
            tagName: "span",
            properties: { className: ["aimd-field__type"] },
            children: [{ type: "text", value: `(${typeLabel})` }],
          } as Element,
          ...(quizNode.score !== undefined
            ? [{
                type: "element",
                tagName: "span",
                properties: { className: ["aimd-quiz__score"] },
                children: [{ type: "text", value: messages.quiz.score(quizNode.score) }],
              } as Element]
            : []),
        ],
      } as Element,
      {
        type: "element",
        tagName: "div",
        properties: { className: ["aimd-quiz__stem"] },
        children: buildQuizStemChildren(quizType, quizNode.stem),
      } as Element,
    )

    if (quizType === "choice" && Array.isArray(quizNode.options) && quizNode.options.length > 0) {
      children.push({
        type: "element",
        tagName: "ul",
        properties: { className: ["aimd-quiz__options"] },
        children: quizNode.options.map(option => ({
          type: "element",
          tagName: "li",
          properties: {},
          children: [{ type: "text", value: `${option.key}. ${option.text}` }],
        } as Element)),
      } as Element)
    }

    if (quizPreview.showAnswers && quizType === "choice" && quizNode.answer !== undefined) {
      const answerText = Array.isArray(quizNode.answer)
        ? quizNode.answer.join(", ")
        : String(quizNode.answer)
      if (answerText.trim()) {
        children.push({
          type: "element",
          tagName: "div",
          properties: { className: ["aimd-quiz__answer"] },
          children: [{ type: "text", value: messages.quiz.answer(answerText) }],
        } as Element)
      }
    }

    if (quizPreview.showAnswers && quizType === "blank" && Array.isArray(quizNode.blanks) && quizNode.blanks.length > 0) {
      children.push({
        type: "element",
        tagName: "ul",
        properties: { className: ["aimd-quiz__blanks"] },
        children: quizNode.blanks.map(blank => ({
          type: "element",
          tagName: "li",
          properties: {},
          children: [{ type: "text", value: `${blank.key}: ${blank.answer}` }],
        } as Element)),
      } as Element)
    }

    if (quizPreview.showRubric && quizType === "open" && typeof quizNode.rubric === "string" && quizNode.rubric.trim()) {
      children.push({
        type: "element",
        tagName: "div",
        properties: { className: ["aimd-quiz__rubric"] },
        children: [{ type: "text", value: messages.quiz.rubric(quizNode.rubric) }],
      } as Element)
    }
  }
  else if (fieldType === "fig") {
    // Figure: image + title + legend
    const figNode = node as any
    const figId = figNode.id || id
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
  const properties: Properties = {
    "className": [baseClass, modifierClass],
    "data-aimd-type": node.fieldType,
    "data-aimd-id": node.id,
    "data-aimd-scope": node.scope,
    "data-aimd-raw": node.raw,
    "data-aimd-json": aimdJson,
  }

  // Add reference href
  if (isRef) {
    if (fieldType === "ref_step") {
      properties.href = `#step-${id}`
    }
    else if (fieldType === "ref_var") {
      properties.href = `#var-${id}`
    }
    else if (fieldType === "ref_fig") {
      properties.href = `#fig-${id}`
    }
  }

  // Add step-specific properties
  if (node.fieldType === "step") {
    const stepNode = node as AimdStepNode
    properties["data-aimd-step"] = stepNode.step
    properties["data-aimd-level"] = stepNode.level
    properties.id = `step-${id}`
  }

  // Add check id
  if (node.fieldType === "check") {
    properties.id = `check-${id}`
  }

  // Add var id
  if (node.fieldType === "var") {
    properties.id = `var-${id}`
  }

  // Add var_table id
  if (node.fieldType === "var_table") {
    properties.id = `var_table-${id}`
  }

  // Add quiz id
  if (node.fieldType === "quiz") {
    properties.id = `quiz-${id}`
  }

  // Add fig id
  if (node.fieldType === "fig") {
    const figNode = node as any
    properties.id = `fig-${figNode.id || id}`
    properties["data-aimd-fig-id"] = figNode.id
    properties["data-aimd-fig-src"] = figNode.src
  }

  // Add quiz metadata for fallback reconstruction
  if (node.fieldType === "quiz") {
    const quizNode = node as AimdQuizNode
    properties["data-aimd-quiz-type"] = quizNode.quizType
    properties["data-aimd-quiz-stem"] = quizNode.stem
  }

  const element: Element = {
    type: "element",
    tagName: isRef ? "a" : (isFig ? "figure" : ((fieldType === "var_table" || isQuiz) ? "div" : "span")),
    properties,
    children,
  }
  // Store AIMD data for Vue renderer (may be lost after rehypeRaw)
  ;(element as any).data = { aimd: node }
  return element
  }
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
export function createHtmlProcessor(options: AimdRendererOptions = {}) {
  const { math = true, sanitize = true } = options
  const aimdHandler = createAimdHandler(options)

  const processor = createBaseProcessor(options)
    .use(remarkRehype, {
      allowDangerousHtml: true,
      handlers: {
        // Custom handler for AIMD nodes
        aimd: aimdHandler,
      },
    } as any)
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
  options: AimdRendererOptions = {},
): Promise<{ html: string, fields: ExtractedAimdFields }> {
  await ensureMathStylesLoaded(options.math)
  const processor = createHtmlProcessor(options)

  const { content: protectedContent, file } = createAimdParseInput(content)
  const tree = processor.parse(protectedContent)
  const hastTree = await processor.run(tree, file) as HastRoot

  const fields = (file.data.aimdFields as ExtractedAimdFields) || {
    var: [],
    var_table: [],
    quiz: [],
    step: [],
    check: [],
    ref_step: [],
    ref_var: [],
    ref_fig: [],
    cite: [],
    fig: [],
  }
  annotateStepReferenceSequence(hastTree, fields, options)
  const html = toHtml(hastTree, { allowDangerousHtml: true })

  return { html, fields }
}

/**
 * Render Markdown/AIMD to Vue VNodes
 */
export async function renderToVue(
  content: string,
  options: AimdRendererOptions & VueRendererOptions = {},
): Promise<RenderResult> {
  await ensureMathStylesLoaded(options.math)
  const processor = createHtmlProcessor(options)

  const { content: protectedContent, file } = createAimdParseInput(content)
  const tree = processor.parse(protectedContent)
  const hastTree = await processor.run(tree, file) as HastRoot

  const fields = (file.data.aimdFields as ExtractedAimdFields) || {
    var: [],
    var_table: [],
    quiz: [],
    step: [],
    check: [],
    ref_step: [],
    ref_var: [],
    ref_fig: [],
    cite: [],
    fig: [],
  }
  annotateStepReferenceSequence(hastTree, fields, options)
  const nodes = renderToVNodes(hastTree, options)

  return { nodes, fields }
}

/**
 * Parse Markdown/AIMD and extract field information (no rendering)
 */
export function parseAndExtract(content: string): ExtractedAimdFields {
  const processor = unified()
    .use(remarkParse)
    .use(remarkAimd)

  const { content: protectedContent, file } = createAimdParseInput(content)
  const tree = processor.parse(protectedContent)
  processor.runSync(tree, file)

  return (file.data.aimdFields as ExtractedAimdFields) || {
    var: [],
    var_table: [],
    quiz: [],
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
  options: AimdRendererOptions = {},
): { html: string, fields: ExtractedAimdFields } {
  const { gfm = true, math = false, breaks = true } = options
  const aimdHandler = createAimdHandler(options)

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
    } as any)
    .use(rehypeRaw)

  const { content: protectedContent, file } = createAimdParseInput(content)
  const tree = processor.parse(protectedContent)
  const hastTree = processor.runSync(tree, file) as HastRoot

  const fields = (file.data.aimdFields as ExtractedAimdFields) || {
    var: [],
    var_table: [],
    quiz: [],
    step: [],
    check: [],
    ref_step: [],
    ref_var: [],
    ref_fig: [],
    cite: [],
    fig: [],
  }
  annotateStepReferenceSequence(hastTree, fields, options)
  const html = toHtml(hastTree, { allowDangerousHtml: true })

  return { html, fields }
}

/**
 * Create reusable renderer instance
 */
export function createRenderer(options: AimdRendererOptions = {}) {
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
