import { describe, expect, it } from 'vitest'

import {
  createAimdSyntaxTheme,
  createCssVars,
  defaultDark,
  defaultLight,
  resolveAimdTheme,
  type AimdSyntaxScopes,
} from '../index'

const scopes: AimdSyntaxScopes = {
  punctuation: ['punctuation.definition.begin.aimd', 'punctuation.definition.end.aimd'],
  variableKeyword: 'keyword.variable.aimd',
  variableTableKeyword: 'keyword.variable-table.aimd',
  stepKeyword: ['keyword.step.aimd', 'keyword.checkpoint.aimd'],
  referenceKeyword: ['keyword.reference.variable.aimd', 'keyword.reference.step.aimd'],
  variable: 'variable.other.aimd',
  type: 'support.type.aimd',
  parameter: 'variable.parameter.aimd',
  delimiterStrong: ['delimiter.pipe.aimd', 'delimiter.bracket.aimd'],
  delimiterMuted: ['delimiter.parameter.aimd', 'delimiter.colon.aimd'],
  string: 'string.quoted.aimd',
  number: 'constant.numeric.aimd',
  boolean: 'constant.language.aimd',
  subvars: 'keyword.other.subvars.aimd',
}

describe('@airalogy/aimd-theme', () => {
  it('exposes light and dark defaults', () => {
    expect(defaultLight.mode).toBe('light')
    expect(defaultDark.mode).toBe('dark')
  })

  it('resolves partial overrides against the correct base theme', () => {
    const theme = resolveAimdTheme({
      mode: 'dark',
      text: {
        primary: '#ffffff',
      },
    })

    expect(theme.mode).toBe('dark')
    expect(theme.text.primary).toBe('#ffffff')
    expect(theme.text.muted).toBe(defaultDark.text.muted)
  })

  it('creates scoped css vars including recorder legacy aliases', () => {
    const vars = createCssVars()

    expect(vars['--aimd-color-text']).toBe(defaultLight.text.primary)
    expect(vars['--rec-text']).toBe(defaultLight.text.primary)
    expect(vars['--aimd-var-bg']).toBe(defaultLight.state.var.background)
  })

  it('creates a syntax theme registration from semantic syntax tokens', () => {
    const theme = createAimdSyntaxTheme(scopes, {
      syntax: {
        ...defaultLight.syntax,
        keywordVariable: '#123456',
      },
    })

    expect(theme.name).toBe('aimd-theme')
    expect(theme.settings.length).toBeGreaterThan(0)
    expect(theme.settings.some(item => item.settings.foreground === '#123456')).toBe(true)
  })
})
