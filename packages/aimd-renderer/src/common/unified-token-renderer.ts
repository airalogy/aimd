import type { Element } from "hast"
/**
 * Unified-based token renderer
 * Provides compatibility layer for migrating from markdown-it tokenRenderer
 */
import type { Component, VNode } from "vue"
import type {
  AimdCheckNode,
  AimdStepNode,
  AimdVarNode,
  AimdVarTableNode,
} from "@airalogy/aimd-core/types"
import type { AimdNode, RenderContext } from "@airalogy/aimd-core/types"
import type { ExtractedAimdFields } from "@airalogy/aimd-core/types"
import type { AimdComponentRenderer, ElementRenderer, ShikiHighlighter, VueRendererOptions } from "../vue/vue-renderer"
import type { RenderResult } from "./processor"
import { h } from "vue"
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
      name: string
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
}

/**
 * Scope key mapping
 */
const SCOPE_KEY_RECORD: Record<string, string> = {
  rv: "var",
  rs: "step",
  rc: "check",
  rt: "table",
  research_variable: "var",
  research_step: "step",
  research_check: "check",
  var_table: "table",
}

/**
 * Get scope display key
 */
function getScopeKey(scope: string): string {
  return SCOPE_KEY_RECORD[scope] || scope
}

/**
 * Render preview tag for AIMD field
 */
function renderPreviewTag(
  scope: string,
  name: string,
  columns?: string[],
): VNode {
  const scopeKey = getScopeKey(scope)

  // var_table: render tag with table preview inside
  if (scope === "var_table" || scope === "rt") {
    const children: VNode[] = [
      h("div", { class: "aimd-field__header" }, [
        h("span", { class: "aimd-field__scope" }, "TABLE"),
        h("span", { class: "aimd-field__name" }, name),
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
      "data-aimd-name": name,
    }, children)
  }

  return h("span", {
    "class": "aimd-field aimd-field--var",
    "data-aimd-type": scopeKey,
    "data-aimd-name": name,
  }, [
    h("span", { class: "aimd-field__scope" }, scopeKey.toUpperCase()),
    h("span", { class: "aimd-field__name" }, name),
  ])
}

/**
 * Create AIMD renderers based on options
 */
function createAimdRenderers(options: UnifiedTokenRendererOptions): Record<string, AimdComponentRenderer> {
  const { getTokenProps, mode, components = {} } = options
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

  return {
    var: async (node, ctx, children) => {
      const varNode = node as AimdVarNode
      const { name, scope } = varNode

      if (isPreview()) {
        if (PreviewRenderer) {
          return h(PreviewRenderer, { type: "var" }, {
            default: () => children,
            name: () => name,
          })
        }
        return renderPreviewTag(scope, name)
      }

      // Edit mode
      if (getTokenProps && AIMDItem) {
        const item = await getTokenProps({ meta: { node: { name, scope } } })
        if (item) {
          return h("span", {
            "class": "aimd-field-wrapper aimd-field-wrapper--inline",
            "id": `${scope}-${name}`,
            "data-has-variable": "true",
          }, [h(AIMDItem, item)])
        }
      }

      return renderPreviewTag(scope, name)
    },

    var_table: async (node, ctx, children) => {
      const tableNode = node as AimdVarTableNode
      const { name, scope, columns } = tableNode

      if (isPreview()) {
        if (PreviewRenderer) {
          return h(PreviewRenderer, { type: "var_table" }, {
            default: () => children,
            name: () => name,
          })
        }
        // Preview mode: render inline tag with columns info
        return renderPreviewTag(scope, name, columns)
      }

      // Edit mode
      if (getTokenProps && AIMDTag) {
        const item = await getTokenProps({ meta: { node: { name, scope: "research_variable" } } })
        return h(AIMDTag, { ...item, props: columns })
      }

      return renderPreviewTag(scope, name, columns)
    },

    step: async (node, ctx, children) => {
      const stepNode = node as AimdStepNode
      const { name, scope, step, check } = stepNode

      if (isPreview()) {
        if (PreviewRenderer) {
          return h(PreviewRenderer, { type: "step" }, {
            default: () => children,
            name: () => name,
          })
        }
        return h("span", { class: "research-step__sequence" }, `Step ${step} :`)
      }

      // Edit mode
      if (getTokenProps && StepRenderer) {
        const item = await getTokenProps({ meta: { node: { name, scope } } })
        const annotationItem = await getTokenProps({ meta: { node: { name, scope, type: "rs-annotation" } } })

        return h(StepRenderer, {
          item,
          annotationItem,
          name,
          step: String(step),
          check,
        }, {
          default: () => children,
        })
      }

      return h("span", { class: "research-step__sequence" }, `Step ${step} :`)
    },

    check: async (node, ctx, children) => {
      const checkNode = node as AimdCheckNode
      const { name, scope, label } = checkNode

      if (isPreview()) {
        if (PreviewRenderer) {
          return h(PreviewRenderer, { type: "check" }, {
            default: () => children,
            name: () => name,
          })
        }
        return renderPreviewTag(scope, name)
      }

      // Edit mode
      if (getTokenProps && CheckRenderer) {
        const item = await getTokenProps({ meta: { node: { name, scope } } })
        const annotationItem = await getTokenProps({ meta: { node: { name, scope, type: "rc-annotation" } } })

        return h(CheckRenderer, {
          item,
          annotationItem,
          name,
        }, {
          default: () => children,
        })
      }

      return renderPreviewTag(scope, name)
    },

    ref_step: (node, ctx) => {
      const { name } = node
      const refTarget = "refTarget" in node ? node.refTarget : name

      if (AIMDStepRef) {
        return h(AIMDStepRef, { name: refTarget, type: "step" })
      }

      return h("a", {
        class: "aimd-ref aimd-ref--step",
        href: `#rs-${refTarget}`,
      }, [
        h("span", { class: "aimd-ref__icon" }, "🔗"),
        h("span", { class: "aimd-ref__name" }, refTarget),
      ])
    },

    ref_var: (node, ctx) => {
      const { name } = node
      const refTarget = "refTarget" in node ? node.refTarget : name

      if (AIMDStepRef) {
        return h(AIMDStepRef, {
          name: refTarget,
          type: "var",
          contextValue: ctx.value,
        })
      }

      return h("a", {
        class: "aimd-ref aimd-ref--var",
        href: `#rv-${refTarget}`,
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

  const aimdRenderers = createAimdRenderers(options)
  const elementRenderers = createElementRenderers(options)

  const vueOptions: VueRendererOptions = {
    context: {
      mode: getMode() === "timeline" ? "preview" : getMode() as "preview" | "edit" | "report",
      readonly: getMode() === "preview",
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
