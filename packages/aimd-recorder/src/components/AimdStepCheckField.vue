<script lang="ts">
import { defineComponent, h, type PropType, type VNode } from "vue"
import type { AimdStepNode, AimdCheckNode } from "@airalogy/aimd-core/types"
import type { AimdRecorderMessages } from "../locales"
import { getAimdRecorderScopeLabel } from "../locales"
import type { AimdStepOrCheckRecordItem } from "../types"

export const AimdStepField = defineComponent({
  name: "AimdStepField",
  props: {
    node: { type: Object as PropType<AimdStepNode>, required: true },
    state: { type: Object as PropType<AimdStepOrCheckRecordItem>, required: true },
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
      const stepNumber = node.step || "?"
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
          h("span", { class: "aimd-rec-step-card__title" }, id),
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
    state: { type: Object as PropType<AimdStepOrCheckRecordItem>, required: true },
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
