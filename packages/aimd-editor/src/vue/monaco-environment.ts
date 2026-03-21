import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

type MonacoEnvironmentShape = {
  getWorker?: (moduleId: string, label: string) => Worker
}

function resolveWorkerKind(moduleId: string, label: string): 'json' | 'css' | 'html' | 'ts' | 'editor' {
  const normalizedLabel = (label || '').toLowerCase()
  const normalizedModuleId = (moduleId || '').toLowerCase()
  const hint = `${normalizedModuleId} ${normalizedLabel}`

  if (normalizedLabel === 'json' || hint.includes('/json/')) {
    return 'json'
  }

  if (
    normalizedLabel === 'css'
    || normalizedLabel === 'scss'
    || normalizedLabel === 'less'
    || hint.includes('/css/')
  ) {
    return 'css'
  }

  if (
    normalizedLabel === 'html'
    || normalizedLabel === 'handlebars'
    || normalizedLabel === 'razor'
    || hint.includes('/html/')
  ) {
    return 'html'
  }

  if (
    normalizedLabel === 'typescript'
    || normalizedLabel === 'javascript'
    || hint.includes('/typescript/')
    || hint.includes('/javascript/')
    || hint.includes('/tsworker')
  ) {
    return 'ts'
  }

  return 'editor'
}

export function ensureMonacoEnvironment() {
  if (typeof globalThis === 'undefined') {
    return
  }

  const existing = (globalThis as { MonacoEnvironment?: MonacoEnvironmentShape }).MonacoEnvironment
  if (typeof existing?.getWorker === 'function') {
    return
  }

  ;(globalThis as { MonacoEnvironment?: MonacoEnvironmentShape }).MonacoEnvironment = {
    getWorker(moduleId: string, label: string) {
      const workerKind = resolveWorkerKind(moduleId, label)

      if (workerKind === 'json') {
        return new jsonWorker()
      }

      if (workerKind === 'css') {
        return new cssWorker()
      }

      if (workerKind === 'html') {
        return new htmlWorker()
      }

      if (workerKind === 'ts') {
        return new tsWorker()
      }

      return new editorWorker()
    },
  }
}
