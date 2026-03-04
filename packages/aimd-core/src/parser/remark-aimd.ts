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
  AimdVarNode,
  AimdVarTableNode,
} from "../types/nodes"
import type { ExtractedAimdFields } from "../types/aimd"
import {
  createStepContext,
  isVarTable,
  parseCheckContent,
  parseFigContent,
  parseStepContent,
  parseTableColumns,
  parseVarDefinition,
  registerStep,
  type StepContext,
} from "./field-parsers"
import { parseQuizContent } from "./quiz-parser"
import { SKIP, visit } from "unist-util-visit"

/**
 * Create AIMD node.
 */
function createAimdNode(
  fieldType: AimdFieldType,
  content: string,
  raw: string,
  stepContext?: StepContext,
): AimdNode {
  switch (fieldType) {
    case "var": {
      if (isVarTable(content)) {
        const { name, columns, definition } = parseTableColumns(content)
        return {
          type: "aimd",
          fieldType: "var_table",
          name,
          scope: "var_table",
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
        scope: "var",
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
        scope: "var_table",
        raw,
        columns,
        definition,
      } as AimdVarTableNode
    }

    case "step": {
      const { name, level, check, checkedMessage } = parseStepContent(content)
      const stepNode: AimdStepNode = {
        type: "aimd",
        fieldType: "step",
        name,
        scope: "step",
        raw,
        level,
        sequence: 0,
        step: "1",
        hasChildren: false,
        check,
      }

      if (checkedMessage) {
        ;(stepNode as any).checkedMessage = checkedMessage
      }

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
        scope: "check",
        raw,
        label,
      }

      if (checkedMessage) {
        ;(checkNode as any).checkedMessage = checkedMessage
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
        scope: fieldType as AimdScope,
        raw,
        refTarget: content.trim(),
      }

    case "cite": {
      const refs = content.split(",").map(r => r.trim()).filter(Boolean)
      return {
        type: "aimd",
        fieldType: "cite",
        name: refs[0] || content.trim(),
        scope: "cite",
        raw,
        refs,
      } as AimdCiteNode
    }

    case "quiz":
      throw new Error("Inline quiz syntax is not supported. Use a quiz code block instead.")

    case "fig":
      throw new Error("Inline fig syntax is not supported. Use a fig code block instead.")

    default: {
      const exhaustiveCheck: never = fieldType
      throw new Error(`Unsupported AIMD field type: ${String(exhaustiveCheck)}`)
    }
  }
}

/**
 * Find and replace AIMD syntax in text nodes.
 * Pattern: {{type|content}}
 */
type InlineContentNode = PhrasingContent | AimdNode

function processTextNode(node: Text, stepContext: StepContext): InlineContentNode[] {
  const { value } = node
  const result: InlineContentNode[] = []
  let lastIndex = 0

  // eslint-disable-next-line regexp/no-super-linear-backtracking
  const pattern = /\{\{(var_table|var|step|check|ref_step|ref_var|ref_fig|cite)\s*\|\s*([^}]+?)\s*\}\}/g

  let match: RegExpExecArray | null = pattern.exec(value)
  while (match !== null) {
    const [fullMatch, type, content] = match
    const startIndex = match.index

    if (startIndex > lastIndex) {
      result.push({
        type: "text",
        value: value.slice(lastIndex, startIndex),
      })
    }

    const aimdNode = createAimdNode(type as AimdFieldType, content, fullMatch, stepContext)
    result.push(aimdNode)

    lastIndex = startIndex + fullMatch.length
    match = pattern.exec(value)
  }

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
   * Whether to extract field information to VFile data.
   * @default true
   */
  extractFields?: boolean
  /**
   * Typed configuration for field properties.
   */
  typed?: Record<string, Record<string, any>>
}

/**
 * remark-aimd plugin.
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
 * - ```quiz blocks - Quiz definitions (choice / blank / open)
 * - ```fig blocks - Figure definitions
 */
const remarkAimd: Plugin<[RemarkAimdOptions?], Root> = (options = {}) => {
  const { extractFields = true } = options

  return (tree, file) => {
    const fields: ExtractedAimdFields = {
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

    const stepContext = createStepContext()

    // First pass: process fig/quiz code blocks.
    visit(tree, "code", (node: Code, index, parent) => {
      if (index === undefined || !parent)
        return

      const lang = (node.lang || "").trim().toLowerCase()

      if (lang === "fig") {
        try {
          const figData = parseFigContent(node.value)

          const figNode: AimdFigNode = {
            type: "aimd",
            fieldType: "fig",
            name: figData.id,
            scope: "fig",
            raw: node.value,
            id: figData.id,
            src: figData.src,
            title: figData.title,
            legend: figData.legend,
          }

          parent.children[index] = figNode as any

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

      if (lang === "quiz") {
        try {
          const quizData = parseQuizContent(node.value)

          parent.children[index] = quizData.node as any

          if (extractFields) {
            const existingQuiz = fields.quiz.find(q => q.id === quizData.field.id)
            if (!existingQuiz) {
              fields.quiz.push(quizData.field)
            }
          }
        }
        catch (error) {
          console.error("Failed to parse quiz block:", error)
        }
      }
    })

    visit(tree, "text", (node, index, parent) => {
      if (index === undefined || !parent)
        return

      const processed = processTextNode(node, stepContext)

      if (processed.length === 1 && processed[0] === node)
        return

      parent.children.splice(index, 1, ...(processed as unknown as PhrasingContent[]))

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
                  const subvarDefs = def?.subvars
                  const names = subvarDefs ? Object.keys(subvarDefs) : tableNode.columns
                  const subvars = names.map((name: string) => {
                    const subDef = subvarDefs?.[name]
                    const title = typeof subDef?.kwargs?.title === "string" ? subDef.kwargs.title : undefined
                    const description = typeof subDef?.kwargs?.description === "string" ? subDef.kwargs.description : undefined
                    return subDef
                      ? {
                          name,
                          type: subDef.type,
                          default: subDef.default,
                          title: title || name,
                          description,
                          kwargs: subDef.kwargs,
                        }
                      : { name }
                  })
                  fields.var_table.push({
                    name: aimdNode.name,
                    scope: "var_table",
                    subvars,
                    type_annotation: def?.type,
                  })
                }
                break
              }
              case "quiz":
                // quiz is collected from fenced code blocks in the first pass
                break
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

      return [SKIP, index + processed.length] as const
    })

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

    if (extractFields) {
      file.data.aimdFields = fields
    }

    file.data.stepContext = {
      byName: Object.fromEntries(stepContext.byName),
      allSteps: stepContext.allSteps,
    }
  }
}

export default remarkAimd
