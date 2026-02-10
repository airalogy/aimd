/**
 * Vue rendering exports
 */

export {
  type AimdComponentRenderer,
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

export type {
  RenderContext,
  RenderMode,
  ProcessorOptions,
} from '@airalogy/aimd-core/types'

export type { RenderResult } from '../common/processor'
