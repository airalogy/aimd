/**
 * @airalogy/aimd-recorder
 *
 * AIMD editor Vue components and UI
 *
 * This package provides Vue components for editing and displaying AIMD content
 */

// Re-export styles
import './styles/aimd.css'
import { AimdProtocolRecorder as DeprecatedAimdProtocolRecorder } from './components'

export { AimdRecorder, AimdQuizRecorder } from './components'
export { AimdDnaSequenceField } from './components'
/**
 * @deprecated Use `AimdRecorder` instead.
 */
export const AimdProtocolRecorder = DeprecatedAimdProtocolRecorder
export {
  createAimdRecorderMessages,
  DEFAULT_AIMD_RECORDER_LOCALE,
  resolveAimdRecorderLocale,
} from './locales'
export type {
  AimdProtocolRecordData,
  AimdRecorderFieldAdapter,
  AimdRecorderFieldAdapterContext,
  AimdRecorderFieldAdapters,
  AimdRecorderFieldNode,
  AimdRecorderFieldNodeMap,
  AimdRecorderFieldType,
  AimdStepOrCheckRecordItem,
  AimdFieldMeta,
  AimdFieldState,
  AimdDnaSequenceAnnotation,
  AimdDnaSequenceQualifier,
  AimdDnaSequenceSegment,
  AimdDnaSequenceValue,
  FieldEventPayload,
  TableEventPayload,
} from './types'
export { createEmptyProtocolRecordData } from './types'
export type {
  AimdRecorderI18nOptions,
  AimdRecorderLocale,
  AimdRecorderMessages,
  AimdRecorderMessagesInput,
} from './locales'
export * from './composables'
