import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Allow access from Cloudflare Tunnel hostnames during local development.
    // This is intentionally broad (all subdomains of trycloudflare.com) because
    // Cloudflare assigns random subdomains. Do not reuse this configuration in
    // production; instead, restrict to a specific known hostname if exposing
    // the dev server outside of a controlled environment.
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
