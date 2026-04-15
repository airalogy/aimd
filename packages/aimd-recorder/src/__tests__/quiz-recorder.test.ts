import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AimdQuizRecorder from '../components/AimdQuizRecorder.vue'

describe('AimdQuizRecorder', () => {
  it('renders quiz grading feedback when a grade result is provided', () => {
    const wrapper = mount(AimdQuizRecorder, {
      props: {
        locale: 'en-US',
        quiz: {
          id: 'quiz_open_1',
          type: 'open',
          stem: 'Explain why this happens',
          score: 5,
        },
        modelValue: 'Because of reaction rate and stability.',
        grade: {
          quiz_id: 'quiz_open_1',
          earned_score: 4,
          max_score: 5,
          status: 'partial',
          method: 'keyword_rubric',
          review_required: true,
          feedback: 'Mentioned rate but missed one rubric item.',
        },
      },
    })

    expect(wrapper.text()).toContain('Partial')
    expect(wrapper.text()).toContain('Score: 4 / 5')
    expect(wrapper.text()).toContain('Review required')
    expect(wrapper.text()).toContain('Mentioned rate but missed one rubric item.')
  })

  it('applies status-specific grading classes for quick visual distinction', () => {
    const wrapper = mount(AimdQuizRecorder, {
      props: {
        locale: 'en-US',
        quiz: {
          id: 'quiz_single_1',
          type: 'choice',
          stem: 'Pick one',
          score: 2,
          mode: 'single',
          options: [
            { key: 'A', text: 'A' },
            { key: 'B', text: 'B' },
          ],
        },
        modelValue: 'A',
        grade: {
          quiz_id: 'quiz_single_1',
          earned_score: 0,
          max_score: 2,
          status: 'incorrect',
          method: 'exact_match',
        },
      },
    })

    expect(wrapper.find('.aimd-quiz__grade-panel').classes()).toContain('aimd-quiz__grade-panel--incorrect')
    expect(wrapper.find('.aimd-quiz__grade-status').classes()).toContain('aimd-quiz__grade-status--incorrect')
    expect(wrapper.find('.aimd-quiz__grade-score').classes()).toContain('aimd-quiz__grade-score--incorrect')
  })

  it('hides the grade panel for unanswered ungraded quizzes', () => {
    const wrapper = mount(AimdQuizRecorder, {
      props: {
        locale: 'en-US',
        quiz: {
          id: 'quiz_single_1',
          type: 'choice',
          stem: 'Pick one',
          score: 2,
          mode: 'single',
          options: [
            { key: 'A', text: 'A' },
            { key: 'B', text: 'B' },
          ],
        },
        modelValue: undefined,
        grade: {
          quiz_id: 'quiz_single_1',
          earned_score: 0,
          max_score: 2,
          status: 'ungraded',
          method: 'manual',
        },
      },
    })

    expect(wrapper.find('.aimd-quiz__grade-panel').exists()).toBe(false)
  })

  it('shows selected choice option explanations when enabled', () => {
    const wrapper = mount(AimdQuizRecorder, {
      props: {
        locale: 'en-US',
        quiz: {
          id: 'quiz_single_explained',
          type: 'choice',
          stem: 'Pick one',
          score: 2,
          mode: 'single',
          options: [
            { key: 'A', text: 'Option A', explanation: 'Not the best answer.' },
            { key: 'B', text: 'Option B', explanation: 'Correct because it matches the requirement.' },
          ],
        },
        modelValue: 'B',
        choiceOptionExplanationMode: 'selected',
      },
    })

    expect(wrapper.text()).toContain('Correct because it matches the requirement.')
    expect(wrapper.text()).not.toContain('Not the best answer.')
  })

  it('shows selected choice option explanations only after submission when configured', async () => {
    const wrapper = mount(AimdQuizRecorder, {
      props: {
        locale: 'en-US',
        quiz: {
          id: 'quiz_single_submitted',
          type: 'choice',
          stem: 'Pick one',
          score: 2,
          mode: 'single',
          options: [
            { key: 'A', text: 'Option A', explanation: 'Not the best answer.' },
            { key: 'B', text: 'Option B', explanation: 'Correct because it matches the requirement.' },
          ],
        },
        modelValue: 'B',
        choiceOptionExplanationMode: 'submitted',
        submitted: false,
      },
    })

    expect(wrapper.text()).not.toContain('Correct because it matches the requirement.')

    await wrapper.setProps({ submitted: true })

    expect(wrapper.text()).toContain('Correct because it matches the requirement.')
    expect(wrapper.text()).not.toContain('Not the best answer.')
  })

  it('shows local scale grading only after submission when configured', async () => {
    const wrapper = mount(AimdQuizRecorder, {
      props: {
        locale: 'en-US',
        quiz: {
          id: 'quiz_scale_1',
          type: 'scale',
          title: 'GAD-7',
          stem: 'How often have you been bothered by the following problems?',
          display: 'list',
          items: [
            { key: 's1', stem: 'Feeling nervous' },
            { key: 's2', stem: 'Unable to relax' },
          ],
          options: [
            { key: '0', text: 'Not at all', points: 0 },
            { key: '1', text: 'Several days', points: 1 },
            { key: '2', text: 'More than half the days', points: 2 },
          ],
          grading: {
            strategy: 'sum',
            bands: [
              { min: 0, max: 1, label: 'Low' },
              { min: 2, max: 4, label: 'Moderate', interpretation: 'Consider follow-up.' },
            ],
          },
        },
        modelValue: {
          s1: '1',
          s2: '2',
        },
        scaleGradeDisplayMode: 'submitted',
        submitted: false,
      },
    })

    expect(wrapper.text()).not.toContain('Score: 3 / 4')
    expect(wrapper.text()).not.toContain('Moderate')

    await wrapper.setProps({ submitted: true })

    expect(wrapper.text()).toContain('Scored')
    expect(wrapper.text()).toContain('Score: 3 / 4')
    expect(wrapper.text()).toContain('Classification: Moderate')
    expect(wrapper.text()).toContain('Interpretation: Consider follow-up.')
  })
})
