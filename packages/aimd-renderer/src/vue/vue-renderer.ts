import type { Element, Root as HastRoot, Text as HastText, RootContent } from "hast"
import type { Component, VNode, VNodeChild } from "vue"
import type { AimdNode, AimdStepNode, RenderContext } from "@airalogy/aimd-core/types"
import { defineComponent, Fragment, h } from "vue"

/**
 * Extended Element data type
 */
interface AimdElementData {
  aimd?: AimdNode
}

/**
 * AIMD component renderer function type
 * Can return VNode directly or a Promise for async rendering
 */
export type AimdComponentRenderer = (
  node: AimdNode,
  ctx: RenderContext,
  children?: VNodeChild[]
) => VNode | Promise<VNode> | null

/**
 * Element renderer function type
 */
export type ElementRenderer = (
  node: Element,
  children: VNodeChild[],
  ctx: RenderContext
) => VNode | null

/**
 * Scope display name mapping
 */
const SCOPE_DISPLAY_MAP: Record<string, string> = {
  rv: "VAR",
  rs: "STEP",
  rc: "CHECK",
  rt: "TABLE",
  var: "VAR",
  step: "STEP",
  check: "CHECK",
  var_table: "TABLE",
}

/**
 * Get display name for scope
 */
function getScopeDisplay(scope: string): string {
  return SCOPE_DISPLAY_MAP[scope] || scope.toUpperCase()
}

/**
 * Default AIMD component renderers
 */
