import type { Plugin } from "unified"
import type { AimdRendererOptions } from "./processor"
import type { AimdAssignerVisibility } from "./processor"
import { createAimdRendererMessages } from "../locales"
import {
  buildInlineStyle,
  decorateHighlightedCodeHtml,
  escapeHtml,
  getCodeBlockPresentation,
  renderAssignerFlowHtml,
  resolveCodeLanguageBadge,
} from "./codeBlockPresentation"

/**
 * Internal markdown AST node shape used during remark processing.
 */
export interface MarkdownNode {
  type: string
  children?: MarkdownNode[]
  lang?: string | null
  meta?: string | null
  value?: string
}

export type MarkdownParent = MarkdownNode & { children: MarkdownNode[] }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function resolveAssignerVisibility(
  visibility: AimdRendererOptions["assignerVisibility"],
): AimdAssignerVisibility {
  switch (visibility) {
    case "collapsed":
    case "expanded":
      return visibility
    default:
      return "hidden"
  }
}

export function isAssignerCodeNode(node: MarkdownNode): boolean {
  return node.type === "code" && (node.lang || "").trim().toLowerCase() === "assigner"
}

export function getAssignerRuntime(meta: string | null | undefined): "client" | "server" {
  const runtime = String((meta || "").match(/\bruntime\s*=\s*([^\s]+)/)?.[1] || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .toLowerCase()
  return runtime === "client" ? "client" : "server"
}

export function getRenderedAssignerLanguage(runtime: "client" | "server"): "javascript" | "python" {
  return runtime === "client" ? "javascript" : "python"
}

function createAssignerHeaderHtml(
  summary: string,
  language: string,
  runtime: "client" | "server",
): string {
  const presentation = getCodeBlockPresentation(runtime === "client" ? "client" : "server")
  return `<span style="${presentation.headerMainStyle}">`
    + `<span style="${presentation.titleStyle}">${escapeHtml(summary)}</span>`
    + `<span style="${presentation.metaStyle}">Calculation logic</span>`
    + "</span>"
    + `<span aria-hidden="true" style="${presentation.badgeStyle}">${resolveCodeLanguageBadge(language)}</span>`
}

function createAssignerBodyHtml(
  value: string,
  runtime: "client" | "server",
): string {
  const language = getRenderedAssignerLanguage(runtime)
  const presentation = getCodeBlockPresentation(runtime === "client" ? "client" : "server")
  const flowHtml = renderAssignerFlowHtml(value, presentation)
  const codeHtml = `<pre class="aimd-assigner-preview__pre" data-aimd-skip-code-card="true" style="${presentation.preStyle}"><code class="language-${language} aimd-assigner-preview__code" data-aimd-skip-code-card="true" style="${presentation.codeStyle}">${escapeHtml(value)}</code></pre>`

  return flowHtml
    + `<div style="${presentation.preShellStyle}">${decorateHighlightedCodeHtml(codeHtml, presentation)}</div>`
}

// ---------------------------------------------------------------------------
// Assigner AST node builders
// ---------------------------------------------------------------------------

function buildExpandedAssignerNode(
  value: string,
  runtime: "client" | "server",
  options: AimdRendererOptions,
): MarkdownNode {
  const messages = createAimdRendererMessages(options.locale, options.messages)
  const language = getRenderedAssignerLanguage(runtime)
  const summary = runtime === "client"
    ? messages.assigner.clientSummary
    : messages.assigner.serverSummary
  const presentation = getCodeBlockPresentation(runtime === "client" ? "client" : "server")

  return {
    type: "html",
    value:
      `<div class="aimd-assigner-preview aimd-assigner-preview--expanded aimd-assigner-preview--${runtime}" data-aimd-assigner-runtime="${runtime}" style="${presentation.containerStyle}">`
      + `<div style="${presentation.headerStyle}">`
      + createAssignerHeaderHtml(summary, language, runtime)
      + "</div>"
      + createAssignerBodyHtml(value, runtime)
      + "</div>",
  }
}

function buildCollapsedAssignerNode(
  value: string,
  runtime: "client" | "server",
  options: AimdRendererOptions,
): MarkdownNode {
  const messages = createAimdRendererMessages(options.locale, options.messages)
  const language = getRenderedAssignerLanguage(runtime)
  const summary = runtime === "client"
    ? messages.assigner.clientSummary
    : messages.assigner.serverSummary
  const presentation = getCodeBlockPresentation(runtime === "client" ? "client" : "server")

  return {
    type: "html",
    value:
      `<details class="aimd-assigner-preview aimd-assigner-preview--collapsed aimd-assigner-preview--${runtime}" data-aimd-assigner-runtime="${runtime}" style="${presentation.containerStyle}">`
      + `<summary style="${buildInlineStyle({
        ...Object.fromEntries(presentation.headerStyle.split(";").filter(Boolean).map(rule => {
          const [property, value] = rule.split(":")
          return [property, value]
        })),
        display: "block",
        padding: "0",
        cursor: "pointer",
        "list-style": "none",
      })}">`
      + `<div style="display:flex;flex-direction:column;gap:0">`
      + `<div style="${presentation.headerStyle}">`
      + createAssignerHeaderHtml(summary, language, runtime)
      + "</div>"
      + renderAssignerFlowHtml(value, presentation)
      + "</div>"
      + "</summary>"
      + `<div style="${presentation.bodyStyle}">`
      + `<div style="${presentation.preShellStyle}">${decorateHighlightedCodeHtml(`<pre class="aimd-assigner-preview__pre" data-aimd-skip-code-card="true" style="${presentation.preStyle}"><code class="language-${language} aimd-assigner-preview__code" data-aimd-skip-code-card="true" style="${presentation.codeStyle}">${escapeHtml(value)}</code></pre>`, presentation)}</div>`
      + "</div>"
      + "</details>",
  }
}

// ---------------------------------------------------------------------------
// Tree visitor
// ---------------------------------------------------------------------------

export function visitMarkdownParents(node: MarkdownNode, visitor: (parent: MarkdownParent) => void): void {
  if (!Array.isArray(node.children)) {
    return
  }

  const parent = node as MarkdownParent
  visitor(parent)

  for (const child of parent.children) {
    visitMarkdownParents(child, visitor)
  }
}

// ---------------------------------------------------------------------------
// Remark plugins
// ---------------------------------------------------------------------------

/**
 * Remark plugin that inserts visible assigner preview nodes (collapsed or
 * expanded) next to each assigner code block in the markdown AST.
 */
export const remarkInsertVisibleAssigners: Plugin<[AimdRendererOptions?], MarkdownNode> = (options = {}) => {
  return (tree) => {
    const visibility = resolveAssignerVisibility(options.assignerVisibility)
    if (visibility === "hidden") {
      return
    }

    visitMarkdownParents(tree, (parent) => {
      for (let index = 0; index < parent.children.length; index++) {
        const child = parent.children[index]
        if (!isAssignerCodeNode(child)) {
          continue
        }

        const runtime = getAssignerRuntime(child.meta)
        const replacement = visibility === "expanded"
          ? buildExpandedAssignerNode(child.value || "", runtime, options)
          : buildCollapsedAssignerNode(child.value || "", runtime, options)

        parent.children.splice(index, 0, replacement)
        index += 1
      }
    })
  }
}

/**
 * Remark plugin that strips all assigner code blocks from the markdown AST.
 */
export const remarkStripAssignerCodeBlocks: Plugin<[], MarkdownNode> = () => {
  return (tree) => {
    visitMarkdownParents(tree, (parent) => {
      parent.children = parent.children.filter(child => !isAssignerCodeNode(child))
    })
  }
}
