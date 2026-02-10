<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  AIMD_FIELD_TYPES,
  getDefaultAimdFields,
  buildAimdSyntax,
  type AimdFieldType,
} from './types'

const props = defineProps<{
  visible: boolean
  initialType?: string
  refSuggestions?: string[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'insert', syntax: string): void
}>()

const dialogType = ref(props.initialType || 'var')
const fields = ref<Record<string, string>>(getDefaultAimdFields(dialogType.value))

watch(() => props.initialType, (t) => {
  if (t) {
    dialogType.value = t
    fields.value = getDefaultAimdFields(t)
  }
})

watch(() => props.visible, (v) => {
  if (v) {
    fields.value = getDefaultAimdFields(dialogType.value)
  }
})

function switchType(type: string) {
  dialogType.value = type
  fields.value = getDefaultAimdFields(type)
}

const preview = computed(() => buildAimdSyntax(dialogType.value, fields.value))

function getTypeInfo(type: string): AimdFieldType {
  return AIMD_FIELD_TYPES.find(f => f.type === type) || { type, label: type, icon: '?', svgIcon: '', desc: '', color: '#666' }
}

const currentType = computed(() => getTypeInfo(dialogType.value))

const suggestions = computed(() => {
  if (!props.refSuggestions) return []
  return props.refSuggestions
})

function doInsert() {
  emit('insert', buildAimdSyntax(dialogType.value, fields.value))
  emit('update:visible', false)
}

function close() {
  emit('update:visible', false)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="aimd-dialog-overlay" @click.self="close">
      <div class="aimd-dialog">
        <div class="aimd-dialog-header">
          <span class="aimd-dialog-title">
            <span class="aimd-dialog-icon" :style="{ color: currentType.color }" v-html="currentType.svgIcon" />
            Insert AIMD {{ currentType.label }}
          </span>
          <button class="aimd-dialog-close" @click="close">&times;</button>
        </div>

        <!-- Type selector tabs -->
        <div class="aimd-dialog-type-tabs">
          <button
            v-for="ft in AIMD_FIELD_TYPES"
            :key="ft.type"
            :class="['aimd-type-tab', { active: dialogType === ft.type }]"
            :style="dialogType === ft.type ? { borderBottomColor: ft.color, color: ft.color } : {}"
            @click="switchType(ft.type)"
          >
            <span v-html="ft.svgIcon" class="aimd-type-tab-icon" /> {{ ft.label }}
          </button>
        </div>

        <div class="aimd-dialog-body">
          <!-- var fields -->
          <template v-if="dialogType === 'var'">
            <label class="aimd-field-row">
              <span class="aimd-field-label">Variable Name <em>*</em></span>
              <input v-model="fields.name" placeholder="sample_name" class="aimd-field-input" />
            </label>
            <label class="aimd-field-row">
              <span class="aimd-field-label">Type</span>
              <select v-model="fields.type" class="aimd-field-input">
                <option value="">None</option>
                <option value="str">str</option>
                <option value="int">int</option>
                <option value="float">float</option>
                <option value="bool">bool</option>
                <option value="list">list</option>
                <option value="dict">dict</option>
              </select>
            </label>
            <label class="aimd-field-row">
              <span class="aimd-field-label">Default Value</span>
              <input v-model="fields.default" placeholder="Optional" class="aimd-field-input" />
            </label>
            <label class="aimd-field-row">
              <span class="aimd-field-label">Title</span>
              <input v-model="fields.title" placeholder="Display title (optional)" class="aimd-field-input" />
            </label>
          </template>

          <!-- var_table fields -->
          <template v-if="dialogType === 'var_table'">
            <label class="aimd-field-row">
              <span class="aimd-field-label">Table Name <em>*</em></span>
              <input v-model="fields.name" placeholder="samples" class="aimd-field-input" />
            </label>
            <label class="aimd-field-row">
              <span class="aimd-field-label">Sub-variable Columns</span>
              <input v-model="fields.subvars" placeholder="col1, col2, col3" class="aimd-field-input" />
              <span class="aimd-field-hint">Comma-separated column names</span>
            </label>
          </template>

          <!-- step fields -->
          <template v-if="dialogType === 'step'">
            <label class="aimd-field-row">
              <span class="aimd-field-label">Step Name <em>*</em></span>
              <input v-model="fields.name" placeholder="sample_preparation" class="aimd-field-input" />
            </label>
            <label class="aimd-field-row">
              <span class="aimd-field-label">Level</span>
              <select v-model="fields.level" class="aimd-field-input">
                <option value="1">1 (Top level)</option>
                <option value="2">2 (Sub-step)</option>
                <option value="3">3 (Sub-sub-step)</option>
              </select>
            </label>
          </template>

          <!-- check fields -->
          <template v-if="dialogType === 'check'">
            <label class="aimd-field-row">
              <span class="aimd-field-label">Checkpoint Name <em>*</em></span>
              <input v-model="fields.name" placeholder="quality_control" class="aimd-field-input" />
            </label>
          </template>

          <!-- ref_step / ref_var / ref_fig -->
          <template v-if="['ref_step', 'ref_var', 'ref_fig'].includes(dialogType)">
            <label class="aimd-field-row">
              <span class="aimd-field-label">Reference Target <em>*</em></span>
              <input v-model="fields.name" placeholder="Target name" class="aimd-field-input" list="aimd-ref-suggestions" />
              <datalist id="aimd-ref-suggestions">
                <option v-for="s in suggestions" :key="s" :value="s" />
              </datalist>
              <span v-if="suggestions.length" class="aimd-field-hint">
                Available: {{ suggestions.join(', ') }}
              </span>
            </label>
          </template>

          <!-- cite -->
          <template v-if="dialogType === 'cite'">
            <label class="aimd-field-row">
              <span class="aimd-field-label">Citation ID <em>*</em></span>
              <input v-model="fields.refs" placeholder="ref1, ref2" class="aimd-field-input" />
              <span class="aimd-field-hint">Comma-separated citation IDs</span>
            </label>
          </template>

          <!-- Preview -->
          <div class="aimd-dialog-preview">
            <span class="aimd-preview-label">Preview:</span>
            <code class="aimd-preview-code">{{ preview }}</code>
          </div>
        </div>

        <div class="aimd-dialog-footer">
          <button class="aimd-btn aimd-btn-cancel" @click="close">Cancel</button>
          <button class="aimd-btn aimd-btn-primary" @click="doInsert">Insert</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
.aimd-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(2px);
}

