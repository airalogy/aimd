import assert from 'node:assert/strict'
import { test } from 'node:test'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

import {
  protectAimdInlineTemplates,
  remarkAimd,
} from '../dist/parser.js'

function parseAimd(content) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkAimd)

  const { content: protectedContent, templates } = protectAimdInlineTemplates(content)
  const file = { data: { aimdInlineTemplates: templates } }
  const tree = processor.parse(protectedContent)
  processor.runSync(tree, file)

  return {
    tree,
    fields: file.data.aimdFields,
  }
}

// ── Choice quiz: single mode ─────────────────────────────────────────────────

test('quiz choice single: basic parsing', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q1
type: choice
mode: single
stem: "What is 1+1?"
options:
  - key: a
    text: "1"
  - key: b
    text: "2"
  - key: c
    text: "3"
answer: b
\`\`\`
`)
  assert.equal(fields.quiz.length, 1)
  const q = fields.quiz[0]
  assert.equal(q.id, 'q1')
  assert.equal(q.type, 'choice')
  assert.equal(q.mode, 'single')
  assert.equal(q.stem, 'What is 1+1?')
  assert.equal(q.options.length, 3)
  assert.equal(q.answer, 'b')
})

test('quiz choice single: default value', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q2
type: choice
mode: single
stem: "Pick one"
options:
  - key: x
    text: "X"
  - key: y
    text: "Y"
default: x
\`\`\`
`)
  assert.equal(fields.quiz[0].default, 'x')
})

// ── Choice quiz: multiple mode ───────────────────────────────────────────────

test('quiz choice multiple: parsing', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q3
type: choice
mode: multiple
stem: "Select all that apply"
options:
  - key: a
    text: "Option A"
  - key: b
    text: "Option B"
  - key: c
    text: "Option C"
answer:
  - a
  - c
\`\`\`
`)
  const q = fields.quiz[0]
  assert.equal(q.mode, 'multiple')
  assert.deepEqual(q.answer, ['a', 'c'])
})

// ── Choice quiz: with score ──────────────────────────────────────────────────

test('quiz choice: score is parsed', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q4
type: choice
mode: single
stem: "Scored question"
score: 5
options:
  - key: a
    text: "A"
  - key: b
    text: "B"
answer: a
\`\`\`
`)
  assert.equal(fields.quiz[0].score, 5)
})

// ── Choice quiz: extra fields ────────────────────────────────────────────────

test('quiz choice: extra fields preserved', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q5
type: choice
mode: single
stem: "With hint"
options:
  - key: a
    text: "A"
  - key: b
    text: "B"
hint: "Think carefully"
\`\`\`
`)
  assert.equal(fields.quiz[0].extra?.hint, 'Think carefully')
})

// ── Blank quiz ───────────────────────────────────────────────────────────────

test('quiz blank: basic parsing', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q6
type: blank
stem: "The capital of France is [[b1]]"
blanks:
  - key: b1
    answer: Paris
\`\`\`
`)
  const q = fields.quiz[0]
  assert.equal(q.type, 'blank')
  assert.equal(q.blanks.length, 1)
  assert.equal(q.blanks[0].key, 'b1')
  assert.equal(q.blanks[0].answer, 'Paris')
})

test('quiz blank: multiple blanks', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q7
type: blank
stem: "[[b1]] + [[b2]] = 3"
blanks:
  - key: b1
    answer: "1"
  - key: b2
    answer: "2"
\`\`\`
`)
  assert.equal(fields.quiz[0].blanks.length, 2)
})

test('quiz blank: default value as dict', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q8
type: blank
stem: "Answer: [[b1]]"
blanks:
  - key: b1
    answer: "42"
default:
  b1: "?"
\`\`\`
`)
  assert.deepEqual(fields.quiz[0].default, { b1: '?' })
})

test('quiz blank: single blank with string default', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q9
type: blank
stem: "Answer: [[b1]]"
blanks:
  - key: b1
    answer: "42"
default: "initial"
\`\`\`
`)
  assert.deepEqual(fields.quiz[0].default, { b1: 'initial' })
})

// ── Open quiz ────────────────────────────────────────────────────────────────

test('quiz open: basic parsing', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q10
type: open
stem: "Explain photosynthesis."
\`\`\`
`)
  const q = fields.quiz[0]
  assert.equal(q.type, 'open')
  assert.equal(q.stem, 'Explain photosynthesis.')
})

test('quiz open: with rubric', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q11
type: open
stem: "Describe the process."
rubric: "Must mention light and CO2."
\`\`\`
`)
  assert.equal(fields.quiz[0].rubric, 'Must mention light and CO2.')
})

test('quiz open: with default', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q12
type: open
stem: "Your answer?"
default: "Type here..."
\`\`\`
`)
  assert.equal(fields.quiz[0].default, 'Type here...')
})

// ── YAML validation errors (errors are caught internally, quiz is skipped) ───

test('quiz: missing id is skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
type: choice
mode: single
stem: "no id"
options:
  - key: a
    text: "A"
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz: missing type is skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad
stem: "no type"
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz: invalid type is skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad
type: essay
stem: "invalid type"
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz: missing stem is skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad
type: open
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz choice: missing mode is skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad
type: choice
stem: "no mode"
options:
  - key: a
    text: "A"
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz choice: invalid answer key is skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad
type: choice
mode: single
stem: "bad answer"
options:
  - key: a
    text: "A"
answer: z
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz choice: duplicate option keys are skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad
type: choice
mode: single
stem: "dup keys"
options:
  - key: a
    text: "A"
  - key: a
    text: "B"
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz blank: missing placeholder in stem is skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad
type: blank
stem: "No placeholder here"
blanks:
  - key: b1
    answer: "X"
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz blank: undefined placeholder is skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad
type: blank
stem: "Answer: [[b99]]"
blanks:
  - key: b1
    answer: "X"
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz blank: duplicate placeholder is skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad
type: blank
stem: "[[b1]] and [[b1]]"
blanks:
  - key: b1
    answer: "X"
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

test('quiz: negative score is skipped', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_bad
type: open
stem: "bad score"
score: -1
\`\`\`
`)
  assert.equal(fields.quiz.length, 0)
})

// ── Duplicate quiz ids are deduplicated ──────────────────────────────────────

test('quiz: duplicate quiz ids are deduplicated', () => {
  const { fields } = parseAimd(`
\`\`\`quiz
id: q_same
type: open
stem: "First"
\`\`\`

\`\`\`quiz
id: q_same
type: open
stem: "Second"
\`\`\`
`)
  assert.equal(fields.quiz.length, 1)
})
