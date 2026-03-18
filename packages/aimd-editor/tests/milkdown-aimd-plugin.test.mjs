import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const pluginPath = resolve(__dirname, '../src/vue/milkdown-aimd-plugin.ts')
const editorPath = resolve(__dirname, '../src/vue/AimdEditor.vue')
const editorContentPath = resolve(__dirname, '../src/vue/useEditorContent.ts')
const dialogPath = resolve(__dirname, '../src/vue/AimdFieldDialog.vue')
const source = readFileSync(pluginPath, 'utf8')
const editorSource = readFileSync(editorPath, 'utf8')
const editorContentSource = readFileSync(editorContentPath, 'utf8')
const dialogSource = readFileSync(dialogPath, 'utf8')

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

test('milkdown remark plugin restores protected AIMD inline templates before matching', () => {
  assert.match(source, /import\s+\{\s*restoreAimdInlineTemplates\s*\}\s+from\s+'@airalogy\/aimd-core'/)
  assert.match(source, /node\.value\s*=\s*restoreAimdInlineTemplates\(node\.value\)/)
})

test('AimdEditor protects markdown before feeding content into Milkdown', () => {
  // After refactor, the protection logic lives in useEditorContent.ts and AimdWysiwygEditor.vue
  const contentSources = editorContentSource + '\n' + editorSource
  assert.match(editorContentSource, /import\s+\{\s*protectAimdInlineTemplates\s*\}\s+from\s+'@airalogy\/aimd-core'/)
  assert.match(editorContentSource, /function toMilkdownMarkdown\(markdown: string\): string \{\s*return protectAimdInlineTemplates\(markdown\)\.content\s*\}/)
})

test('AimdFieldDialog var type section exposes explained presets and keeps custom input', () => {
  assert.match(dialogSource, /aimd-var-type-grid/)
  assert.match(dialogSource, /aimd-var-type-card/)
  assert.match(dialogSource, /selectVarTypePreset/)
  assert.match(dialogSource, /CurrentTime/)
  assert.match(dialogSource, /UserName/)
  assert.match(dialogSource, /AiralogyMarkdown/)
  assert.match(dialogSource, /DNASequence/)
  assert.doesNotMatch(dialogSource, /<select v-model="fields\.type"/)
  assert.doesNotMatch(dialogSource, /aimd-var-type-suggestions/)
})
