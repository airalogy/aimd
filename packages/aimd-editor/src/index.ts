/**
 * @airalogy/aimd-editor
 *
 * AIMD Monaco editor integration
 *
 * This package provides language config and themes for AIMD.
 */

export { language, conf, completionItemProvider } from "./language-config"
export { aimdTokenColors, aimdTheme, createAimdExtendedTheme } from "./theme"
export {
  AimdToken,
  AimdTokenDefinition,
  AimdSuffix,
  DelimiterDefinition,
  KeywordDefinition,
  MarkupDefinition,
  scopeName,
} from "./tokens"
