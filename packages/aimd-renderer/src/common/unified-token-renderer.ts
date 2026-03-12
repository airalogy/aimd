import type { Element } from "hast"
/**
 * Unified-based token renderer
 * Provides compatibility layer for migrating from markdown-it tokenRenderer
 */
import type { Component, VNode } from "vue"
import type {
  AimdCheckNode,
  AimdQuizNode,
  AimdStepNode,
  AimdVarNode,
  AimdVarTableNode,
} from "@airalogy/aimd-core/types"
import type { AimdNode, QuizPreviewOptions } from "@airalogy/aimd-core/types"
import type { ExtractedAimdFields } from "@airalogy/aimd-core/types"
import type { AimdRendererI18nOptions, AimdRendererMessages } from "../locales"
import type { AimdComponentRenderer, ElementRenderer, ShikiHighlighter, VueRendererOptions } from "../vue/vue-renderer"
import type { RenderResult } from "./processor"
import { h } from "vue"
import {
  createAimdRendererMessages,
  getAimdRendererQuizTypeLabel,
  getAimdRendererScopeLabel,
  resolveAimdRendererLocale,
} from "../locales"
import { parseAndExtract, renderToVue } from "./processor"

/**
 * Token props interface (compatible with IAIMDItemProps)
 */
export interface TokenProps {
  scope: string
  prop: string
  type?: string
  value?: unknown
  label?: string
  disabled?: boolean
  title?: string
  required?: boolean
  [key: string]: unknown
}

/**
 * Token-like object for getTokenProps compatibility
 */
export interface TokenLike {
  meta?: {
    node?: {
      id: string
      scope: string
      type?: string
    }
  }
}

/**
 * Asset response interface
 */
export interface AssetResponse {
  url: string
  [key: string]: unknown
}

/**
 * Render mode type
 */
export type RenderMode = "preview" | "edit" | "timeline" | "report"

/**
 * Unified token renderer options
 * Compatible with TokenRendererBaseOptions from markdown-it version
 */
export interface UnifiedTokenRendererOptions {
  /**
   * Get props for a field from external data source
   */
  getTokenProps?: (token: TokenLike) => Promise<TokenProps | null>
  /**
   * Get static research assets (images, files)
   */
  getStaticResearchAssets?: (id: string) => Promise<AssetResponse | null>
  /**
   * Render mode
   */
  mode: RenderMode | (() => RenderMode)
  /**
   * Shiki highlighter for code blocks
   */
  highlighter?: ShikiHighlighter | null | (() => ShikiHighlighter | null)
  /**
   * Custom Vue components
   */
  components?: {
    AIMDItem?: Component
    AIMDTag?: Component
    AIMDStepRef?: Component
    StepRenderer?: Component
    CheckRenderer?: Component
    PreviewRenderer?: Component
    AssetRenderer?: Component
    EmbeddedRenderer?: Component
    MermaidBlock?: Component
  }
  /**
   * Quiz preview visibility policy
   */
  quizPreview?: QuizPreviewOptions
  /**
   * Built-in renderer locale
   */
  locale?: AimdRendererI18nOptions["locale"]
  /**
   * Optional overrides for built-in renderer copy
   */
  messages?: AimdRendererI18nOptions["messages"]
}

/**
 * Get scope display key
 */
function getScopeKey(scope: string): string {
  return scope === "var_table" ? "table" : scope
}

interface ResolvedQuizPreviewOptions {
  showAnswers: boolean
  showRubric: boolean
}

function resolveQuizPreviewOptions(
  mode: RenderMode,
  quizPreview?: QuizPreviewOptions,
): ResolvedQuizPreviewOptions {
  const normalizedMode = mode === "timeline" ? "preview" : mode
  const defaultReveal = normalizedMode === "report"
  return {
    showAnswers: quizPreview?.showAnswers ?? defaultReveal,
    showRubric: quizPreview?.showRubric ?? defaultReveal,
  }
}

const BLANK_PLACEHOLDER_PATTERN = /\[\[([^\[\]\s]+)\]\]/g

