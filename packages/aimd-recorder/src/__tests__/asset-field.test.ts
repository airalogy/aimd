import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AimdAssetField from '../components/AimdAssetField.vue'

describe('AimdAssetField', () => {
  it('shows a dedicated fallback state when image preview fails to load', async () => {
    const wrapper = mount(AimdAssetField, {
      props: {
        varId: 'cell_before_photo',
        title: '细胞处理前照片',
        typeLabel: 'FileIdPNG',
        previewMode: 'image',
        modelValue: {
          src: 'https://example.com/broken.png',
          name: 'broken.png',
          mimeType: 'image/png',
          size: null,
          lastModified: null,
        },
      },
    })

    await wrapper.find('.aimd-asset-field__media--image').trigger('error')

    expect(wrapper.find('.aimd-asset-field__preview-unavailable').exists()).toBe(true)
    expect(wrapper.text()).toContain('Preview unavailable')
  })
})
