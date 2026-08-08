import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['.monkeycode-ai.online'],
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: ['.monkeycode-ai.online'],
  },
  build: {
    chunkSizeWarningLimit: 6000,
    target: 'es2018',
  },
})
