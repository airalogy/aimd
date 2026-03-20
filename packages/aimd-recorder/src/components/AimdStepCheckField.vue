<script lang="ts">
import { computed, defineAsyncComponent, defineComponent, h, onBeforeUnmount, ref, watch, type PropType, type VNodeChild } from "vue"
import type { AimdStepNode, AimdCheckNode, AimdStepTimerMode } from "@airalogy/aimd-core/types"
import type { AimdRecorderMessages } from "../locales"
import { getAimdRecorderScopeLabel } from "../locales"
import type { AimdCheckRecordItem, AimdStepDetailDisplay, AimdStepRecordItem } from "../types"
import {
  formatStepDuration,
  getStepElapsedMs,
  getStepRemainingMs,
  hasRecordedStepDuration,
  isStepTimerWarning,
  isStepTimerRunning,
  resolveStepTimerMode,
} from "../composables/useStepTimers"

const AimdMarkdownNoteField = defineAsyncComponent(() => import("./AimdMarkdownNoteField.vue"))

export const AimdStepField = defineComponent({
  name: "AimdStepField",
  props: {
    node: { type: Object as PropType<AimdStepNode>, required: true },
    state: { type: Object as PropType<AimdStepRecordItem>, required: true },
    bodyNodes: { type: Array as PropType<VNodeChild[]>, default: () => [] },
    disabled: { type: Boolean, default: false },
    extraClasses: { type: Array as PropType<string[]>, default: () => [] },
    detailDisplay: { type: String as PropType<AimdStepDetailDisplay>, default: "auto" },
    locale: { type: String, required: true },
    messages: { type: Object as PropType<AimdRecorderMessages>, required: true },
  },
  emits: ["check-change", "annotation-change", "timer-start", "timer-pause", "timer-reset", "blur"],
  setup(props, { emit }) {
    const nowMs = ref(Date.now())
    const rootEl = ref<HTMLElement | null>(null)
    const annotationExpanded = ref(false)
    const timerExpanded = ref(false)
    let liveTimer: ReturnType<typeof setInterval> | null = null
    let focusOutCheckTimer: ReturnType<typeof setTimeout> | null = null

    function syncLiveTimer() {
      if (liveTimer) {
        clearInterval(liveTimer)
        liveTimer = null
      }

      if (!isStepTimerRunning(props.state)) {
        return
      }

      liveTimer = setInterval(() => {
        nowMs.value = Date.now()
      }, 1000)
    }

    watch(() => props.state.timer_started_at_ms, () => {
      nowMs.value = Date.now()
      syncLiveTimer()
    }, { immediate: true })

    onBeforeUnmount(() => {
      if (liveTimer) {
        clearInterval(liveTimer)
      }
      if (focusOutCheckTimer) {
        clearTimeout(focusOutCheckTimer)
      }
    })

    const alwaysShowDetails = computed(() => props.detailDisplay === "always")
    const actualElapsedMs = computed(() => getStepElapsedMs(props.state, nowMs.value))
    const actualDurationLabel = computed(() => formatStepDuration(actualElapsedMs.value, props.locale))
    const estimatedDurationLabel = computed(() => (
      typeof props.node.estimated_duration_ms === "number"
        ? formatStepDuration(props.node.estimated_duration_ms, props.locale)
        : ""
    ))
    const timerMode = computed<AimdStepTimerMode>(() => resolveStepTimerMode(props.node))
    const timerRunning = computed(() => isStepTimerRunning(props.state))
    const hasRecordedDuration = computed(() => hasRecordedStepDuration(props.state))
    const hasAnnotation = computed(() => Boolean(props.state.annotation?.trim()))
    const remainingMs = computed(() => getStepRemainingMs(props.state, props.node.estimated_duration_ms, nowMs.value))
    const countdownEnabled = computed(() => timerMode.value === "countdown" || timerMode.value === "both")
    const showElapsedDetail = computed(() => timerMode.value === "elapsed" || timerMode.value === "both")
    const countdownWarning = computed(() => (
      (timerRunning.value || hasRecordedDuration.value)
      && isStepTimerWarning(remainingMs.value, props.node.estimated_duration_ms)
    ))
    const countdownOvertime = computed(() => typeof remainingMs.value === "number" && remainingMs.value < 0)
    const countdownLabel = computed(() => {
      if (remainingMs.value == null) {
        return ""
      }

      if (countdownOvertime.value) {
        return props.messages.step.overtimeBadge(formatStepDuration(Math.abs(remainingMs.value), props.locale))
      }

      return props.messages.step.remainingBadge(formatStepDuration(Math.max(0, remainingMs.value), props.locale))
    })
    const countdownTitle = computed(() => {
      if (remainingMs.value == null) {
        return ""
      }

      if (countdownOvertime.value) {
        return props.messages.step.overtimeDuration(formatStepDuration(Math.abs(remainingMs.value), props.locale))
      }

      return props.messages.step.remainingDuration(formatStepDuration(Math.max(0, remainingMs.value), props.locale))
    })
    const autoShowTimerDetails = computed(() => countdownEnabled.value)
    const showAnnotationEditor = computed(() => (
      alwaysShowDetails.value
      || hasAnnotation.value
      || annotationExpanded.value
    ))
    const showTimerDetails = computed(() => (
      alwaysShowDetails.value
      || autoShowTimerDetails.value
      || timerRunning.value
      || hasRecordedDuration.value
      || timerExpanded.value
    ))
    const showTimerSummary = computed(() => !showTimerDetails.value && (timerRunning.value || hasRecordedDuration.value))
    const showDetailRow = computed(() => showAnnotationEditor.value || showTimerDetails.value)

    function clearPendingFocusOutCheck() {
      if (focusOutCheckTimer) {
        clearTimeout(focusOutCheckTimer)
        focusOutCheckTimer = null
      }
    }

    function collapseTransientDetails() {
      if (!hasAnnotation.value) {
        annotationExpanded.value = false
      }
      if (!autoShowTimerDetails.value && !timerRunning.value && !hasRecordedDuration.value) {
        timerExpanded.value = false
      }
    }

    function handleFocusIn() {
      clearPendingFocusOutCheck()
    }

    function handleFocusOut(event: FocusEvent) {
      const nextTarget = event.relatedTarget
      if (nextTarget instanceof Node && rootEl.value?.contains(nextTarget)) {
        return
      }

      clearPendingFocusOutCheck()
      focusOutCheckTimer = setTimeout(() => {
        focusOutCheckTimer = null
        const activeElement = typeof document !== "undefined" ? document.activeElement : null
        if (activeElement instanceof Node && rootEl.value?.contains(activeElement)) {
          return
        }

        collapseTransientDetails()
      }, 0)
    }

    function openAnnotationDetail() {
      annotationExpanded.value = true
    }

    function openTimerDetail() {
      timerExpanded.value = true
      emit("timer-start", { id: props.node.id })
    }

    function preventToggleFocus(event: MouseEvent) {
      event.preventDefault()
    }

    return () => {
      const node = props.node
      const id = node.id
      const state = props.state
      const stepNumber = node.step || "?"
      const hasCheck = Boolean(node.check)
      const disabled = props.disabled
      const extraClasses = props.extraClasses
      const isChecked = Boolean(state.checked)

      return h("span", {
        class: [
          "aimd-rec-step-card",
          isChecked ? "aimd-rec-step-card--checked" : "aimd-rec-step-card--awaiting",
          ...extraClasses,
        ],
      }, [
        // left accent bar
        h("span", { class: "aimd-rec-step-card__bar" }),
        // badge
        h("label", { class: "aimd-rec-step-card__badge-wrap" }, [
          h("input", {
            "data-rec-focus-key": `step:${id}:checked`,
            type: "checkbox",
            class: "aimd-rec-step-card__checkbox",
            disabled,
            checked: isChecked,
            onChange: (event: Event) => {
              emit("check-change", { id, value: (event.target as HTMLInputElement).checked })
            },
            onBlur: () => emit("blur", { id }),
          }),
          h("span", {
            class: ["aimd-rec-step-card__badge", isChecked ? "aimd-rec-step-card__badge--checked" : ""],
          }, [
            isChecked
              ? h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "3", width: "14", height: "14" }, [
                  h("polyline", { points: "20 6 9 17 4 12" }),
                ])
              : String(stepNumber),
          ]),
        ]),
        // content
        h("span", { class: "aimd-rec-step-card__content" }, [
          node.title ? h("span", { class: "aimd-rec-step-card__title" }, node.title) : null,
          h("input", {
            "data-rec-focus-key": `step:${id}:annotation`,
            class: "aimd-rec-step-card__annotation",
            disabled,
            placeholder: props.messages.step.annotationPlaceholder,
            value: state.annotation || "",
            onInput: (event: Event) => {
              emit("annotation-change", { id, value: (event.target as HTMLInputElement).value })
            },
            onBlur: () => emit("blur", { id }),
          }),
        ]),
      ])
    }
  },
})

