import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mockApiPlugin } from './mock/vite-mock-api.js'
 
export default defineConfig({
  base: './', // делает ссылки относительными
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1200,
    modulePreload: {
      resolveDependencies: (filename, dependencies) => (
        dependencies.filter(dependency => !dependency.includes('matrix-sdk'))
      ),
    },
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules\/(react|react-dom)\//,
            },
            {
              name: 'redux',
              test: /node_modules\/(redux|react-redux|redux-thunk|redux-logger)\//,
            },
            {
              name: 'mui',
              test: /node_modules\/(@mui|@emotion)\//,
            },
            {
              name: 'matrix-sdk',
              test: /node_modules[\\/]matrix-js-sdk/,
            },
            {
              name: 'vendor',
              test: /node_modules/,
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