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

async function waitForSelector(
  wrapper: ReturnType<typeof mount>,
  selector: string,
  attempts = 12,
) {
  for (let index = 0; index < attempts; index += 1) {
    await flushUi()
    if (wrapper.find(selector).exists()) {
      return
    }
  }

  throw new Error(`Timed out waiting for selector: ${selector}`)
}

describe('AimdRecorder form layout extraction', () => {
  it('keeps small inline vars on the same line even when separated by blank paragraphs', async () => {
    const wrapper = mount(AimdRecorder, {
      props: {
        content: '缓冲液类型：{{var|buffer_type: str = "PBS", title="buffer_type"}}\n\n处理时间：{{var|duration: float = 24.0}} 小时',
      },
    })

    await waitForSelector(wrapper, '.aimd-rec-inline--var-stacked')

    expect(wrapper.find('.aimd-form-item').exists()).toBe(false)
    expect(wrapper.text()).toContain('缓冲液类型')
    expect(wrapper.text()).toContain('处理时间')
    expect(wrapper.text()).toContain('小时')
    expect(wrapper.findAll('.aimd-rec-inline--var-stacked').length).toBeGreaterThanOrEqual(2)
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

  it('keeps auto-metadata vars inline even when separated by blank lines', async () => {
    const wrapper = mount(AimdRecorder, {
      props: {
        content: [
          '星际研究员：{{var|operator: UserName, title="星际研究员", description="自动填充当前登录用户的星际身份"}}',
          '',
          '时空坐标记录：{{var|record_time: CurrentTime, title="时空坐标记录", description="自动填充当前时间"}}',
          '',
          '量子签名 ID：{{var|current_record_id: CurrentRecordId, title="量子签名 ID", description="自动填充当前记录的唯一标识"}}',
        ].join('\n'),
        currentUserName: 'Ava Chen',
      },
    })

    await flushUi()

    expect(wrapper.find('.aimd-form-item').exists()).toBe(false)
    expect(wrapper.find('.aimd-form-item__meta').exists()).toBe(false)
    const paragraphs = wrapper.findAll('p')
    expect(paragraphs.length).toBeGreaterThanOrEqual(3)
    expect(wrapper.text()).toContain('星际研究员')
    expect(wrapper.text()).toContain('时空坐标记录')
    expect(wrapper.text()).toContain('量子签名 ID')
  })

  it('keeps check paragraphs inline even when separated by blank lines', async () => {
    const wrapper = mount(AimdRecorder, {
      props: {
        content: [
          '记录完成确认：{{check|confirm_record_complete}}',
          '',
          '样本密封确认：{{check|confirm_sample_sealed}}',
        ].join('\n'),
      },
    })

    await flushUi()

    expect(wrapper.find('.aimd-form-item').exists()).toBe(false)
    const paragraphs = wrapper.findAll('p')
    expect(paragraphs.length).toBeGreaterThanOrEqual(2)
    expect(wrapper.text()).toContain('记录完成确认')
    expect(wrapper.text()).toContain('样本密封确认')
  })

})
