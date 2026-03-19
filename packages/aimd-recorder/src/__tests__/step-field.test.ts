import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AimdStepNode } from '@airalogy/aimd-core/types'

import { createAimdRecorderMessages } from '../locales'
import { AimdStepField } from '../components/AimdStepCheckField.vue'
import { createEmptyStepRecordItem, startStepTimer } from '../composables/useStepTimers'

describe('AimdStepField', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function createBaseProps(nodeOverrides: Partial<AimdStepNode> = {}) {
    const node: AimdStepNode = {
      id: 'prepare',
      fieldType: 'step',
      scope: 'step',
      type: 'aimd',
      raw: '{{step|prepare}}',
      level: 1,
      sequence: 0,
      step: '1',
      check: false,
      estimated_duration_ms: 90_000,
      ...nodeOverrides,
    }

    return {
      locale: 'en-US',
      node,
      disabled: false,
      extraClasses: [] as string[],
      messages: createAimdRecorderMessages('en-US'),
    }
  }

  it('keeps timer controls and annotation input collapsed by default in auto mode', () => {
    const state = reactive(createEmptyStepRecordItem())
    const wrapper = mount(AimdStepField, {
      props: {
        ...createBaseProps(),
        state,
      },
    })

    expect(wrapper.text()).toContain('ETA 1m 30s')
    expect(wrapper.text()).not.toContain('Timer 0s')
    expect(wrapper.text()).toContain('Notes')
    expect(wrapper.text()).toContain('Timer')
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    expect(wrapper.find('.aimd-step-field__details').exists()).toBe(false)
    expect(wrapper.find('.aimd-step-field__detail--annotation').exists()).toBe(false)
  })

  it('renders a checkbox only when step check is enabled', () => {
    const state = reactive(createEmptyStepRecordItem())
    const wrapper = mount(AimdStepField, {
      props: {
        ...createBaseProps({
          check: true,
        }),
        state,
      },
    })

    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true)
  })

  it('shows the annotation detail when a note already exists in auto mode', () => {
    const state = reactive({
      ...createEmptyStepRecordItem(),
      annotation: 'Keep on ice',
    })
    const wrapper = mount(AimdStepField, {
      props: {
        ...createBaseProps(),
        state,
      },
    })

    expect(wrapper.find('.aimd-step-field__details').exists()).toBe(true)
    expect(wrapper.find('.aimd-step-field__detail--annotation').exists()).toBe(true)
    expect(wrapper.text()).toContain('Timer')
  })

  it('opens the annotation detail when clicking the notes toggle', async () => {
    const state = reactive(createEmptyStepRecordItem())
    const wrapper = mount(AimdStepField, {
      props: {
        ...createBaseProps(),
        state,
      },
      attachTo: document.body,
    })

    await wrapper.find('.aimd-step-field__toggle--annotation').trigger('click')
    await nextTick()

    expect(wrapper.find('.aimd-step-field__details').exists()).toBe(true)
    expect(wrapper.find('.aimd-step-field__detail--annotation').exists()).toBe(true)
    expect(wrapper.emitted('timer-start')).toBeFalsy()

    wrapper.unmount()
  })

  it('opens timer controls on demand in auto mode', async () => {
    const state = reactive(createEmptyStepRecordItem())
    const wrapper = mount(AimdStepField, {
      props: {
        ...createBaseProps(),
        state,
      },
    })

    await wrapper.find('.aimd-step-field__toggle--timer').trigger('click')

    expect(wrapper.find('.aimd-step-field__details').exists()).toBe(true)
    expect(wrapper.text()).toContain('Timer 0s')
    expect(wrapper.text()).toContain('Start')
    expect(wrapper.emitted('timer-start')).toBeTruthy()
  })

  it('renders estimated and recorded timing UI and updates while running in always mode', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(0))

    const state = reactive(createEmptyStepRecordItem())
    const wrapper = mount(AimdStepField, {
      props: {
        ...createBaseProps(),
        detailDisplay: 'always',
        state,
      },
    })

    expect(wrapper.text()).toContain('ETA 1m 30s')
    expect(wrapper.text()).toContain('Timer 0s')
    expect(wrapper.find('.aimd-step-timer__controls .aimd-step-timer__btn').text()).toBe('Start')

    await wrapper.find('.aimd-step-timer__controls .aimd-step-timer__btn').trigger('click')
    expect(wrapper.emitted('timer-start')).toBeTruthy()

    startStepTimer(state, Date.now())
    await nextTick()

    await vi.advanceTimersByTimeAsync(2_000)
    await nextTick()

    expect(wrapper.text()).toContain('Timer 2s')
    expect(wrapper.find('.aimd-step-timer__controls .aimd-step-timer__btn').text()).toBe('Pause')
  })

  it('auto-expands countdown mode and switches to warning and overtime states', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(0))

    const state = reactive(createEmptyStepRecordItem())
    const wrapper = mount(AimdStepField, {
      props: {
        ...createBaseProps({
          estimated_duration_ms: 30_000,
          timer_mode: 'countdown',
        }),
        state,
      },
    })

    expect(wrapper.find('.aimd-step-field__details').exists()).toBe(true)
    expect(wrapper.text()).toContain('Remain 30s')
    expect(wrapper.find('.aimd-step-timer__hero--countdown').exists()).toBe(true)

    await wrapper.find('.aimd-step-timer__controls .aimd-step-timer__btn').trigger('click')
    expect(wrapper.emitted('timer-start')).toBeTruthy()

    startStepTimer(state, Date.now())
    await nextTick()

    await vi.advanceTimersByTimeAsync(25_000)
    await nextTick()

    expect(wrapper.text()).toContain('Remain 5s')
    expect(wrapper.find('.aimd-step-timer__hero--warning').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(10_000)
    await nextTick()

    expect(wrapper.text()).toContain('Overtime 5s')
    expect(wrapper.find('.aimd-step-timer__hero--overtime').exists()).toBe(true)
  })

  it('shows countdown and elapsed time together in both mode', () => {
    const state = reactive(createEmptyStepRecordItem())
    const wrapper = mount(AimdStepField, {
      props: {
        ...createBaseProps({
          estimated_duration_ms: 60_000,
          timer_mode: 'both',
        }),
        state,
      },
    })

    expect(wrapper.find('.aimd-step-field__details').exists()).toBe(true)
    expect(wrapper.text()).toContain('Remain 1m')
    expect(wrapper.text()).toContain('Timer 0s')
  })
})
