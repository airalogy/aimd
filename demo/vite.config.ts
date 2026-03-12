import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueDevTools from 'vite-plugin-vue-devtools'
import tsconfigPaths from 'vite-tsconfig-paths'

const base = process.env.DEMO_BASE || '/'

export default defineConfig(({ command }) => ({
  base,
  plugins: [
    vue(),
    command === 'serve' ? VueDevTools() : null,
    tsconfigPaths({ root: '..' }),
  ].filter(Boolean),
  server: {
    port: 5188,
    open: true,
  },
}))
