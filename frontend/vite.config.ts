import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/news': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/summarize': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/tts': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/analyze-image': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/analyze-video': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/preferences': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/history': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/health': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