.aimd-dialog {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  width: 520px;
  max-width: 90vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.aimd-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
}

.aimd-dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
  display: flex;
  align-items: center;
  gap: 8px;
}

.aimd-dialog-icon {
  display: flex;
  align-items: center;
}

.aimd-dialog-icon svg {
  width: 20px;
  height: 20px;
}

.aimd-dialog-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 22px;
  color: #999;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.aimd-dialog-close:hover {
  background: #f0f2f5;
  color: #333;
}

.aimd-dialog-type-tabs {
  display: flex;
  overflow-x: auto;
  border-bottom: 1px solid #f0f0f0;
  padding: 0 12px;
  gap: 0;
}

.aimd-type-tab {
  padding: 10px 12px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12px;
  color: #888;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  transition: all 0.15s;
}

.aimd-type-tab:hover {
  color: #555;
  background: #fafafa;
}

.aimd-type-tab-icon {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.aimd-type-tab-icon svg {
  width: 14px;
  height: 14px;
}

.aimd-type-tab.active {
  font-weight: 600;
}

.aimd-dialog-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}

.aimd-field-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.aimd-field-label {
  font-size: 13px;
  font-weight: 500;
  color: #444;
}

.aimd-field-label em {
  color: #dc2626;
  font-style: normal;
}

.aimd-field-input {
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}

.aimd-field-input:focus {
  border-color: #1a73e8;
  box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.1);
}

.aimd-field-hint {
  font-size: 11px;
  color: #999;
}

.aimd-dialog-preview {
  padding: 12px 14px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  gap: 8px;
}

.aimd-preview-label {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
}

.aimd-preview-code {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
  color: #2563eb;
  word-break: break-all;
}

.aimd-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid #f0f0f0;
}

.aimd-btn {
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.aimd-btn-cancel {
  border: 1px solid #e0e0e0;
  background: #fff;
  color: #666;
}

.aimd-btn-cancel:hover {
  background: #f5f5f5;
}

.aimd-btn-primary {
  border: none;
  background: #1a73e8;
  color: #fff;
}

.aimd-btn-primary:hover {
  background: #1557b0;
}
</style>