const defaultAimdRenderers: Record<string, AimdComponentRenderer> = {
  var: (node, ctx) => {
    const { name, scope } = node
    const definition = "definition" in node ? node.definition : undefined

    if (ctx.mode === "preview") {
      return h("span", {
        "class": "aimd-field aimd-field--var",
        "data-aimd-type": "var",
        "data-aimd-name": name,
        "data-aimd-scope": scope,
      }, [
        h("span", { class: "aimd-field__scope" }, getScopeDisplay(scope)),
        h("span", { class: "aimd-field__name" }, name),
        definition?.type ? h("span", { class: "aimd-field__type" }, `: ${definition.type}`) : null,
      ])
    }

    // Edit mode - render as editable field with value display
    const fieldData = ctx.value?.[scope]?.[name]
    const value = typeof fieldData === "object" && fieldData !== null && "value" in fieldData
      ? (fieldData as { value: unknown }).value
      : fieldData
    const displayValue = value !== undefined && value !== null && value !== "" ? String(value) : name

    return h("span", {
      "class": "aimd-field aimd-field--var aimd-field--editable",
      "data-aimd-type": "var",
      "data-aimd-name": name,
      "data-aimd-scope": scope,
      "data-has-variable": "true",
      "id": `${scope}-${name}`,
    }, [
      h("span", { class: "aimd-field__value" }, displayValue),
    ])
  },

  var_table: (node, ctx) => {
    const { name } = node
    const columns = "columns" in node ? node.columns : []

    if (ctx.mode === "preview") {
      // Preview mode: render tag with table preview inside
      const children: VNodeChild[] = [
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

    // Edit mode: render empty container (will be replaced by AIMDTag component)
    return h("div", {
      "class": "aimd-field aimd-field--var-table aimd-field--editable",
      "data-aimd-type": "var_table",
      "data-aimd-name": name,
      "id": `rt-${name}`,
    })
  },

  step: (node, ctx, children) => {
    const { name, scope } = node
    const stepNode = node as AimdStepNode
    const stepNum = stepNode.step || "1"

    if (ctx.mode === "preview") {
      // Preview mode: render as "Step N :" format
      return h("span", {
        "class": "aimd-field aimd-field--step",
        "data-aimd-type": "step",
        "data-aimd-name": name,
        "data-aimd-step": stepNum,
        "id": `rs-${name}`,
      }, [
        h("span", { class: "aimd-field__scope" }, getScopeDisplay(scope)),
        h("span", { class: "aimd-field__step-num" }, `Step ${stepNum}`),
        h("span", { class: "aimd-field__name" }, name),
      ])
    }

    // Edit mode - render step container with children
    return h("div", {
      "class": "aimd-field aimd-field--step aimd-field--editable research-step__item",
      "data-aimd-type": "step",
      "data-aimd-name": name,
      "data-aimd-step": stepNum,
      "data-aimd-level": stepNode.level,
      "id": `rs-${name}`,
    }, [
      h("div", { class: "research-step__header" }, [
        h("span", { class: "research-step__sequence" }, `Step ${stepNum} :`),
      ]),
      children && children.length > 0
        ? h("div", { class: "research-step__content" }, children)
        : null,
    ])
  },

  check: (node, ctx, children) => {
    const { name, scope } = node
    const label = "label" in node ? node.label : name

    if (ctx.mode === "preview") {
      // Preview mode: render with checkbox (disabled)
      return h("label", {
        "class": "aimd-field aimd-field--check",
        "data-aimd-type": "check",
        "data-aimd-name": name,
        "id": `rc-${name}`,
      }, [
        h("input", {
          type: "checkbox",
          disabled: true,
          class: "aimd-checkbox",
        }),
        h("span", { class: "aimd-field__label" }, label),
      ])
    }

    // Edit mode: create reactive checkbox component
    return defineComponent({
      setup() {
        return () => {
          const checked = ctx.value?.[scope]?.[name]?.checked ?? false

          return h("label", {
            "class": "aimd-field aimd-field--check aimd-field--editable",
            "data-aimd-type": "check",
            "data-aimd-name": name,
            "id": `rc-${name}`,
          }, [
            h("input", {
              type: "checkbox",
              checked,
              disabled: ctx.readonly,
              class: "aimd-checkbox",
              onChange: (e: Event) => {
                if (ctx.value && scope in ctx.value) {
                  if (!ctx.value[scope][name]) {
                    ctx.value[scope][name] = {}
                  }
                  ctx.value[scope][name].checked = (e.target as HTMLInputElement).checked
                }
              },
            }),
            h("span", { class: "aimd-field__label" }, label),
            children && children.length > 0 ? children : null,
          ])
        }
      },
    })()
  },

  ref_step: (node, ctx) => {
    const { name } = node
    const refTarget = "refTarget" in node ? node.refTarget : name

    // Render as blockquote-style reference with step sequence format
    // Format: "Step N >" just like the original step rendering
    return h("span", {
      "class": "aimd-ref aimd-ref--step",
      "data-aimd-type": "ref_step",
      "data-aimd-ref": refTarget,
    }, [
      h("span", { class: "aimd-ref__content" }, [
        h("span", { class: "research-step__sequence" }, `${refTarget}`),
      ]),
    ])
  },

  ref_var: (node, ctx) => {
    const { name } = node
    const refTarget = "refTarget" in node ? node.refTarget : name

    // Render as blockquote-style reference with the variable field content
    return h("span", {
      "class": "aimd-ref aimd-ref--var",
      "data-aimd-type": "ref_var",
      "data-aimd-ref": refTarget,
    }, [
      h("span", { class: "aimd-ref__content" }, [
        h("span", { class: "aimd-field aimd-field--var" }, [
          h("span", { class: "aimd-field__scope" }, "VAR"),
          h("span", { class: "aimd-field__name" }, refTarget),
        ]),
      ]),
    ])
  },

  ref_fig: (node, ctx) => {
    const { name } = node
    const refTarget = "refTarget" in node ? node.refTarget : name
    const figureNumber = "figureNumber" in node ? (node as any).figureNumber : undefined

    // Display figure number if available, otherwise show ID
    const displayText = figureNumber !== undefined ? `Figure ${figureNumber}` : `FIGURE ${refTarget}`

    // Render as link reference to the figure
    return h("a", {
      "class": "aimd-ref aimd-ref--fig",
      "data-aimd-type": "ref_fig",
      "data-aimd-ref": refTarget,
      "href": `#rf-${refTarget}`,
    }, [
      h("span", { class: "aimd-ref__content" }, displayText),
    ])
  },

  cite: (node, ctx) => {
    const refs = "refs" in node ? (node as any).refs : [node.name]

    return h("span", {
      "class": "aimd-cite",
      "data-aimd-type": "cite",
      "data-aimd-refs": refs.join(","),
    }, [
      h("span", { class: "aimd-cite__refs" }, `[${refs.join(", ")}]`),
    ])
  },

  fig: (node, ctx) => {
    const figNode = node as any
    const figId = figNode.id || node.name
    const figSrc = figNode.src || ""
    const figTitle = figNode.title
    const figLegend = figNode.legend
    const figSequence = figNode.sequence

    const children: VNodeChild[] = []

    // Image element
    children.push(
      h("img", {
        class: "aimd-figure__image",
        src: figSrc,
        alt: figTitle || figId,
        loading: "lazy",
      }),
    )

    // Caption (title + legend)
    if (figTitle || figLegend || figSequence !== undefined) {
      const captionChildren: VNodeChild[] = []

      // Figure number and title
      if (figSequence !== undefined || figTitle) {
        const titleText = figSequence !== undefined
          ? `Figure ${figSequence + 1}${figTitle ? `: ${figTitle}` : ""}`
          : figTitle
        captionChildren.push(
          h("div", { class: "aimd-figure__title" }, titleText),
        )
      }

      // Legend
      if (figLegend) {
        captionChildren.push(
          h("div", { class: "aimd-figure__legend" }, figLegend),
        )
      }

      children.push(
        h("figcaption", { class: "aimd-figure__caption" }, captionChildren),
      )
    }

    return h("figure", {
      "class": "aimd-figure",
      "data-aimd-type": "fig",
      "data-aimd-fig-id": figId,
      "data-aimd-fig-src": figSrc,
      "id": `rf-${figId}`,
    }, children)
  },
}

/**
 * Render options
 */
export interface VueRendererOptions {
  /**
   * Render context
   */
  context?: RenderContext
  /**
   * Custom AIMD component renderers
   * Override default renderers or add new ones
   */
  aimdRenderers?: Record<string, AimdComponentRenderer>
  /**
   * Custom HTML element renderers
   * Render specific HTML tags with custom components
   */
  elementRenderers?: Record<string, ElementRenderer>
  /**
   * Component map for rendering Vue components by tag name
   * e.g., { 'step-renderer': StepRendererComponent }
   */
  componentMap?: Record<string, Component>
}

/**
 * Default render context
 */
const defaultContext: RenderContext = {
  mode: "preview",
  readonly: false,
}

/**
 * Figure context for tracking figure numbers and references
 */
interface FigureContext {
  /** Map from fig ID to sequence number */
  figureNumbers: Map<string, number>
  /** Current figure sequence counter */
  sequence: number
}

/**
 * Create initial figure context
 */
function createFigureContext(): FigureContext {
  return {
    figureNumbers: new Map(),
    sequence: 0,
  }
}

/**
 * Pre-process HAST tree to assign figure numbers
 */
function preprocessFigures(node: HastRoot | RootContent, figCtx: FigureContext): void {
  if (node.type === "root") {
    for (const child of node.children) {
      preprocessFigures(child, figCtx)
    }
    return
  }

  if (node.type === "element") {
    const element = node as Element
    const aimdType = element.properties?.["data-aimd-type"] || element.properties?.dataAimdType

    // Process fig nodes
    if (aimdType === "fig") {
      const figId = element.properties?.["data-aimd-fig-id"] || element.properties?.dataAimdFigId
      if (figId && typeof figId === "string") {
        // Assign sequence number if not already assigned
        if (!figCtx.figureNumbers.has(figId)) {
          figCtx.figureNumbers.set(figId, figCtx.sequence)
          figCtx.sequence++
        }

        // Update AIMD node data if present
        const aimdData = (element.data as AimdElementData | undefined)?.aimd
        if (aimdData && "sequence" in aimdData) {
          (aimdData as any).sequence = figCtx.figureNumbers.get(figId)
        }
      }
    }

    // Recursively process children
    for (const child of element.children || []) {
      preprocessFigures(child, figCtx)
    }
  }
}

/**
 * Parse AIMD node from HAST element properties
 */
function parseAimdFromProps(props: Record<string, unknown>): AimdNode | null {
  // Try to get from JSON attribute first
  const jsonData = props["data-aimd-json"] || props.dataAimdJson
  if (jsonData && typeof jsonData === "string") {
    try {
      return JSON.parse(jsonData) as AimdNode
    }
    catch (e) {
      console.warn("Failed to parse AIMD JSON:", e)
    }
  }

  // Reconstruct from individual properties
  const fieldType = (props["data-aimd-type"] || props.dataAimdType) as string
  const name = (props["data-aimd-name"] || props.dataAimdName) as string
  const scope = (props["data-aimd-scope"] || props.dataAimdScope) as string
  const raw = (props["data-aimd-raw"] || props.dataAimdRaw) as string

  if (!fieldType || !name) {
    return null
  }

  const baseNode = {
    type: "aimd" as const,
    fieldType: fieldType as AimdNode["fieldType"],
    name,
    scope: (scope || "rv") as AimdNode["scope"],
    raw: raw || `{{${fieldType}|${name}}}`,
  }

  // Add step-specific properties
  if (fieldType === "step") {
    const step = (props["data-aimd-step"] || props.dataAimdStep) as string
    const level = Number.parseInt((props["data-aimd-level"] || props.dataAimdLevel) as string || "0", 10)
    return {
      ...baseNode,
      fieldType: "step",
      level,
      sequence: 0,
      step: step || "1",
    } as AimdNode
  }

  // Add fig-specific properties
  if (fieldType === "fig") {
    const figId = (props["data-aimd-fig-id"] || props.dataAimdFigId) as string
    const figSrc = (props["data-aimd-fig-src"] || props.dataAimdFigSrc) as string
    return {
      ...baseNode,
      fieldType: "fig",
      id: figId || name,
      src: figSrc || "",
      title: undefined,
      legend: undefined,
    } as AimdNode
  }

  return baseNode as AimdNode
}

/**
 * Convert HAST element properties to Vue props
 */
function convertProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const props: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(properties)) {
    // Convert className to class
    if (key === "className") {
      props.class = Array.isArray(value) ? value.join(" ") : value
    }
    else if (key === "htmlFor") {
      props.for = value
    }
    else if (key.startsWith("data")) {
      // Convert camelCase data attributes to kebab-case
      const dataKey = key.replace(/([A-Z])/g, "-$1").toLowerCase()
      props[dataKey] = value
    }
    else {
      props[key] = value
    }
  }

  return props
}

