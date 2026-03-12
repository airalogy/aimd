import { ref } from 'vue'
import sampleContentDefault from './sampleContent.aimd?raw'

export const SAMPLE_AIMD = sampleContentDefault

export function useSampleContent() {
  return ref(SAMPLE_AIMD)
}
