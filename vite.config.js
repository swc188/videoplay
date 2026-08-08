import { defineConfig } from 'vite'
import { resolve } from 'path'

const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
}

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      // @ffmpeg/core 0.12.x exports 只有 "." 和 "./wasm"，需要手动映射子路径
      '@ffmpeg/core/dist/esm/ffmpeg-core.js': resolve(__dirname, 'node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js'),
      '@ffmpeg/core/dist/esm/ffmpeg-core.wasm': resolve(__dirname, 'node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm'),
    },
  },
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
