/**
 * @airalogy/aimd-recorder
 * 
 * AIMD editor Vue components and UI
 * 
 * This package provides Vue components for editing and displaying AIMD content
 */

// Re-export styles
import './styles/aimd.css'

export { AimdProtocolRecorder, AimdRecorder, AimdQuizRecorder } from './components'
export {
  createAimdRecorderMessages,
  DEFAULT_AIMD_RECORDER_LOCALE,
  resolveAimdRecorderLocale,
} from './locales'
export type { AimdProtocolRecordData, AimdStepOrCheckRecordItem } from './types'
export { createEmptyProtocolRecordData } from './types'
export type {
  AimdRecorderI18nOptions,
  AimdRecorderLocale,
  AimdRecorderMessages,
  AimdRecorderMessagesInput,
} from './locales'