/**
 * Void elements that don't have children
 */
const VOID_ELEMENTS = new Set([
  "img",
  "br",
  "hr",
  "input",
  "meta",
  "link",
  "area",
  "base",
  "col",
  "embed",
  "param",
  "source",
  "track",
  "wbr",
])

/**
 * Convert HAST node to Vue VNode
 */
export function hastToVue(
  node: HastRoot | RootContent,
  options: VueRendererOptions = {},
  figCtx?: FigureContext,
): VNodeChild {
  const {
    context = defaultContext,
    aimdRenderers = {},
    elementRenderers = {},
    componentMap = {},
  } = options

  // Merge custom renderers with defaults
  const mergedAimdRenderers = { ...defaultAimdRenderers, ...aimdRenderers }

  // Initialize figure context on root
  if (!figCtx && node.type === "root") {
    figCtx = createFigureContext()
    preprocessFigures(node, figCtx)
  }

  // Handle root node
  if (node.type === "root") {
    const children = node.children
      .map(child => hastToVue(child, options, figCtx))
      .filter(Boolean)
    return h(Fragment, null, children)
  }

  // Handle text node
  if (node.type === "text") {
    return (node as HastText).value
  }

  // Handle element node
  if (node.type === "element") {
    const element = node as Element
    const { tagName, properties = {}, children = [] } = element

    // Check for AIMD node
    const aimdType = properties["data-aimd-type"] || properties.dataAimdType
    if (aimdType) {
      // Try to get AIMD data from node.data first
      let aimdData = (element.data as AimdElementData | undefined)?.aimd

      // If not found, parse from properties
      if (!aimdData) {
        aimdData = parseAimdFromProps(properties as Record<string, unknown>)
      }

      if (aimdData) {
        // Add figure sequence number if this is a fig node
        if (aimdData.fieldType === "fig" && figCtx) {
          const figId = (aimdData as any).id || aimdData.name
          const sequence = figCtx.figureNumbers.get(figId)
          if (sequence !== undefined) {
            (aimdData as any).sequence = sequence
          }
        }

        // Add figure number to ref_fig references
        if (aimdData.fieldType === "ref_fig" && figCtx) {
          const refTarget = "refTarget" in aimdData ? (aimdData as any).refTarget : aimdData.name
          const sequence = figCtx.figureNumbers.get(refTarget)
          if (sequence !== undefined) {
            (aimdData as any).figureNumber = sequence + 1
          }
        }

        const renderer = mergedAimdRenderers[aimdData.fieldType]
        if (renderer) {
          // Process children for container elements (step, check)
          const childVNodes = children
            .map(child => hastToVue(child, options, figCtx))
            .filter(Boolean)
          const result = renderer(aimdData, context, childVNodes)
          if (result) {
            return result
          }
        }
      }
    }

    // Check for component map
    if (componentMap[tagName]) {
      const childVNodes = children
        .map(child => hastToVue(child, options, figCtx))
        .filter(Boolean)
      return h(componentMap[tagName], convertProperties(properties as Record<string, unknown>), childVNodes)
    }

    // Check custom element renderer
    if (elementRenderers[tagName]) {
      const childVNodes = children
        .map(child => hastToVue(child, options, figCtx))
        .filter(Boolean)
      return elementRenderers[tagName](element, childVNodes, context)
    }

    // Convert properties
    const vueProps = convertProperties(properties as Record<string, unknown>)

    // Handle void elements
    if (VOID_ELEMENTS.has(tagName)) {
      return h(tagName, vueProps)
    }

    // Recursively process children
    const childVNodes = children
      .map(child => hastToVue(child, options, figCtx))
      .filter(Boolean)

    return h(tagName, vueProps, childVNodes)
  }

  // Handle comment node (ignore)
  if (node.type === "comment") {
    return null
  }

  // Handle doctype (ignore)
  if (node.type === "doctype") {
    return null
  }

  // Handle raw node
  if (node.type === "raw") {
    return h("span", {
      innerHTML: (node as any).value,
    })
  }

  return null
}

