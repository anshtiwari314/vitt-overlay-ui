// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Important: make assets load correctly when opened via file://
  // inside Electron by using relative URLs instead of `/assets/...`
  base: './',
  build: {
    // When building for Electron package, output into electron project's dist
    outDir: process.env.VITE_OUT_DIR || 'dist',
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
  server: {
    port: 5173,
    strictPort: true, // Prevents Vite from trying a different port if 5173 is busy
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
  },
})