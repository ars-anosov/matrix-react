import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mockApiPlugin } from './mock/vite-mock-api.js'
 
export default defineConfig({
  base: './', // делает ссылки относительными
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'matrix-sdk',
              test: /node_modules[\\/]matrix-js-sdk/,
              priority: 30, // Самый высокий приоритет для изоляции Matrix SDK
            },
            {
              name: 'mui',
              test: /node_modules[\\/]@mui/,
              priority: 20, // Отделяем Material-UI
            },
            {
              name: 'vendor',
              test: /node_modules/,
              priority: 10, // Все остальные библиотеки (React, ReactDOM и др.)
            },
          ],
        },
      },
    },
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