import { computed, ref, watch } from 'vue'

export type DemoLocale = 'en-US' | 'zh-CN'

const DEMO_LOCALE_STORAGE_KEY = 'aimd-demo-locale'

function isDemoLocale(value: unknown): value is DemoLocale {
  return value === 'en-US' || value === 'zh-CN'
}

function detectRuntimeLocale(): DemoLocale {
  if (typeof window !== 'undefined') {
    const storedLocale = window.localStorage.getItem(DEMO_LOCALE_STORAGE_KEY)
    if (isDemoLocale(storedLocale)) {
      return storedLocale
    }
  }

  if (typeof document !== 'undefined') {
    const htmlLang = document.documentElement?.lang?.trim()
    if (htmlLang?.toLowerCase().startsWith('zh')) {
      return 'zh-CN'
    }
    if (htmlLang?.toLowerCase().startsWith('en')) {
      return 'en-US'
    }
  }

  if (typeof navigator !== 'undefined') {
    const runtimeLocale = navigator.language || navigator.languages?.[0]
    if (runtimeLocale?.toLowerCase().startsWith('zh')) {
      return 'zh-CN'
    }
  }

  return 'zh-CN'
}

export interface DemoMessages {
  app: {
    title: string
    languageLabel: string
    localeNames: Record<DemoLocale, string>
  }
  nav: {
    full: string
    core: string
    editor: string
    renderer: string
    recorder: string
  }
  common: {
    inputAimd: string
    aimdSourceText: string
    extractedFields: string
    htmlSource: string
    astOutput: string
    reset: string
    resetForm: string
    loadingEditor: string
    renderPreview: string
    collectedData: string
  }
  pages: {
    full: {
      title: string
      desc: string
      stats: {
        var: string
        table: string
        step: string
        check: string
        refs: string
      }
      editorTitle: string
      tabs: {
        preview: string
        form: string
        data: string
      }
    }
    core: {
      desc: string
    }
    editor: {
      desc: string
    }
    renderer: {
      desc: string
      tabs: {
        html: string
        vue: string
        fields: string
      }
    }
    recorder: {
      desc: string
      inlineFormTitle: string
    }
  }
}

const BASE_DEMO_MESSAGES: Record<DemoLocale, DemoMessages> = {
  'en-US': {
    app: {
      title: 'AIMD Packages Demo',
      languageLabel: 'Language',
      localeNames: {
        'en-US': 'English',
        'zh-CN': '中文',
      },
    },
    nav: {
      full: 'Full Workflow',
      core: 'Core Parser',
      editor: 'Editor',
      renderer: 'Renderer',
      recorder: 'Recorder',
    },
    common: {
      inputAimd: 'Input (AIMD Markdown)',
      aimdSourceText: 'AIMD Source Text',
      extractedFields: 'Extracted Fields (ExtractedAimdFields)',
      htmlSource: 'HTML Source',
      astOutput: 'AST Output (MDAST)',
      reset: 'Reset',
      resetForm: 'Reset Form',
      loadingEditor: 'Loading editor...',
      renderPreview: 'Render Preview',
      collectedData: 'Collected Data (Record Data)',
    },
    pages: {
      full: {
        title: 'AIMD Full Workflow',
        desc: 'Edit AIMD -> live preview -> fill field values -> collect record data',
        stats: {
          var: 'Vars',
          table: 'Tables',
          step: 'Steps',
          check: 'Checks',
          refs: 'Refs',
        },
        editorTitle: 'AIMD Editor',
        tabs: {
          preview: 'Preview',
          form: 'Fill Data',
          data: 'Collected Result',
        },
      },
      core: {
        desc: 'AIMD core parser that converts AIMD Markdown into AST and extracted field metadata',
      },
      editor: {
        desc: 'AIMD Editor with source mode, WYSIWYG mode, and localized built-in UI',
      },
      renderer: {
        desc: 'AIMD rendering engine that renders AIMD Markdown into HTML and Vue VNodes',
        tabs: {
          html: 'HTML Render',
          vue: 'Vue VNodes',
          fields: 'Extracted Fields',
        },
      },
      recorder: {
        desc: 'AIMD protocol recorder with built-in inline data-entry components',
        inlineFormTitle: 'Inline Record Form',
      },
    },
  },
  'zh-CN': {
    app: {
      title: 'AIMD Packages Demo',
      languageLabel: '语言',
      localeNames: {
        'en-US': 'English',
        'zh-CN': '中文',
      },
    },
    nav: {
      full: '完整工作流',
      core: 'Core 解析器',
      editor: 'Editor 编辑器',
      renderer: 'Renderer 渲染器',
      recorder: 'Recorder 记录器',
    },
    common: {
      inputAimd: '输入 (AIMD Markdown)',
      aimdSourceText: 'AIMD 源文本',
      extractedFields: '提取的字段 (ExtractedAimdFields)',
      htmlSource: 'HTML 源码',
      astOutput: 'AST 输出 (MDAST)',
      reset: '重置',
      resetForm: '重置表单',
      loadingEditor: '加载编辑器...',
      renderPreview: '渲染预览',
      collectedData: '收集到的数据 (Record Data)',
    },
    pages: {
      full: {
        title: 'AIMD 完整工作流',
        desc: '编辑 AIMD -> 实时预览 -> 填写字段值 -> 收集数据',
        stats: {
          var: '变量',
          table: '变量表',
          step: '步骤',
          check: '检查',
          refs: '引用',
        },
        editorTitle: 'AIMD 编辑器',
        tabs: {
          preview: '渲染预览',
          form: '填写数据',
          data: '收集结果',
        },
      },
      core: {
        desc: 'AIMD 核心解析器 — 将 AIMD Markdown 解析为 AST 并提取字段信息',
      },
      editor: {
        desc: 'AIMD Editor — 支持 Source mode / WYSIWYG mode 与内建 UI 双语切换',
      },
      renderer: {
        desc: 'AIMD 渲染引擎 — 将 AIMD Markdown 渲染为 HTML 和 Vue VNodes',
        tabs: {
          html: 'HTML 渲染',
          vue: 'Vue VNodes',
          fields: '提取字段',
        },
      },
      recorder: {
        desc: 'AIMD 数据记录器 — 使用包内置协议内联录入组件',
        inlineFormTitle: '数据记录表单（内联）',
      },
    },
  },
}

const locale = ref<DemoLocale>(detectRuntimeLocale())

watch(locale, (value) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = value
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DEMO_LOCALE_STORAGE_KEY, value)
  }
}, { immediate: true })

export function useDemoLocale() {
  return {
    locale,
  }
}

export function useDemoMessages() {
  return computed(() => BASE_DEMO_MESSAGES[locale.value])
}