function buildQuizStemChildren(
  quizType: AimdQuizNode["quizType"],
  stem: string,
): VNode[] {
  if (quizType !== "blank") {
    return [h("span", stem)]
  }

  const children: VNode[] = []
  let lastIndex = 0

  for (const match of stem.matchAll(BLANK_PLACEHOLDER_PATTERN)) {
    const start = match.index ?? 0
    const fullMatch = match[0]
    const key = match[1]

    if (start > lastIndex) {
      children.push(h("span", stem.slice(lastIndex, start)))
    }

    children.push(
      h("span", {
        class: "aimd-quiz__blank-placeholder",
        "data-blank-key": key,
      }, key),
    )

    lastIndex = start + fullMatch.length
  }

  if (lastIndex < stem.length) {
    children.push(h("span", stem.slice(lastIndex)))
  }

  if (children.length === 0) {
    children.push(h("span", stem))
  }

  return children
}

/**
 * Render preview tag for AIMD field
 */
function renderPreviewTag(
  scope: string,
  id: string,
  messages: AimdRendererMessages,
  columns?: string[],
): VNode {
  const scopeKey = getScopeKey(scope)
  const scopeLabel = getAimdRendererScopeLabel(scope, messages)

  // var_table: render tag with table preview inside
  if (scope === "var_table") {
    const children: VNode[] = [
      h("div", { class: "aimd-field__header" }, [
        h("span", { class: "aimd-field__scope" }, messages.scope.table),
        h("span", { class: "aimd-field__name" }, id),
      ]),
    ]
    // Add table preview inside the container
    if (columns && columns.length > 0) {
      children.push(
        h("table", { class: "aimd-field__table-preview" }, [
          h("thead", [
            h("tr", columns.map(col => h("th", col))),
          ]),
          h("tbody", [
            h("tr", columns.map(() => h("td", "..."))),
          ]),
        ]),
      )
    }
    return h("div", {
      "class": "aimd-field aimd-field--var-table",
      "data-aimd-type": "var_table",
      "data-aimd-id": id,
    }, children)
  }

  const classSuffix = scopeKey === "table" ? "var-table" : scopeKey

  return h("span", {
    "class": `aimd-field aimd-field--${classSuffix}`,
    "data-aimd-type": scopeKey,
    "data-aimd-id": id,
  }, [
    h("span", { class: "aimd-field__scope" }, scopeLabel),
    h("span", { class: "aimd-field__name" }, id),
  ])
}

/**
 * Create AIMD renderers based on options
 */
