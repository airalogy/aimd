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

      return h("span", {
        class: ["aimd-rec-inline aimd-rec-inline--step aimd-field aimd-field--step", ...extraClasses],
      }, [
        h("label", { class: "aimd-rec-inline__check-wrap" }, [
          h("input", {
            "data-rec-focus-key": `step:${id}:checked`,
            type: "checkbox",
            disabled,
            checked: Boolean(state.checked),
            onChange: (event: Event) => {
              emit("check-change", {
                id,
                value: (event.target as HTMLInputElement).checked,
              })
            },
            onBlur: () => emit("blur", { id }),
          }),
          h("span", { class: "aimd-field__scope" }, getAimdRecorderScopeLabel("step", props.messages)),
          h("span", { class: "aimd-rec-inline__step-num" }, stepNumber),
          h("span", { class: "aimd-field__name" }, id),
        ]),
        h("input", {
          "data-rec-focus-key": `step:${id}:annotation`,
          class: "aimd-rec-inline__input aimd-rec-inline__input--annotation",
          disabled,
          placeholder: props.messages.step.annotationPlaceholder,
          value: state.annotation || "",
          onInput: (event: Event) => {
            emit("annotation-change", {
              id,
              value: (event.target as HTMLInputElement).value,
            })
          },
          onBlur: () => emit("blur", { id }),
        }),
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

      return h("span", {
        class: ["aimd-rec-inline aimd-rec-inline--check aimd-field aimd-field--check", ...extraClasses],
      }, [
        h("label", { class: "aimd-rec-inline__check-wrap" }, [
          h("input", {
            "data-rec-focus-key": `check:${id}:checked`,
            type: "checkbox",
            class: "aimd-checkbox",
            disabled,
            checked: Boolean(state.checked),
            onChange: (event: Event) => {
              emit("check-change", {
                id,
                value: (event.target as HTMLInputElement).checked,
              })
            },
            onBlur: () => emit("blur", { id }),
          }),
          h("span", { class: "aimd-field__scope" }, getAimdRecorderScopeLabel("check", props.messages)),
          h("span", { class: "aimd-field__name" }, node.label || id),
        ]),
        h("input", {
          "data-rec-focus-key": `check:${id}:annotation`,
          class: "aimd-rec-inline__input aimd-rec-inline__input--annotation",
          disabled,
          placeholder: props.messages.check.annotationPlaceholder,
          value: state.annotation || "",
          onInput: (event: Event) => {
            emit("annotation-change", {
              id,
              value: (event.target as HTMLInputElement).value,
            })
          },
          onBlur: () => emit("blur", { id }),
        }),
      ])
    }
  },
})

export default AimdStepField
</script>
