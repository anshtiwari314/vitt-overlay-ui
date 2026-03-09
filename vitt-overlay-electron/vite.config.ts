// vite.config.ts - React renderer for Electron (built output in dist/)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // required for loading from file:// in Electron
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
  },
})
