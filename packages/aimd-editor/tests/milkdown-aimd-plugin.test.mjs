import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const pluginPath = resolve(__dirname, '../src/vue/milkdown-aimd-plugin.ts')
const source = readFileSync(pluginPath, 'utf8')

function getToMarkdownBlock(content) {
  const match = content.match(/toMarkdown:\s*\{[\s\S]*?\n\s*}\s*,\n\s*}\s*as NodeSchema\)\)/)
  if (!match) {
    throw new Error('Unable to find aimd_field toMarkdown block')
  }
  return match[0]
}

function getPluginListBlock(content) {
  const match = content.match(/export const aimdMilkdownPlugins:[\s\S]*?=\s*\[[\s\S]*?\]\.flat\(\)/)
  if (!match) {
    throw new Error('Unable to find aimdMilkdownPlugins block')
  }
  return match[0]
}

test('aimd_field markdown serializer uses html node to preserve raw AIMD content', () => {
  const toMarkdownBlock = getToMarkdownBlock(source)
  assert.match(
    toMarkdownBlock,
    /state\.addNode\('html',\s*undefined,\s*`\{\{\$\{node\.attrs\.fieldType\}\|\$\{node\.attrs\.fieldContent\}\}\}`\)/,
  )
})

test('aimd_field markdown serializer does not use text node output', () => {
  const toMarkdownBlock = getToMarkdownBlock(source)
  assert.doesNotMatch(toMarkdownBlock, /state\.addNode\('text'/)
})

test('inline hardbreak schema override renders line break as <br> in WYSIWYG', () => {
  assert.match(source, /export const inlineHardbreakSchema = hardbreakSchema\.extendSchema\(/)
  assert.match(source, /toDOM:\s*\(node:\s*ProsemirrorNode\)\s*=>\s*\['br',\s*ctx\.get\(hardbreakAttr\.key\)\(node\)\]/)
})

test('inline hardbreak schema override is included in aimd plugin chain', () => {
  const pluginList = getPluginListBlock(source)
  assert.match(pluginList, /inlineHardbreakSchema/)
})
