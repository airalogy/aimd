/**
 * AIMD Utility Functions
 *
 * Provides helper functions for working with AIMD data structures.
 * These ensure consistent handling of subvars and other AIMD fields.
 */

import type { AimdSubvar, AimdTemplateEnv, AimdVarTableField, ExtractedAimdFields, LegacyFieldsFormat } from "../types/aimd"

/**
 * Normalize subvars to AimdSubvar[] format
 * Handles both string[] and object[] input formats
 */
export function normalizeSubvars(
  subvars: Array<string | AimdSubvar> | undefined | null,
): AimdSubvar[] {
  if (!subvars || !Array.isArray(subvars))
    return []

  return subvars.map((item) => {
    if (typeof item === "string") {
      return { name: item }
    }
    return item
  })
}

/**
 * Get subvar names as string array
 * Useful for table headers and simple displays
 */
export function getSubvarNames(
  subvars: Array<string | AimdSubvar> | undefined | null,
): string[] {
  if (!subvars || !Array.isArray(subvars))
    return []

  return subvars.map(item =>
    typeof item === "string" ? item : item.name,
  )
}

/**
 * Get a specific subvar definition by name
 */
export function getSubvarDef(
  subvars: Array<string | AimdSubvar> | undefined | null,
  name: string,
): AimdSubvar | undefined {
  if (!subvars || !Array.isArray(subvars))
    return undefined

  const item = subvars.find(s =>
    typeof s === "string" ? s === name : s.name === name,
  )

  if (!item)
    return undefined
  return typeof item === "string" ? { name: item } : item
}

/**
 * Check if subvars array has any items
 */
export function hasSubvars(
  subvars: Array<string | AimdSubvar> | undefined | null,
): boolean {
  return Array.isArray(subvars) && subvars.length > 0
}

/**
 * Convert ExtractedAimdFields to legacy format for backward compatibility
 */
export function toLegacyFieldsFormat(fields: ExtractedAimdFields): LegacyFieldsFormat {
  return {
    rv: fields.var.reduce((acc, name) => {
      acc[name] = { label: name, type: "text", required: false }
      return acc
    }, {} as Record<string, { label: string, type: string, required?: boolean }>),

    rs: fields.step.reduce((acc, name) => {
      acc[name] = { label: name, type: "step" }
      return acc
    }, {} as Record<string, { label: string, type: string }>),

    rc: fields.check.reduce((acc, name) => {
      acc[name] = { label: name, type: "checkbox" }
      return acc
    }, {} as Record<string, { label: string, type: string }>),

    rt: fields.var_table.reduce((acc, table) => {
      acc[table.name] = {
        label: table.name,
        type: "table",
        columns: getSubvarNames(table.subvars),
      }
      return acc
    }, {} as Record<string, { label: string, type: string, columns?: string[] }>),

    var: fields.var,
    step: fields.step,
    check: fields.check,
    var_table: fields.var_table.map(t => [t.name, getSubvarNames(t.subvars)] as [string, string[]]),
  }
}

/**
 * Convert ExtractedAimdFields to AimdTemplateEnv
 * This is the canonical way to build env for field parsing
 */
export function toTemplateEnv(fields: ExtractedAimdFields): AimdTemplateEnv {
  // Build step hierarchy record
  const byName: Record<string, unknown> = {}
  const byLevel: Record<number, unknown[]> = {}

  if (fields.stepHierarchy) {
    for (const step of fields.stepHierarchy) {
      const node = {
        name: step.name,
        scope: "research_step",
        level: step.level ?? 0,
        step: step.step,
        parent: step.parentName ? byName[step.parentName] : null,
        prev: step.prevName ? byName[step.prevName] : null,
        hasChildren: false,
        hasContent: true,
        siblings: [],
        next: null,
      }

      byName[step.name] = node

      const level = step.level ?? 0
      if (!byLevel[level]) {
        byLevel[level] = []
      }
      byLevel[level].push(node)

      // Link prev/next siblings
      if (step.prevName && byName[step.prevName]) {
        (byName[step.prevName] as Record<string, unknown>).next = node
      }
    }
  }

  return {
    fields,
    typed: {},
    record: {
      byName,
      byLevel,
      byScope: {
        rv: {},
        rs: byName,
        rc: {},
        rt: {},
      },
    },
    tables: fields.var_table.map((table): [string, AimdVarTableField] => [
      table.name,
      {
        name: table.name,
        scope: "rt",
        subvars: normalizeSubvars(table.subvars),
        link: table.link,
        type_annotation: table.type_annotation,
        auto_item_type: table.auto_item_type,
        list_item_type: table.list_item_type,
      },
    ]),
    refs: {
      ref_step: fields.ref_step.map((name, idx) => ({ name, line: 0, sequence: idx })),
      rv_ref: fields.ref_var.map((name, idx) => ({ name, line: 0, sequence: idx })),
    },
  }
}

/**
 * Merge var_table info from template into field structure
 * Used when backend doesn't have complete var_table definitions
 */
export function mergeVarTableInfo(
  fieldInfo: Record<string, unknown>,
  tableField: AimdVarTableField,
): Record<string, unknown> {
  return {
    ...fieldInfo,
    type: "table",
    subvars: normalizeSubvars(tableField.subvars),
    link: tableField.link,
    type_annotation: tableField.type_annotation,
    auto_item_type: tableField.auto_item_type,
    list_item_type: tableField.list_item_type,
  }
}

/**
 * Find a var_table field by name
 */
export function findVarTable(
  fields: ExtractedAimdFields,
  name: string,
): AimdVarTableField | undefined {
  return fields.var_table.find(t => t.name === name)
}

/**
 * Check if a field is a var_table
 */
export function isVarTableField(
  fields: ExtractedAimdFields,
  name: string,
): boolean {
  return fields.var_table.some(t => t.name === name)
}
