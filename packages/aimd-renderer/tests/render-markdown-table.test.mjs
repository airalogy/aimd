import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseAndExtract, renderToHtml } from '../dist/html.js'

const TABLE_WITH_INLINE_VAR = `
| Ingredient | Amount |
| --- | --- |
| Water | {{var|water_volume_ml: float}} mL |
`

const EXTRACTED_ID_SAMPLE = `
{{var_table|samples, subvars=[sample_id, concentration, volume]}}

{{step|sample_preparation}}
{{step|data_analysis}}
`

test('renderToHtml renders inline var inside markdown table without escape syntax', async () => {
  const { html, fields } = await renderToHtml(TABLE_WITH_INLINE_VAR)

  assert.match(html, /data-aimd-id="water_volume_ml"/)
  assert.doesNotMatch(html, /data-aimd-name=/)
  assert.match(html, /aimd-field--var/)
  assert.match(html, /<td><span class="aimd-field aimd-field--var"/)
  assert.deepEqual(fields.var, ['water_volume_ml'])
})

test('parseAndExtract finds inline vars inside markdown table', () => {
  const fields = parseAndExtract(TABLE_WITH_INLINE_VAR)

  assert.deepEqual(fields.var, ['water_volume_ml'])
})

test('parseAndExtract exposes canonical ids for extracted field objects', () => {
  const fields = parseAndExtract(EXTRACTED_ID_SAMPLE)

  assert.equal(fields.var_table[0]?.id, 'samples')
  assert.equal(fields.var_table[0]?.subvars?.[0]?.id, 'sample_id')
  assert.equal(fields.stepHierarchy?.[0]?.id, 'sample_preparation')
  assert.equal(fields.stepHierarchy?.[0]?.nextId, 'data_analysis')
  assert.equal(fields.stepHierarchy?.[1]?.prevId, 'sample_preparation')
})
