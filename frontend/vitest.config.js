import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Separate from vite.config.js so the Tailwind v4 Vite plugin (which does
// PostCSS/lightningcss work that isn't needed and can slow down/complicate
// the jsdom test run) doesn't run during tests. Shares the same `@` alias
// as the main Vite config so imports resolve identically in tests.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
})