function createAimdRenderers(options: UnifiedTokenRendererOptions): Record<string, AimdComponentRenderer> {
  const { getTokenProps, mode, components = {} } = options
  const messages = createAimdRendererMessages(options.locale, options.messages)
  const {
    AIMDItem,
    AIMDTag,
    AIMDStepRef,
    StepRenderer,
    CheckRenderer,
    PreviewRenderer,
  } = components

  const getMode = (): RenderMode => typeof mode === "function" ? mode() : mode
  const isPreview = () => getMode() === "preview"
  const getQuizPreview = (): ResolvedQuizPreviewOptions =>
    resolveQuizPreviewOptions(getMode(), options.quizPreview)

  return {
    var: async (node, ctx, children) => {
      const varNode = node as AimdVarNode
      const { id, scope } = varNode

      if (isPreview()) {
        if (PreviewRenderer) {
          return h(PreviewRenderer, { type: "var" }, {
            default: () => children,
            name: () => id,
          })
        }
        return renderPreviewTag(scope, id, messages)
      }

      // Edit mode
      if (getTokenProps && AIMDItem) {
        const item = await getTokenProps({ meta: { node: { id, scope } } })
        if (item) {
          return h("span", {
            "class": "aimd-field-wrapper aimd-field-wrapper--inline",
            "id": `${scope}-${id}`,
            "data-has-variable": "true",
          }, [h(AIMDItem, item)])
        }
      }

      return renderPreviewTag(scope, id, messages)
    },

    var_table: async (node, ctx, children) => {
      const tableNode = node as AimdVarTableNode
      const { id, scope, columns } = tableNode

      if (isPreview()) {
        if (PreviewRenderer) {
          return h(PreviewRenderer, { type: "var_table" }, {
            default: () => children,
            name: () => id,
          })
        }
        // Preview mode: render inline tag with columns info
        return renderPreviewTag(scope, id, messages, columns)
      }

      // Edit mode
      if (getTokenProps && AIMDTag) {
        const item = await getTokenProps({ meta: { node: { id, scope } } })
        return h(AIMDTag, { ...item, props: columns })
      }

      return renderPreviewTag(scope, id, messages, columns)
    },

    quiz: async (node, ctx, children) => {
      const quizNode = node as AimdQuizNode
      const { id, scope, quizType, stem, score } = quizNode
      const typeLabel = getAimdRendererQuizTypeLabel(quizType, messages)

      if (isPreview()) {
        if (PreviewRenderer) {
          return h(PreviewRenderer, { type: "quiz" }, {
            default: () => children,
            name: () => id,
          })
        }
        const previewChildren: VNode[] = [
          h("div", { class: "aimd-quiz__meta" }, [
            h("span", { class: "aimd-field__scope" }, getAimdRendererScopeLabel(scope, messages)),
            h("span", { class: "aimd-field__name" }, id),
            h("span", { class: "aimd-field__type" }, `(${typeLabel})`),
            score !== undefined ? h("span", { class: "aimd-quiz__score" }, messages.quiz.score(score)) : null,
          ]),
          h("div", { class: "aimd-quiz__stem" }, buildQuizStemChildren(quizType, stem || id)),
        ]

        if (quizType === "choice" && Array.isArray(quizNode.options) && quizNode.options.length > 0) {
          previewChildren.push(
            h("ul", { class: "aimd-quiz__options" }, quizNode.options.map(opt =>
              h("li", `${opt.key}. ${opt.text}`),
            )),
          )
        }

        const quizPreview = getQuizPreview()

        if (quizPreview.showAnswers && quizType === "choice" && quizNode.answer !== undefined) {
          const answerText = Array.isArray(quizNode.answer)
            ? quizNode.answer.join(", ")
            : String(quizNode.answer)
          if (answerText.trim()) {
            previewChildren.push(
              h("div", { class: "aimd-quiz__answer" }, messages.quiz.answer(answerText)),
            )
          }
        }

        if (quizPreview.showAnswers && quizType === "blank" && Array.isArray(quizNode.blanks) && quizNode.blanks.length > 0) {
          previewChildren.push(
            h("ul", { class: "aimd-quiz__blanks" }, quizNode.blanks.map(blank =>
              h("li", `${blank.key}: ${blank.answer}`),
            )),
          )
        }

        if (quizPreview.showRubric && quizType === "open" && typeof quizNode.rubric === "string" && quizNode.rubric.trim()) {
          previewChildren.push(
            h("div", { class: "aimd-quiz__rubric" }, messages.quiz.rubric(quizNode.rubric)),
          )
        }

        return h("div", {
          "class": "aimd-field aimd-field--quiz",
          "data-aimd-type": "quiz",
          "data-aimd-id": id,
        }, previewChildren)
      }

      // Edit mode
      if (getTokenProps && AIMDItem) {
        const item = await getTokenProps({ meta: { node: { id, scope } } })
        if (item) {
          return h("span", {
            "class": "aimd-field-wrapper aimd-field-wrapper--inline",
            "id": `${scope}-${id}`,
            "data-has-variable": "true",
          }, [h(AIMDItem, item)])
        }
      }

      return h("div", {
        "class": "aimd-field aimd-field--quiz",
        "data-aimd-type": "quiz",
        "data-aimd-id": id,
      }, [
        h("div", { class: "aimd-quiz__meta" }, [
          h("span", { class: "aimd-field__scope" }, getAimdRendererScopeLabel(scope, messages)),
          h("span", { class: "aimd-field__name" }, id),
          h("span", { class: "aimd-field__type" }, `(${typeLabel})`),
        ]),
        h("div", { class: "aimd-quiz__stem" }, buildQuizStemChildren(quizType, stem || id)),
      ])
    },

    step: async (node, ctx, children) => {
      const stepNode = node as AimdStepNode
      const { id, scope, step, check } = stepNode

      if (isPreview()) {
        if (PreviewRenderer) {
          return h(PreviewRenderer, { type: "step" }, {
            default: () => children,
            name: () => id,
          })
        }
        return h("span", { class: "research-step__sequence" }, messages.step.sequence(step))
      }

      // Edit mode
      if (getTokenProps && StepRenderer) {
        const item = await getTokenProps({ meta: { node: { id, scope } } })
        const annotationItem = await getTokenProps({ meta: { node: { id, scope, type: "step-annotation" } } })

        return h(StepRenderer, {
          item,
          annotationItem,
          name: id,
          step: String(step),
          check,
        }, {
          default: () => children,
        })
      }

      return h("span", { class: "research-step__sequence" }, messages.step.sequence(step))
    },

    check: async (node, ctx, children) => {
      const checkNode = node as AimdCheckNode
      const { id, scope, label } = checkNode

      if (isPreview()) {
        if (PreviewRenderer) {
          return h(PreviewRenderer, { type: "check" }, {
            default: () => children,
            name: () => id,
          })
        }
        return renderPreviewTag(scope, id, messages)
      }

      // Edit mode
      if (getTokenProps && CheckRenderer) {
        const item = await getTokenProps({ meta: { node: { id, scope } } })
        const annotationItem = await getTokenProps({ meta: { node: { id, scope, type: "check-annotation" } } })

        return h(CheckRenderer, {
          item,
          annotationItem,
          name: id,
        }, {
          default: () => children,
        })
      }

      return renderPreviewTag(scope, id, messages)
    },

    ref_step: (node, ctx) => {
      const { id } = node
      const refTarget = "refTarget" in node ? node.refTarget : id

      if (AIMDStepRef) {
        return h(AIMDStepRef, { name: refTarget, type: "step" })
      }

      return h("a", {
        class: "aimd-ref aimd-ref--step",
        href: `#step-${refTarget}`,
      }, [
        h("span", { class: "aimd-ref__icon" }, "🔗"),
        h("span", { class: "aimd-ref__name" }, refTarget),
      ])
    },

    ref_var: (node, ctx) => {
      const { id } = node
      const refTarget = "refTarget" in node ? node.refTarget : id

      if (AIMDStepRef) {
        return h(AIMDStepRef, {
          name: refTarget,
          type: "var",
          contextValue: ctx.value,
        })
      }

      return h("a", {
        class: "aimd-ref aimd-ref--var",
        href: `#var-${refTarget}`,
      }, [
        h("span", { class: "aimd-ref__icon" }, "📌"),
        h("span", { class: "aimd-ref__name" }, refTarget),
      ])
    },
  }
}

