import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const projects = [
  {
    name: 'aimd-theme',
    root: resolve(__dirname, 'packages/aimd-theme'),
    extends: resolve(__dirname, 'packages/aimd-theme/vitest.config.ts'),
  },
  {
    name: 'aimd-presentation',
    root: resolve(__dirname, 'packages/aimd-presentation'),
    extends: resolve(__dirname, 'packages/aimd-presentation/vitest.config.ts'),
  },
  {
    name: 'aimd-core',
    root: resolve(__dirname, 'packages/aimd-core'),
    extends: resolve(__dirname, 'packages/aimd-core/vitest.config.ts'),
  },
  {
    name: 'aimd-renderer',
    root: resolve(__dirname, 'packages/aimd-renderer'),
    extends: resolve(__dirname, 'packages/aimd-renderer/vitest.config.ts'),
  },
  {
    name: 'aimd-editor',
    root: resolve(__dirname, 'packages/aimd-editor'),
    extends: resolve(__dirname, 'packages/aimd-editor/vitest.config.ts'),
  },
  {
    name: 'aimd-recorder',
    root: resolve(__dirname, 'packages/aimd-recorder'),
    extends: resolve(__dirname, 'packages/aimd-recorder/vitest.config.ts'),
  },
]

export default defineConfig({
  test: {
    projects: projects.map(project => ({
      extends: project.extends,
      root: project.root,
      test: {
        name: project.name,
      },
    })),
  },
})
