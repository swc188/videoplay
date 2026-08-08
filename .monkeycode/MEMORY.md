# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
User instruction entries should follow this format:

[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

### Project Knowledge Entry
Entries discovered by the Agent while performing [specific task description] should follow this format:

[Project Knowledge Summary]
- Date: [YYYY-MM-DD]
- Context: Discovered by Agent while performing [specific task description]
- Category: [Operations & Deployment|Build Methods|Testing Methods|Troubleshooting & Debugging|Workflow & Collaboration|Environment Configuration]
- Instructions:
  - [Specific knowledge points, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.
- This helps avoid redundant entries and keeps the memory file tidy.

## Entries

[Project Knowledge Summary]
- Date: 2026-08-08
- Context: Discovered by Agent while fixing browser detection and video playback issues
- Category: Troubleshooting & Debugging
- Instructions:
  - Edge UA contains "Edg/" not "EdgE", regex /Edg[e]/i fails to match
  - Use ua.includes('edg/') string check instead of regex
  - All video formats should be allowed for selection (isSupportedLocalFile returns true)
  - FLV/TS are handled by mpegts.js/flv.js libraries, not transcoding
  - Modern browsers (Chrome/Edge/360) play all formats natively
  - QQ/Baidu browsers use ffmpeg transcoding for non-native formats

[Project Knowledge Summary]
- Date: 2026-08-08
- Context: Discovered by Agent while fixing Edge transcoder "bad memory" error, Chrome file input unresponsiveness, and ffmpeg "can only run one command at a time" error; upgraded to @ffmpeg 0.12.x single-threaded version
- Category: Troubleshooting & Debugging
- Instructions:
  - @ffmpeg/core 0.11.0 unconditionally creates shared WebAssembly.Memory and throws "bad memory" when buffer is not a real SharedArrayBuffer (fails in Edge even with polyfill)
  - Chrome file input click() on display:none elements requires tabindex="0" to reliably trigger; add focus/blur handlers to keep visibility
  - @ffmpeg/ffmpeg 0.11.6 throws "can only run one command at a time" on subsequent transcoding in Edge because FFMPEG_END doesn't fire with non-shared memory
  - Upgrade to @ffmpeg/core@0.12.10 and @ffmpeg/ffmpeg@0.12.15 (single-threaded, no SAB requirement) to fix all Edge transcoder issues
  - 0.12.x API changes: createFFmpeg() -> new FFmpeg(), ff.run() -> ff.exec(), ff.FS() -> ff.writeFile/readFile/deleteFile(), ff.setLogger() -> ff.on('log', cb)
  - ffmpeg-core.js/wasm must be placed in public/ffmpeg-core/ directory; load using absolute URLs: new URL('/ffmpeg-core/ffmpeg-core.js', import.meta.url).href
  - scripts/patch-ffmpeg.js now only validates package versions (0.12.x doesn't need patches)

[Project Knowledge Summary]
- Date: 2026-08-08
- Context: Discovered by Agent while fixing Edge/Chrome "video won't play" (360 fine) and ffmpeg transcode hang in Vite dev
- Category: Troubleshooting & Debugging
- Instructions:
  - 360 browser ships built-in HEVC/extra codec decoders, so HEVC-encoded MP4 plays natively; Edge/Chrome fail with video error code 3/4 (no decoder) — the app must auto-fallback to ffmpeg.wasm transcode on code 3 or 4 (mediaLoader._fallbackTranscode), not just show an error
  - Vite optimizeDeps pre-bundling of @ffmpeg/ffmpeg breaks `new Worker(new URL('./worker.js', import.meta.url))` → /node_modules/.vite/deps/worker.js 404 → ffmpeg load hangs forever with no logs; fix: `optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core'] }` in vite.config.js (load drops from 45s+ hang to ~2s)
  - ffmpeg wasm engine loads ~2s once fixed; transcoding a 1.8s webm takes ~3s in headless
  - Diagnostic trick: importing and manually initializing ffmpeg-core on the main thread works (7-8s), so a hang is specific to the worker path, not wasm fetch/compile

[Project Knowledge Summary]
- Date: 2026-08-08
- Context: Discovered by Agent while diagnosing "all browsers show blank page / playback broken" reported by user on the dev preview link
- Category: Troubleshooting & Debugging
- Instructions:
  - Vite dev server treats `?url=` as a reserved import query: a request like `/?url=https://example.com/a.mp4` returns 403 "outside of Vite serving allow list", blank page, in ALL browsers (production build is unaffected)
  - Web app direct-play links must use `?src=` (or hash `#url=`) instead of `?url=` so they work on both Vite dev and production
  - To tell dev-server 403 from real network 403: body contains "Vite serving allow list" / "server-fs-allow" message

[Project Knowledge Summary]
- Date: 2026-02-04
- Context: Discovered by Agent while implementing cross-device video player UI show/hide toggle feature
- Category: Troubleshooting & Debugging
- Instructions:
  - When implementing UI auto-hide functionality in video players, pointermove events can interfere with click handlers due to event timing
  - Solution: pointermove should only add 'ui-visible' class without setting auto-hide timer; timer only set by click/toggle actions
  - When overlay elements block click events, move overlay to DOM end and ensure z-index hierarchy is correct
  - Spinner/loading elements with z-index can intercept clicks; add pointer-events: none to fix
  - Test on multiple devices (iPad Mini 768x1024, iPhone 12, Pixel 5) to verify touch interaction works correctly
  - Playwright mouse.click() coordinates should match actual element center position, not viewport center
  - File objects from certain sources (Web API, programmatic creation) may have undefined `type` property; always use `(file.type || '')` as default when calling String methods on file.type
