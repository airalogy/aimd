<script lang="ts">
import { defineComponent, h, type PropType, type VNode } from "vue"
import type { AimdVarTableNode } from "@airalogy/aimd-core/types"
import type { AimdFieldMeta, AimdFieldState } from "../types"
import type { AimdRecorderMessages } from "../locales"
import { getAimdRecorderScopeLabel } from "../locales"
import { getVarTableColumns, getVarTableRowKey } from "../composables/useVarTableDragDrop"

export default defineComponent({
  name: "AimdVarTableField",
  props: {
    node: { type: Object as PropType<AimdVarTableNode>, required: true },
    rows: { type: Array as PropType<Record<string, string>[]>, required: true },
    columns: { type: Array as PropType<string[]>, required: true },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    settlingRowKey: { type: String as PropType<string | null>, default: null },
    messages: { type: Object as PropType<AimdRecorderMessages>, required: true },
    fieldMeta: { type: Object as PropType<Record<string, AimdFieldMeta> | undefined>, default: undefined },
    fieldState: { type: Object as PropType<Record<string, AimdFieldState> | undefined>, default: undefined },
  },
  emits: [
    "cell-input",
    "cell-blur",
    "add-row",
    "remove-row",
    "drag-start",
    "drag-over",
    "drag-drop",
    "drag-end",
  ],
  setup(props, { emit }) {
    function isColumnDisabled(col: string): boolean {
      if (props.disabled) return true
      return !!(props.fieldMeta?.[`var_table:${props.node.id}:${col}`]?.disabled)
    }

    return () => {
      const tableName = props.node.id
      const columns = props.columns
      const rows = props.rows
      const disabled = props.disabled
      const messages = props.messages

      return h("div", { class: "aimd-field aimd-field--var-table aimd-rec-inline-table" }, [
        h("div", { class: "aimd-field__header" }, [
          h("span", { class: "aimd-field__scope" }, getAimdRecorderScopeLabel("var_table", messages)),
          h("span", { class: "aimd-field__name" }, tableName),
        ]),
        h("table", { class: "aimd-field__table-preview aimd-rec-inline-table__table" }, [
          h("thead", [
            h("tr", [
              h("th", { class: "aimd-rec-inline-table__drag-head" }, ""),
              ...columns.map(column => h("th", column)),
              h("th", { class: "aimd-rec-inline-table__action-head" }, messages.table.actionColumn),
            ]),
          ]),
          h("tbody", rows.map((row, rowIndex) => {
            const rowKey = getVarTableRowKey(row)
            return h("tr", {
              key: `${tableName}-${rowKey}`,
              class: props.settlingRowKey === rowKey ? "aimd-rec-inline-table__row--settling" : "",
              onDragover: (event: DragEvent) => emit("drag-over", { tableName, rowIndex, event }),
              onDrop: (event: DragEvent) => emit("drag-drop", { tableName, rowIndex, columns, event }),
            }, [
              h("td", { class: "aimd-rec-inline-table__drag-cell" }, [
                h("span", {
                  class: [
                    "aimd-rec-inline-table__drag-handle",
                    props.readonly ? "aimd-rec-inline-table__drag-handle--disabled" : "",
                  ],
                  title: props.readonly ? messages.table.dragDisabled : messages.table.dragReorder,
                  draggable: !props.readonly,
                  onDragstart: (event: DragEvent) => emit("drag-start", { tableName, rowIndex, event }),
                  onDragend: () => emit("drag-end"),
                }, Array.from({ length: 6 }, (_, dotIndex) => h("span", {
                  key: `${rowKey}-drag-dot-${dotIndex}`,
                  class: "aimd-rec-inline-table__drag-dot",
                }))),
              ]),
              ...columns.map(column => h("td", { key: `${tableName}-${rowIndex}-${column}` }, [
                (() => {
                  const colState = props.fieldState?.[`var_table:${tableName}:${column}`]
                  const cellClass = colState?.validationError
                    ? "aimd-rec-table-cell-input aimd-rec-table-cell-input--error"
                    : "aimd-rec-table-cell-input"
                  return h("input", {
                    "data-rec-focus-key": `var_table:${tableName}:${rowIndex}:${column}`,
                    class: cellClass,
                    disabled: isColumnDisabled(column),
                    placeholder: column,
                    value: row[column] ?? "",
                    onInput: (event: Event) => {
                      emit("cell-input", {
                        tableName,
                        column,
                        rowIndex,
                        value: (event.target as HTMLInputElement).value,
                        row,
                      })
                    },
                    onBlur: () => emit("cell-blur", { tableName, column }),
                  })
                })(),
              ])),
              h("td", { class: "aimd-rec-inline-table__action-cell" }, [
                h("button", {
                  type: "button",
                  class: "aimd-rec-inline-table__row-btn",
                  disabled: disabled || rows.length <= 1,
                  onClick: () => emit("remove-row", { tableName, rowIndex, columns }),
                }, messages.table.deleteRow),
              ]),
            ])
          })),
        ]),
        h("div", { class: "aimd-rec-inline-table__actions" }, [
          h("button", {
            type: "button",
            class: "aimd-rec-inline-table__add-btn",
            disabled,
            onClick: () => emit("add-row", { tableName, columns }),
          }, `+ ${messages.table.addRow}`),
        ]),
      ])
    }
  },
})
</script>
