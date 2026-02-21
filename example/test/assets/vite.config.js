import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { provideDbg } from './src/macros/dbg'
import { join } from 'path'
import { createMacroManager } from 'vite-plugin-macro'

const manager = createMacroManager({
  name: 'macro-manager',
  // all types from all macro plugins/providers will be rendered into this file
  typesPath: join(__dirname, './macros.d.ts'),
})
const macroPlugins = manager.use(provideDbg()).toPlugin()

export default defineConfig(({ mode }) => {
  const dev = mode === 'development'

  return {
    plugins: [react(), ...macroPlugins],
    base: dev ? 'http://localhost:4100/' : '/',
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: 'localhost',
      port: 4100,
      strictPort: true,
      origin: 'http://localhost:4100',
      cors: true,
    },
    ssr: {
      noExternal: [
        '@mui/x-data-grid',
        '@mui/x-date-pickers',
        '@mui/material',
        '@mui/system',
        '@mui/private-theming',
      ],
    },
    optimizeDeps: {
      include: ['@mui/x-data-grid'],
    },
  }
})
