import { defineConfig } from 'vite'

const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
}

export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['.monkeycode-ai.online'],
    headers: isolationHeaders,
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: ['.monkeycode-ai.online'],
    headers: isolationHeaders,
  },
  build: {
    chunkSizeWarningLimit: 6000,
    target: 'es2018',
  },
})
