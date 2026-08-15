import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// Configuração Vite
// ELECTRON_BUILD=1 → base relativo para loadFile() no Electron
export default defineConfig({
  base: process.env.ELECTRON_BUILD === '1' ? './' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    // Proxy: redireciona /api/* para o servidor Express local (porta 3001)
    // Isto evita problemas de CORS durante o desenvolvimento
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/images': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
