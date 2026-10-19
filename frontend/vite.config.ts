import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  base: mode === 'development' ? '/' : '/demo-sto/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['unwritten-tinkling-otter.ngrok-free.dev'],
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/tenants': 'http://127.0.0.1:8000'
    }
  },
  build: { outDir: 'dist' }
}))

