import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mount } from '@vue/test-utils'
import type { AimdVarNode } from '@airalogy/aimd-core/types'
import { describe, expect, it } from 'vitest'

import AimdVarField from '../components/AimdVarField.vue'
import { createAimdRecorderMessages } from '../locales'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const source = readFileSync(resolve(__dirname, '../components/AimdVarField.vue'), 'utf8')

describe('AimdVarField render behavior', () => {
  function createNode(overrides: Partial<AimdVarNode> = {}): AimdVarNode {
    return {
      id: 'mission_code',
      fieldType: 'var',
      scope: 'var',
      type: 'aimd',
      raw: '{{var|mission_code: str}}',
      definition: {
        type: 'str',
        kwargs: {},
      },
      ...overrides,
    } as AimdVarNode
  }

  it('shares compact layout syncing between textareas and single-line inputs', () => {
    expect(source).toMatch(/function syncCompactControlLayout\(control: HTMLInputElement \| HTMLTextAreaElement\)/)
    expect(source).toMatch(/if \(typeof HTMLTextAreaElement !== "undefined" && control instanceof HTMLTextAreaElement\) \{\s*syncAutoWrapTextareaHeight\(control\)\s*\}/)
  })

  it('resizes single-line inputs while the user types', () => {
    expect(source).toMatch(/onInput: \(event: Event\) => \{\s*const el = event\.target as HTMLInputElement\s*syncCompactControlLayout\(el\)\s*onVarChange\(el\.value\)\s*\}/)
  })

  it('renders code-like vars with the dedicated code editor field', () => {
    expect(source).toMatch(/const AimdCodeField = defineAsyncComponent\(\(\) => import\("\.\/AimdCodeField\.vue"\)\)/)
    expect(source).toMatch(/if \(inputKind === "code"\)/)
    expect(source).toMatch(/language: codeLanguage/)
    expect(source).toMatch(/"aimd-rec-inline--var-stacked--code"/)
  })

  it('renders metadata tooltip content for description and id', () => {
    expect(source).toMatch(/class: "aimd-var-tooltip"/)
    expect(source).toMatch(/class: "aimd-var-tooltip__type"/)
    expect(source).toMatch(/class: "aimd-var-tooltip__description"/)
    expect(source).toMatch(/class: "aimd-var-tooltip__meta"/)
  })

  it('uses the title as placeholder without rendering extra var chrome', () => {
    const wrapper = mount(AimdVarField, {
      props: {
        node: createNode({
          id: 'mission_code',
          definition: {
            id: 'mission_code',
            type: 'str',
            kwargs: {
              title: '任务代号',
              description: '星际联邦任务编码',
            },
          },
        }),
        disabled: false,
        extraClasses: [],
        messages: createAimdRecorderMessages('zh-CN'),
        displayValue: 'PRO-2024-001',
        inputKind: 'text',
        initialized: true,
      },
    })

    const input = wrapper.find('textarea')
    expect(input.attributes('placeholder')).toBe('任务代号')
    expect(wrapper.find('.aimd-var-watermark').exists()).toBe(false)
    expect(wrapper.find('.aimd-var-tooltip__title').text()).toBe('任务代号')
  })

  it('omits placeholder when no title is provided', () => {
    const wrapper = mount(AimdVarField, {
      props: {
        node: createNode({
          id: 'mission_code',
          definition: {
            id: 'mission_code',
            type: 'str',
            kwargs: {},
          },
        }),
        disabled: false,
        extraClasses: [],
        messages: createAimdRecorderMessages('en-US'),
        displayValue: 'PRO-2024-001',
        inputKind: 'text',
        initialized: true,
      },
    })

    expect(wrapper.find('textarea').attributes('placeholder')).toBeUndefined()
  })
})
