import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    devtools(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart({ server: { entry: "./app.server.ts" } }),
    react(),
  ],
  optimizeDeps: {
    exclude: [
      '@tanstack/start-server-core',
      '#tanstack-router-entry',
      '#tanstack-start-entry',
      'tanstack-start-manifest:v',
      'tanstack-start-injected-head-scripts:v',
      'tanstack-start-server-fn-manifest:v',
    ],
  },
})
