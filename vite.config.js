import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  optimizeDeps: {
    // @ffmpeg/ffmpeg 依赖独立 worker 文件（new URL('./worker.js')），
    // 若被预打包成单文件会导致 worker 404、ffmpeg 加载挂起，故排除
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core'],
  },
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
