/**
 * Vue rendering exports
 */

export {
  type AimdComponentRenderer,
  type AimdRendererContext,
  type AssetResolver,
  createAssetRenderer,
  createCodeBlockRenderer,
  createComponentRenderer,
  createEmbeddedRenderer,
  createMermaidRenderer,
  type ElementRenderer,
  hastToVue,
  renderToVNodes,
  type ShikiHighlighter,
  type VueRendererOptions,
} from './vue-renderer'

export {
  renderToVue,
  createRenderer,
  defaultRenderer,
} from '../common/processor'

export {
  createAimdRendererMessages,
  DEFAULT_AIMD_RENDERER_LOCALE,
  resolveAimdRendererLocale,
} from '../locales'

export type {
  RenderContext,
  RenderMode,
  ProcessorOptions,
} from '@airalogy/aimd-core/types'

export type { AimdRendererOptions, RenderResult } from '../common/processor'
export type {
  AimdRendererI18nOptions,
  AimdRendererLocale,
  AimdRendererMessages,
  AimdRendererMessagesInput,
} from '../locales'
