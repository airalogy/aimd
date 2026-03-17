/**
 * AIMD Editor Components
 *
 * Placeholder for component exports
 * Components will be migrated from apps/web/src/components/custom/aimd
 */

import { defineAsyncComponent } from "vue"
import AimdRecorder from "./AimdRecorder.vue"
import AimdQuizRecorder from "./AimdQuizRecorder.vue"

const AimdDnaSequenceField = defineAsyncComponent(() => import("./AimdDnaSequenceField.vue"))

export { AimdRecorder, AimdQuizRecorder, AimdDnaSequenceField }

/**
 * @deprecated Use `AimdRecorder` instead.
 */
export const AimdProtocolRecorder = AimdRecorder
