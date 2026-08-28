import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mockApiPlugin } from './mock/vite-mock-api.js'
 
export default defineConfig({
  base: './', // делает ссылки относительными
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    watch: {
      usePolling: true, // Включает опрос для отслеживания изменений в контейнерах/WSL
    },
  },
  plugins: [react(), mockApiPlugin()],
})