export const AimdCheckField = defineComponent({
  name: "AimdCheckField",
  props: {
    node: { type: Object as PropType<AimdCheckNode>, required: true },
    state: { type: Object as PropType<AimdCheckRecordItem>, required: true },
    disabled: { type: Boolean, default: false },
    extraClasses: { type: Array as PropType<string[]>, default: () => [] },
    messages: { type: Object as PropType<AimdRecorderMessages>, required: true },
  },
  emits: ["check-change", "annotation-change", "blur"],
  setup(props, { emit }) {
    return () => {
      const node = props.node
      const id = node.id
      const state = props.state
      const disabled = props.disabled
      const extraClasses = props.extraClasses
      const isChecked = Boolean(state.checked)
      const label = node.label || id
      const checkedMessage = node.checkedMessage

      return h("label", {
        class: [
          "aimd-check-pill",
          isChecked ? "aimd-check-pill--checked" : "",
          ...extraClasses,
        ],
      }, [
        h("input", {
          "data-rec-focus-key": `check:${id}:checked`,
          type: "checkbox",
          class: "aimd-check-pill__input",
          disabled,
          checked: isChecked,
          onChange: (event: Event) => {
            emit("check-change", { id, value: (event.target as HTMLInputElement).checked })
          },
          onBlur: () => emit("blur", { id }),
        }),
        // checkbox visual
        h("span", { class: "aimd-check-pill__box" }, [
          h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "3" }, [
            h("polyline", { points: "20 6 9 17 4 12" }),
          ]),
        ]),
        // content
        h("span", { class: "aimd-check-pill__content" }, [
          h("span", { class: "aimd-check-pill__label" }, label),
          // checked message badge
          isChecked && checkedMessage
            ? h("span", { class: "aimd-check-pill__msg" }, checkedMessage)
            : null,
          // annotation
          state.annotation
            ? h("span", { class: "aimd-check-pill__annotation" }, [
                h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", width: "10", height: "10" }, [
                  h("path", { d: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" }),
                ]),
                state.annotation,
              ])
            : null,
          // annotation input
          h("input", {
            "data-rec-focus-key": `check:${id}:annotation`,
            class: "aimd-check-pill__annotation-input",
            disabled,
            placeholder: props.messages.check.annotationPlaceholder,
            value: state.annotation || "",
            onInput: (event: Event) => {
              emit("annotation-change", { id, value: (event.target as HTMLInputElement).value })
            },
            onBlur: () => emit("blur", { id }),
          }),
        ]),
      ])
    }
  },
})

export default AimdStepField
</script>
