// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Use relative asset URLs so the bundle works when loaded via file://
  // inside the packaged Electron app.
  base: './',
  server: {
    port: 5173,
    strictPort: true, // Prevents Vite from trying a different port if 5173 is busy
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
  },
})