/**
 * Convert HAST tree to Vue VNode array
 */
export function renderToVNodes(
  tree: HastRoot,
  options: VueRendererOptions = {},
): VNode[] {
  const result = hastToVue(tree, options)

  if (result === null || result === undefined) {
    return []
  }

  if (Array.isArray(result)) {
    return result.filter((v): v is VNode => v !== null && typeof v === "object")
  }

  if (typeof result === "object" && "type" in result) {
    return [result as VNode]
  }

  // Wrap text node in span
  return [h("span", null, String(result))]
}

/**
 * Create a custom AIMD renderer that wraps a Vue component
 */
export function createComponentRenderer(
  component: Component,
  propsMapper?: (node: AimdNode, ctx: RenderContext) => Record<string, unknown>,
): AimdComponentRenderer {
  return (node, ctx, children) => {
    const props = propsMapper ? propsMapper(node, ctx) : { node, ctx }
    return h(component, props, children ? { default: () => children } : undefined)
  }
}

/**
 * Shiki highlighter type (compatible with @shikijs/core)
 */
export interface ShikiHighlighter {
  codeToHtml: (code: string, options: { lang: string, theme: string }) => string
  codeToTokensWithThemes?: (code: string, options: { lang: string, themes: Record<string, string> }) => Array<Array<{ content: string, variants: Record<string, { color: string }> }>>
}

