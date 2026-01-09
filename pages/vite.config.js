import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/led': 'https://interactive-sign.jthiller.workers.dev',
      '/queue': 'https://interactive-sign.jthiller.workers.dev',
      '/video': 'https://interactive-sign.jthiller.workers.dev',
      '/uplink': 'https://interactive-sign.jthiller.workers.dev',
      '/track': 'https://interactive-sign.jthiller.workers.dev',
      '/partytracks': 'https://interactive-sign.jthiller.workers.dev',
    }
  }
})
