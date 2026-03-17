export { captureFocusSnapshot, restoreFocusSnapshot } from './useFocusManagement'
export type { FocusSnapshot } from './useFocusManagement'

export {
  cloneRecordData,
  normalizeStepLike,
  normalizeIncomingRecord,
  replaceSection,
  applyNormalizedRecord,
  applyIncomingRecord,
  normalizeStepFields,
  normalizeCheckFields,
  normalizeQuizFields,
  normalizeVarTableFields,
  getQuizDefaultValue,
  ensureDefaultsFromFields,
  createEmptyVarTableRow,
  normalizeVarTableRows,
} from './useRecordState'

export {
  normalizeVarTypeName,
  getVarInputKind,
  unwrapStructuredValue,
  toBooleanValue,
  toDateValue,
  formatDateTimeWithTimezone,
  normalizeDateTimeValueWithTimezone,
  formatDateForInput,
  getVarInputDisplayValue,
  parseVarInputValue,
  calculateVarStackWidth,
  measureVarLabelWidth,
  measureSingleLineControlWidth,
  syncAutoWrapTextareaHeight,
  applyVarStackWidth,
} from './useVarHelpers'
export type { VarInputKind } from './useVarHelpers'

export {
  AIMD_DNA_SEQUENCE_FORMAT,
  normalizeDnaSequenceText,
  collectInvalidDnaSequenceCharacters,
  createEmptyDnaSequenceAnnotation,
  createEmptyDnaSequenceQualifier,
  createEmptyDnaSequenceSegment,
  getNextDnaSequenceAnnotationId,
  normalizeDnaSequenceAnnotation,
  normalizeDnaSequenceQualifier,
  normalizeDnaSequenceSegment,
  normalizeDnaSequenceValue,
  calculateDnaSequenceGcPercent,
  getDnaSequenceSegmentIssue,
  serializeDnaSequenceToGenBank,
} from './useDnaSequence'
