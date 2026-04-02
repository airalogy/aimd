import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  gradeQuizAnswer,
  gradeQuizRecordAnswers,
} from '../dist/index.js'

test('gradeQuizAnswer: single choice exact match', async () => {
  const result = await gradeQuizAnswer({
    id: 'q_choice',
    type: 'choice',
    stem: 'Pick one',
    score: 2,
    mode: 'single',
    options: [
      { key: 'A', text: 'A' },
      { key: 'B', text: 'B' },
    ],
    answer: 'B',
  }, 'B')

  assert.equal(result.status, 'correct')
  assert.equal(result.earned_score, 2)
  assert.equal(result.method, 'exact_match')
})

test('gradeQuizAnswer: multiple choice partial credit', async () => {
  const result = await gradeQuizAnswer({
    id: 'q_multi',
    type: 'choice',
    stem: 'Pick all',
    score: 4,
    mode: 'multiple',
    options: [
      { key: 'A', text: 'A' },
      { key: 'B', text: 'B' },
      { key: 'C', text: 'C' },
    ],
    answer: ['A', 'B'],
    grading: {
      strategy: 'partial_credit',
    },
  }, ['A'])

  assert.equal(result.status, 'partial')
  assert.equal(result.earned_score, 2)
  assert.equal(result.method, 'partial_credit')
})

test('gradeQuizAnswer: unanswered single choice is ungraded', async () => {
  const result = await gradeQuizAnswer({
    id: 'q_choice_unanswered',
    type: 'choice',
    stem: 'Pick one',
    score: 2,
    mode: 'single',
    options: [
      { key: 'A', text: 'A' },
      { key: 'B', text: 'B' },
    ],
    answer: 'B',
  }, undefined)

  assert.equal(result.status, 'ungraded')
  assert.equal(result.earned_score, 0)
  assert.equal(result.method, 'manual')
})

test('gradeQuizAnswer: single choice option_points', async () => {
  const result = await gradeQuizAnswer({
    id: 'q_choice_points',
    type: 'choice',
    stem: 'Pick the best answer',
    mode: 'single',
    options: [
      { key: 'A', text: 'A' },
      { key: 'B', text: 'B' },
      { key: 'C', text: 'C' },
    ],
    grading: {
      strategy: 'option_points',
      option_points: {
        A: 0,
        B: 5,
        C: 2,
      },
    },
  }, 'C')

  assert.equal(result.status, 'partial')
  assert.equal(result.earned_score, 2)
  assert.equal(result.max_score, 5)
  assert.equal(result.method, 'option_points')
})

test('gradeQuizAnswer: multiple choice option_points clamps score range', async () => {
  const result = await gradeQuizAnswer({
    id: 'q_multi_points',
    type: 'choice',
    stem: 'Pick all',
    score: 4,
    mode: 'multiple',
    options: [
      { key: 'A', text: 'A' },
      { key: 'B', text: 'B' },
      { key: 'C', text: 'C' },
      { key: 'D', text: 'D' },
    ],
    grading: {
      strategy: 'option_points',
      option_points: {
        A: 1.5,
        B: 1.5,
        C: 1,
        D: -1,
      },
    },
  }, ['A', 'B', 'D'])

  assert.equal(result.status, 'partial')
  assert.equal(result.earned_score, 2)
  assert.equal(result.method, 'option_points')
})

test('gradeQuizAnswer: blank grading uses normalization and numeric tolerance', async () => {
  const result = await gradeQuizAnswer({
    id: 'q_blank',
    type: 'blank',
    stem: 'Result [[b1]] and [[b2]]',
    score: 4,
    blanks: [
      { key: 'b1', answer: '21%' },
      { key: 'b2', answer: '42' },
    ],
    grading: {
      strategy: 'normalized_match',
      blanks: [
        {
          key: 'b1',
          accepted_answers: ['21 %', '21%'],
          normalize: ['trim', 'remove_spaces'],
        },
        {
          key: 'b2',
          numeric: {
            target: 42,
            tolerance: 0.5,
          },
        },
      ],
    },
  }, {
    b1: ' 21 % ',
    b2: '42.4',
  })

  assert.equal(result.status, 'correct')
  assert.equal(result.earned_score, 4)
  assert.equal(result.blank_results.length, 2)
  assert.equal(result.blank_results[1].method, 'numeric_tolerance')
})

test('gradeQuizAnswer: open keyword rubric grading', async () => {
  const result = await gradeQuizAnswer({
    id: 'q_open',
    type: 'open',
    stem: 'Explain',
    grading: {
      strategy: 'keyword_rubric',
      rubric_items: [
        {
          id: 'rate',
          points: 2,
          desc: 'Mention reaction rate',
          keywords: ['rate'],
        },
        {
          id: 'stability',
          points: 3,
          desc: 'Mention stability',
          keywords: ['stability'],
        },
      ],
    },
  }, 'Temperature affects the reaction rate and sample stability.')

  assert.equal(result.status, 'correct')
  assert.equal(result.earned_score, 5)
  assert.equal(result.method, 'keyword_rubric')
  assert.equal(result.rubric_results.length, 2)
})

test('gradeQuizAnswer: provider-backed grading is supported', async () => {
  const result = await gradeQuizAnswer({
    id: 'q_llm',
    type: 'open',
    stem: 'Explain',
    score: 5,
    grading: {
      strategy: 'llm_rubric',
      provider: 'teacher_default',
    },
  }, 'My answer', {
    provider: ({ quiz, max_score, config }) => ({
      quiz_id: quiz.id,
      earned_score: 4,
      max_score,
      status: 'partial',
      method: 'llm',
      provider: config.provider,
      confidence: 0.9,
      feedback: 'Good answer overall.',
    }),
  })

  assert.equal(result.status, 'partial')
  assert.equal(result.provider, 'teacher_default')
  assert.equal(result.feedback, 'Good answer overall.')
})

test('gradeQuizAnswer: malformed provider output falls back to review', async () => {
  const result = await gradeQuizAnswer({
    id: 'q_llm_bad',
    type: 'open',
    stem: 'Explain',
    score: 5,
    grading: {
      strategy: 'llm_rubric',
      provider: 'teacher_default',
    },
  }, 'My answer', {
    provider: () => 'raw free-text answer from model',
  })

  assert.equal(result.status, 'needs_review')
  assert.equal(result.earned_score, 0)
  assert.equal(result.provider, 'teacher_default')
  assert.equal(result.feedback, 'A grading provider must return a structured result object.')
})

test('gradeQuizRecordAnswers: aggregates totals and review count', async () => {
  const report = await gradeQuizRecordAnswers([
    {
      id: 'q1',
      type: 'choice',
      stem: 'Pick one',
      score: 2,
      mode: 'single',
      options: [
        { key: 'A', text: 'A' },
        { key: 'B', text: 'B' },
      ],
      answer: 'A',
    },
    {
      id: 'q2',
      type: 'open',
      stem: 'Explain',
      score: 3,
      grading: {
        strategy: 'manual',
      },
    },
  ], {
    q1: 'A',
    q2: 'Some answer',
  })

  assert.equal(report.summary.total_earned_score, 2)
  assert.equal(report.summary.total_max_score, 5)
  assert.equal(report.summary.review_required_count, 1)
  assert.equal(report.quiz.q2.status, 'needs_review')
})
