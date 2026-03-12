import assert from 'node:assert/strict'
import { test } from 'node:test'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

import {
  protectAimdInlineTemplates,
  remarkAimd,
  restoreAimdInlineTemplates,
} from '../dist/parser.js'

function parseAimd(content) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkAimd)

  const { content: protectedContent, templates } = protectAimdInlineTemplates(content)
  const file = { data: { aimdInlineTemplates: templates } }
  const tree = processor.parse(protectedContent)
  processor.runSync(tree, file)

  return {
    tree,
    fields: file.data.aimdFields,
  }
}

function findAimdNode(node) {
  if (!node || typeof node !== 'object') {
    return null
  }

  if (node.type === 'aimd') {
    return node
  }

  if (!Array.isArray(node.children)) {
    return null
  }

  for (const child of node.children) {
    const found = findAimdNode(child)
    if (found) {
      return found
    }
  }

  return null
}

test('typed inline var inside markdown table is parsed as AIMD node', () => {
  const { tree, fields } = parseAimd(`
| Ingredient | Amount |
| --- | --- |
| Water | {{var|water_volume_ml: float}} mL |
`)

  const aimdNode = findAimdNode(tree)

  assert.equal(aimdNode?.fieldType, 'var')
  assert.equal(aimdNode?.id, 'water_volume_ml')
  assert.equal(aimdNode?.definition?.type, 'float')
  assert.equal(aimdNode?.definition?.id, 'water_volume_ml')
  assert.deepEqual(fields.var, ['water_volume_ml'])
})

test('template protection does not break normal inline vars', () => {
  const { tree, fields } = parseAimd('Water amount: {{var|water_volume_ml: float}} mL')
  const aimdNode = findAimdNode(tree)

  assert.equal(aimdNode?.fieldType, 'var')
  assert.equal(aimdNode?.id, 'water_volume_ml')
  assert.equal(aimdNode?.definition?.id, 'water_volume_ml')
  assert.deepEqual(fields.var, ['water_volume_ml'])
})

test('protected AIMD tokens can be restored without external template map', () => {
  const raw = '| Water | {{var|water_volume_ml: float}} mL |'
  const { content: protectedContent } = protectAimdInlineTemplates(raw)

  assert.notEqual(protectedContent, raw)
  assert.equal(restoreAimdInlineTemplates(protectedContent), raw)
})

test('extracted fields expose canonical id properties only', () => {
  const { fields } = parseAimd(`
{{var_table|samples, subvars=[sample_id, concentration, volume]}}

{{step|sample_preparation}}
{{step|data_analysis}}
`)

  assert.equal(fields.var_table[0]?.id, 'samples')
  assert.equal(fields.var_table[0]?.subvars?.[0]?.id, 'sample_id')

  assert.equal(fields.stepHierarchy?.[0]?.id, 'sample_preparation')
  assert.equal(fields.stepHierarchy?.[0]?.nextId, 'data_analysis')
  assert.equal(fields.stepHierarchy?.[1]?.id, 'data_analysis')
  assert.equal(fields.stepHierarchy?.[1]?.prevId, 'sample_preparation')
})
