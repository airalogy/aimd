import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const source = readFileSync(resolve(__dirname, '../components/AimdRecorder.vue'), 'utf8')

describe('AimdRecorder render stability', () => {
  it('uses a stable outlet component instead of recreating an inline dynamic component on each render', () => {
    expect(source).toMatch(/const InlineNodesOutlet = defineComponent\(/)
    expect(source).toMatch(/<InlineNodesOutlet :nodes="inlineNodes" \/>/)
    expect(source).not.toMatch(/<component :is="\(\) => inlineNodes" \/>/)
  })

  it('skips echo-style modelValue syncs when the incoming record signature matches local state', () => {
    expect(source).toMatch(/if \(!shouldRebuild\) \{\s*return\s*\}/)
  })
})
