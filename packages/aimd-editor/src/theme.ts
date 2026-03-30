import type { ThemeRegistration } from 'shiki'
import {
  createAimdSyntaxTheme,
  createAimdSyntaxTokenColors,
  resolveAimdTheme,
  type AimdSyntaxScopes,
  type AimdThemeInput,
} from '@airalogy/aimd-theme'
import { AimdToken } from './tokens'

export const AIMD_EDITOR_SYNTAX_SCOPES: AimdSyntaxScopes = {
  punctuation: [
    AimdToken.PUNCTUATION_DEFINITION_BEGIN_AIMD,
    AimdToken.PUNCTUATION_DEFINITION_END_AIMD,
  ],
  variableKeyword: [AimdToken.KEYWORD_VARIABLE_AIMD],
  variableTableKeyword: [AimdToken.KEYWORD_VARIABLE_TABLE_AIMD],
  stepKeyword: [
    AimdToken.KEYWORD_STEP_AIMD,
    AimdToken.KEYWORD_CHECKPOINT_AIMD,
    AimdToken.KEYWORD_CONTROL_AIMD,
  ],
  referenceKeyword: [
    AimdToken.KEYWORD_REFERENCE_VARIABLE_AIMD,
    AimdToken.KEYWORD_REFERENCE_STEP_AIMD,
  ],
  variable: [AimdToken.VARIABLE_OTHER_AIMD],
  type: [AimdToken.SUPPORT_TYPE_AIMD],
  parameter: [AimdToken.VARIABLE_PARAMETER_AIMD],
  delimiterStrong: [
    AimdToken.DELIMITER_PIPE_AIMD,
    AimdToken.DELIMITER_BRACKET_AIMD,
  ],
  delimiterMuted: [
    AimdToken.DELIMITER_COLON_AIMD,
    AimdToken.DELIMITER_PARAMETER_AIMD,
  ],
  string: [AimdToken.STRING_QUOTED_AIMD],
  number: [AimdToken.CONSTANT_NUMERIC_AIMD],
  boolean: [AimdToken.CONSTANT_LANGUAGE_AIMD],
  subvars: [AimdToken.KEYWORD_OTHER_SUBVARS_AIMD],
}

export const aimdTokenColors = createAimdSyntaxTokenColors(AIMD_EDITOR_SYNTAX_SCOPES)

export const aimdTheme: ThemeRegistration = createAimdSyntaxTheme(
  AIMD_EDITOR_SYNTAX_SCOPES,
) as ThemeRegistration

export function createAimdTheme(
  theme?: AimdThemeInput,
  name = 'aimd-theme',
): ThemeRegistration {
  return createAimdSyntaxTheme(AIMD_EDITOR_SYNTAX_SCOPES, theme, name) as ThemeRegistration
}

export function createAimdExtendedTheme(
  baseTheme: ThemeRegistration,
  name = 'aimd-extended',
  theme?: AimdThemeInput,
): ThemeRegistration {
  const baseSettings = baseTheme.settings || baseTheme.tokenColors || []

  return {
    ...baseTheme,
    name,
    type: resolveAimdTheme(theme).mode,
    settings: [
      ...baseSettings,
      ...createAimdSyntaxTokenColors(AIMD_EDITOR_SYNTAX_SCOPES, theme),
    ],
  }
}
