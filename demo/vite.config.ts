import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tsconfigPaths from 'vite-tsconfig-paths'

const base = process.env.DEMO_BASE || '/'

export default defineConfig({
  base,
  plugins: [
    vue(),
    tsconfigPaths({ root: '..' }),
  ],
  server: {
    port: 5188,
    open: true,
  },
})
