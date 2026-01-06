import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/led': 'http://localhost:8787',
      '/queue': 'http://localhost:8787',
    }
  }
})
