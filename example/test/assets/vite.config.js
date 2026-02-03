import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'


export default defineConfig(({mode}) => {
  const dev = mode === "development";

  return {
    plugins: [react()],
    base: dev ? "http://localhost:4100/" : "/",
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      host: "localhost",
      port: 4100,
      strictPort: true,
      origin: "http://localhost:4100",
      cors: true
    }
  }
})