/**
 * Create code block element renderer with Shiki support
 * @param highlighter - Shiki highlighter instance (can be reactive ref)
 * @param defaultTheme - Default theme to use
 */
export function createCodeBlockRenderer(
  highlighter: ShikiHighlighter | null | (() => ShikiHighlighter | null),
  defaultTheme = "github-dark",
): ElementRenderer {
  return (node, children, ctx) => {
    // Find code element inside pre
    const codeNode = node.children.find(
      (child): child is Element => child.type === "element" && child.tagName === "code",
    )

    if (!codeNode) {
      return h("pre", {}, children)
    }

    // Get language from class
    const className = codeNode.properties?.className
    let lang = "text"
    if (Array.isArray(className)) {
      const langClass = className.find(c => typeof c === "string" && c.startsWith("language-"))
      if (langClass && typeof langClass === "string") {
        lang = langClass.replace("language-", "")
      }
    }
    else if (typeof className === "string" && className.startsWith("language-")) {
      lang = className.replace("language-", "")
    }

    // Get code content
    const codeContent = codeNode.children
      .map(child => (child.type === "text" ? child.value : ""))
      .join("")

    // Get highlighter
    const hl = typeof highlighter === "function" ? highlighter() : highlighter

    // Use Shiki if available
    if (hl) {
      try {
        const highlightedHtml = hl.codeToHtml(codeContent, {
          lang,
          theme: defaultTheme,
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

    // Fallback: render without highlighting
    return h("pre", { class: `language-${lang}` }, h("code", { class: `language-${lang}` }, codeContent),
    )
  }
}

/**
 * Create Mermaid diagram element renderer
 * @param MermaidComponent - Vue component to render Mermaid diagrams
 */
export function createMermaidRenderer(
  MermaidComponent: Component,
): ElementRenderer {
  return (node, children, ctx) => {
    // Find code element inside pre
    const codeNode = node.children.find(
      (child): child is Element => child.type === "element" && child.tagName === "code",
    )

    if (!codeNode) {
      return null
    }

    // Check if it's a mermaid block
    const className = codeNode.properties?.className
    const isMermaid = Array.isArray(className)
      ? className.some(c => typeof c === "string" && c.includes("mermaid"))
      : typeof className === "string" && className.includes("mermaid")

    if (!isMermaid) {
      return null // Not a mermaid block, use default rendering
    }

    // Get code content
    const codeContent = codeNode.children
      .map(child => (child.type === "text" ? child.value : ""))
      .join("")

    return h(MermaidComponent, { code: codeContent })
  }
}

/**
 * Asset resolver function type
 */
export type AssetResolver = (id: string) => Promise<{ url: string } | null>

/**
 * Create image element renderer with asset resolution
 * @param AssetComponent - Vue component to render assets (optional)
 * @param getAsset - Function to resolve asset ID to URL
 */
export function createAssetRenderer(
  getAsset?: AssetResolver,
  AssetComponent?: Component,
): ElementRenderer {
  return (node, children, ctx) => {
    const { src, alt, title } = node.properties || {}

    // If AssetComponent is provided, use it
    if (AssetComponent) {
      return h(AssetComponent, {
        src: src as string,
        alt: alt as string,
        title: title as string,
        getStaticResearchAssets: getAsset,
      })
    }

    // Default image rendering
    return h("img", {
      src: src as string,
      alt: alt as string,
      title: title as string,
      class: "aimd-image",
      loading: "lazy",
    })
  }
}

/**
 * Create iframe/video element renderer for embedded content
 * @param EmbeddedComponent - Vue component to render embedded content
 */
export function createEmbeddedRenderer(
  EmbeddedComponent: Component,
): ElementRenderer {
  return (node, children, ctx) => {
    const props = node.properties || {}

    return h(EmbeddedComponent, {
      contentProps: props,
      component: node.tagName,
    })
  }
}
