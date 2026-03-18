<script lang="ts">
import { defineComponent, h, type PropType, type VNode } from "vue"
import { defineAsyncComponent } from "vue"
import type { AimdVarNode } from "@airalogy/aimd-core/types"
import type { AimdFieldMeta } from "../types"
import type { AimdRecorderMessages } from "../locales"
import { getAimdRecorderScopeLabel } from "../locales"
import {
  getVarInputKind,
  normalizeVarTypeName,
  parseVarInputValue,
  applyVarStackWidth,
  syncAutoWrapTextareaHeight,
  toBooleanValue,
  normalizeDateTimeValueWithTimezone,
  type VarInputKind,
} from "../composables/useVarHelpers"
import { normalizeDnaSequenceValue } from "../composables/useDnaSequence"
import type { VarInputDisplayOverride } from "../composables/useFieldRendering"

const AimdDnaSequenceField = defineAsyncComponent(() => import("./AimdDnaSequenceField.vue"))

export default defineComponent({
  name: "AimdVarField",
  props: {
    node: { type: Object as PropType<AimdVarNode>, required: true },
    value: { type: undefined as unknown as PropType<unknown>, default: undefined },
    disabled: { type: Boolean, default: false },
    extraClasses: { type: Array as PropType<string[]>, default: () => [] },
    messages: { type: Object as PropType<AimdRecorderMessages>, required: true },
    fieldMeta: { type: Object as PropType<AimdFieldMeta | undefined>, default: undefined },
    displayValue: { type: [String, Number] as PropType<string | number>, default: "" },
    initialized: { type: Boolean, default: false },
  },
  emits: ["change", "blur", "dna-change"],
  setup(props, { emit }) {
    return () => {
      const node = props.node
      const id = node.id
      const type = node.definition?.type || "str"
      const normalizedType = normalizeVarTypeName(type)
      const inputKind = getVarInputKind(type)
      const isIntegerInput = normalizedType === "int" || normalizedType === "integer"
      const usesDecimalTextInput = inputKind === "number" && !isIntegerInput
      const meta = props.fieldMeta
      const disabled = props.disabled
      const extraClasses = props.extraClasses
      const placeholder = meta?.placeholder ?? getVarPlaceholder(node)
      const displayValue = props.displayValue

      function onVarChange(rawValue: string) {
        const parsed = parseVarInputValue(rawValue, type, inputKind)
        emit("change", { id, value: parsed, type, inputKind })
      }

      function onVarBlur() {
        emit("blur", { id })
      }

      // Enum select (from fieldMeta override)
      const enumOptions = meta?.enumOptions ?? []
      if (enumOptions.length) {
        return h("span", {
          class: ["aimd-rec-inline aimd-rec-inline--var-stacked aimd-field-wrapper", ...extraClasses],
        }, [
          h("span", { class: "aimd-field aimd-field--no-style aimd-field__label" }, [
            h("span", { class: "aimd-field__scope aimd-field__scope--var" }, "var"),
            h("span", { class: "aimd-field__id" }, id),
          ]),
          h("select", {
            "data-rec-focus-key": `var:${id}`,
            class: "aimd-rec-inline__input aimd-rec-inline__input--stacked aimd-rec-inline__select",
            disabled,
            value: props.value,
            onChange: (e: Event) => onVarChange((e.target as HTMLSelectElement).value),
            onBlur: onVarBlur,
          }, enumOptions.map(opt => h("option", { key: String(opt.value), value: opt.value }, opt.label))),
        ])
      }

      // Default stacked widget
      const renderStackedVar = (control: VNode, variantClass?: string): VNode =>
        h("span", {
          class: ["aimd-rec-inline aimd-rec-inline--var-stacked aimd-field-wrapper aimd-field-wrapper--inline", variantClass, ...extraClasses],
        }, [
          h("span", { class: "aimd-field aimd-field--no-style aimd-field__label" }, [
            h("span", { class: "aimd-field__scope aimd-field__scope--var" }, getAimdRecorderScopeLabel("var", props.messages)),
            h("span", { class: "aimd-field__id" }, id),
          ]),
          control,
        ])

      if (inputKind === "dna") {
        return h(AimdDnaSequenceField, {
          class: extraClasses,
          varId: id,
          modelValue: props.value,
          disabled,
          placeholder,
          messages: props.messages,
          "onUpdate:modelValue": (value: unknown) => {
            emit("dna-change", { id, value })
          },
          onBlur: onVarBlur,
        })
      }

      if (inputKind === "checkbox") {
        return renderStackedVar(
          h("span", { class: "aimd-rec-inline__checkbox-row" }, [
            h("input", {
              "data-rec-focus-key": `var:${id}`,
              type: "checkbox",
              disabled,
              checked: toBooleanValue(props.value),
              onVnodeMounted: (vnode: any) => applyVarStackWidth(vnode.el as HTMLElement, inputKind),
              onVnodeUpdated: (vnode: any) => applyVarStackWidth(vnode.el as HTMLElement, inputKind),
              onChange: (event: Event) => {
                const val = (event.target as HTMLInputElement).checked
                emit("change", { id, value: val, type, inputKind })
              },
              onBlur: onVarBlur,
            }),
          ]),
          "aimd-rec-inline--var-stacked--checkbox",
        )
      }

      if (inputKind === "textarea") {
        return renderStackedVar(
          h("textarea", {
            "data-rec-focus-key": `var:${id}`,
            class: "aimd-rec-inline__textarea aimd-rec-inline__textarea--stacked",
            disabled,
            placeholder,
            value: displayValue,
            onVnodeMounted: (vnode: any) => applyVarStackWidth(vnode.el as HTMLElement, inputKind),
            onVnodeUpdated: (vnode: any) => applyVarStackWidth(vnode.el as HTMLElement, inputKind),
            onInput: (event: Event) => onVarChange((event.target as HTMLTextAreaElement).value),
            onBlur: onVarBlur,
          }),
          "aimd-rec-inline--var-stacked--textarea",
        )
      }

      if (inputKind === "text") {
        return renderStackedVar(
          h("textarea", {
            "data-rec-focus-key": `var:${id}`,
            class: "aimd-rec-inline__textarea aimd-rec-inline__textarea--stacked aimd-rec-inline__textarea--stacked-text",
            rows: 1,
            disabled,
            placeholder,
            value: displayValue,
            onVnodeMounted: (vnode: any) => {
              const el = vnode.el as HTMLTextAreaElement
              applyVarStackWidth(el, inputKind)
              syncAutoWrapTextareaHeight(el)
            },
            onVnodeUpdated: (vnode: any) => {
              const el = vnode.el as HTMLTextAreaElement
              applyVarStackWidth(el, inputKind)
              syncAutoWrapTextareaHeight(el)
            },
            onInput: (event: Event) => {
              const el = event.target as HTMLTextAreaElement
              onVarChange(el.value)
              applyVarStackWidth(el, inputKind)
              syncAutoWrapTextareaHeight(el)
            },
            onBlur: onVarBlur,
          }),
        )
      }

      // number / date / datetime / time
      const htmlInputType = inputKind === "datetime"
        ? "datetime-local"
        : (usesDecimalTextInput ? "text" : inputKind)

      return renderStackedVar(
        h("input", {
          "data-rec-focus-key": `var:${id}`,
          class: "aimd-rec-inline__input aimd-rec-inline__input--stacked",
          type: htmlInputType,
          inputmode: inputKind === "number" ? (isIntegerInput ? "numeric" : "decimal") : undefined,
          disabled,
          placeholder,
          step: inputKind === "number"
            ? (isIntegerInput ? "1" : undefined)
            : (inputKind === "time" ? "1" : undefined),
          value: displayValue,
          onVnodeMounted: (vnode: any) => applyVarStackWidth(vnode.el as HTMLElement, inputKind),
          onVnodeUpdated: (vnode: any) => applyVarStackWidth(vnode.el as HTMLElement, inputKind),
          onInput: (event: Event) => onVarChange((event.target as HTMLInputElement).value),
          onBlur: onVarBlur,
        }),
      )
    }
  },
})

function getVarPlaceholder(node: AimdVarNode): string | undefined {
  const title = node.definition?.kwargs?.title
  return typeof title === "string" && title.trim() ? title.trim() : undefined
}
</script>
