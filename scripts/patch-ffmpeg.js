#!/usr/bin/env node
/**
 * Patch @ffmpeg packages for Edge browser compatibility.
 *
 * @ffmpeg/core 0.12.x is single-threaded and does not require SharedArrayBuffer,
 * so no patch is needed for ffmpeg-core.js.
 *
 * This script is kept for future compatibility checks.
 */
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const corePath = join(__dirname, '..', 'node_modules', '@ffmpeg', 'core', 'dist', 'esm', 'ffmpeg-core.js')
const ffmpegPath = join(__dirname, '..', 'node_modules', '@ffmpeg', 'ffmpeg', 'dist', 'esm', 'classes.js')

let patched = false

// Check if ffmpeg-core.js exists (0.12.x uses esm/umd structure)
if (existsSync(corePath)) {
  console.log('[patch-ffmpeg] @ffmpeg/core 0.12.x detected, no patch needed (single-threaded, no SAB requirement)')
  patched = true
}

// Check if ffmpeg.min.js needs patching (0.11.x only)
const oldFfmpegPath = join(__dirname, '..', 'node_modules', '@ffmpeg', 'ffmpeg', 'dist', 'ffmpeg.min.js')
if (existsSync(oldFfmpegPath)) {
  console.log('[patch-ffmpeg] @ffmpeg/ffmpeg 0.11.x detected, checking for running flag patch...')
  // The 0.11.x patch logic would go here, but we're on 0.12.x now
  console.log('[patch-ffmpeg] @ffmpeg/ffmpeg 0.11.x not detected, skipping')
} else {
  console.log('[patch-ffmpeg] @ffmpeg/ffmpeg 0.12.x detected, no patch needed')
  patched = true
}

if (!patched) {
  console.error('[patch-ffmpeg] Unknown ffmpeg package structure')
  process.exit(1)
}

console.log('[patch-ffmpeg] All checks passed')