/**
 * Create element renderers based on options
 */
function createElementRenderers(options: UnifiedTokenRendererOptions): Record<string, ElementRenderer> {
  const { getStaticResearchAssets, highlighter, components = {} } = options
  const { AssetRenderer, EmbeddedRenderer, MermaidBlock } = components

  const renderers: Record<string, ElementRenderer> = {}

  // Image renderer
  if (AssetRenderer || getStaticResearchAssets) {
    renderers.img = (node, children, ctx) => {
      const { src, alt } = node.properties || {}

      if (AssetRenderer) {
        return h(AssetRenderer, {
          src: src as string,
          alt: alt as string,
          getStaticResearchAssets,
        })
      }

      return h("img", { src, alt, class: "aimd-image", loading: "lazy" })
    }
  }

  // Code block renderer with Mermaid support
  renderers.pre = (node, children, ctx) => {
    const codeNode = node.children.find(
      (child): child is Element => child.type === "element" && child.tagName === "code",
    )

    if (!codeNode) {
      return h("pre", {}, children)
    }

    // Get language
    const className = codeNode.properties?.className
    let lang = "text"
    if (Array.isArray(className)) {
      const langClass = className.find(c => typeof c === "string" && c.startsWith("language-"))
      if (langClass && typeof langClass === "string") {
        lang = langClass.replace("language-", "")
      }
    }

    // Get code content
    const codeContent = codeNode.children
      .map(child => (child.type === "text" ? child.value : ""))
      .join("")

    // Check for Mermaid
    const firstLine = codeContent.split(/\n/)[0].trim()
    const isMermaid = lang === "mermaid"
      || firstLine === "gantt"
      || firstLine === "sequenceDiagram"
      || /^graph (?:TB|BT|RL|LR|TD);?$/.test(firstLine)

    if (isMermaid && MermaidBlock) {
      return h(MermaidBlock, { code: codeContent })
    }

    // Use Shiki if available
    const hl = typeof highlighter === "function" ? highlighter() : highlighter
    if (hl) {
      try {
        const highlightedHtml = hl.codeToHtml(codeContent, {
          lang,
          theme: "github-dark",
        })
        return h("div", {
          "class": "shiki-code-block",
          "data-lang": lang,
          "innerHTML": highlightedHtml,
        })
      }
      catch (error) {
        console.error("Failed to highlight code:", error)
      }
    }

    // Fallback
    return h("pre", { class: `language-${lang}` }, h("code", { class: `language-${lang}` }, codeContent),
    )
  }

  // Iframe renderer
  if (EmbeddedRenderer) {
    renderers.iframe = (node, children, ctx) => {
      return h(EmbeddedRenderer, {
        contentProps: { ...node.properties, credentialless: true },
        component: "iframe",
      })
    }

    // Video renderer
    renderers.video = (node, children, ctx) => {
      return h(EmbeddedRenderer, {
        contentProps: node.properties,
        component: "video",
      })
    }
  }

  return renderers
}

