import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import AimdRecorder from '../components/AimdRecorder.vue'

async function flushUi() {
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 20))
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 20))
  await nextTick()
}

describe('AimdRecorder form layout extraction', () => {
  it('promotes label-style var paragraphs into top-aligned form items', async () => {
    const wrapper = mount(AimdRecorder, {
      props: {
        content: '缓冲液类型：{{var|buffer_type: str = "PBS", title="buffer_type"}}\n\n处理时间：{{var|duration: float = 24.0}} 小时',
      },
    })

    await flushUi()

    const items = wrapper.findAll('.aimd-form-item')
    expect(items).toHaveLength(2)
    expect(items[0].find('.aimd-form-item__label-text').text()).toBe('缓冲液类型')
    expect(items[0].find('.aimd-form-item__meta').text()).toBe('buffer_type')
    expect(items[1].find('.aimd-form-item__label-text').text()).toBe('处理时间')
    expect(items[1].find('.aimd-form-item__meta').text()).toBe('duration')
    expect(items[1].find('.aimd-form-item__suffix').text()).toBe('小时')
  })

  it('keeps narrative inline vars inside normal paragraph flow', async () => {
    const wrapper = mount(AimdRecorder, {
      props: {
        content: '将 {{var|cell_line_name: str = "Hela-X7", title="cell_line_name"}} 细胞从维度 D-199 传送至当前实验室。',
      },
    })

    await flushUi()

    expect(wrapper.find('.aimd-form-item').exists()).toBe(false)
    expect(wrapper.find('p').text()).toContain('传送至当前实验室')
    expect(wrapper.find('.aimd-var-watermark').exists()).toBe(false)
  })

  it('renders file id vars with the built-in asset field instead of a plain text input', async () => {
    const wrapper = mount(AimdRecorder, {
      props: {
        content: '细胞处理前照片：{{var|cell_before_photo: FileIdPNG, title="细胞处理前照片", description="能量处理前的细胞形态"}}',
      },
    })

    await flushUi()

    expect(wrapper.find('.aimd-form-item').exists()).toBe(true)
    expect(wrapper.find('.aimd-asset-field').exists()).toBe(true)
    expect(wrapper.find('.aimd-asset-field__trigger').text()).toContain('细胞处理前照片')
    expect(wrapper.find('.aimd-var-tooltip__type').text()).toBe('FileIdPNG')
  })

  it('passes resolveFile through to built-in asset vars for historical previews', async () => {
    const wrapper = mount(AimdRecorder, {
      props: {
        content: '细胞处理前照片：{{var|cell_before_photo: FileIdPNG, title="细胞处理前照片"}}',
        modelValue: {
          var: {
            cell_before_photo: 'airalogy.id.file.demo.png',
          },
        },
        resolveFile: (src: string) => src === 'airalogy.id.file.demo.png' ? 'https://example.com/demo.png' : src,
      },
    })

    await flushUi()

    expect((wrapper.find('.aimd-asset-field__media--image').element as HTMLImageElement).getAttribute('src')).toBe('https://example.com/demo.png')
  })
})