/**
 * Unified token renderer context
 * Compatible interface for migration from markdown-it
 */
export interface UnifiedRendererContext {
  /**
   * Render markdown/AIMD content to Vue VNodes
   */
  render: (content: string) => Promise<RenderResult>
  /**
   * Extract fields from content
   */
  extractFields: (content: string) => ExtractedAimdFields
  /**
   * Vue renderer options (for use with renderToVue)
   */
  vueOptions: VueRendererOptions
}

/**
 * Create unified-based token renderer
 * Provides API compatible with createDefaultTokenRenderer from markdown-it version
 */
export function createUnifiedTokenRenderer(options: UnifiedTokenRendererOptions): UnifiedRendererContext {
  const getMode = (): RenderMode => typeof options.mode === "function" ? options.mode() : options.mode
  const getQuizPreview = (): ResolvedQuizPreviewOptions =>
    resolveQuizPreviewOptions(getMode(), options.quizPreview)
  const locale = resolveAimdRendererLocale(options.locale)
  const messages = createAimdRendererMessages(locale, options.messages)

  const aimdRenderers = createAimdRenderers(options)
  const elementRenderers = createElementRenderers(options)

  const vueOptions: VueRendererOptions = {
    locale,
    messages,
    context: {
      mode: getMode() === "timeline" ? "preview" : getMode() as "preview" | "edit" | "report",
      readonly: getMode() === "preview",
      quizPreview: getQuizPreview(),
      locale,
      messages,
    },
    aimdRenderers,
    elementRenderers,
  }

  return {
    async render(content: string): Promise<RenderResult> {
      return renderToVue(content, {
        gfm: true,
        math: true,
        breaks: true,
        ...vueOptions,
      })
    },

    extractFields(content: string): ExtractedAimdFields {
      return parseAndExtract(content)
    },

    vueOptions,
  }
}

// Re-export types for convenience
export type { ExtractedAimdFields, RenderResult, VueRendererOptions }
