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
Entries discovered by the Agent during task execution should follow this format:

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
- Date: 2026-08-02
- Context: Discovered by Agent while performing multi-format playback verification for the universal video player (dev server http://localhost:5173)
- Category: Testing Methods
- Instructions:
  - Playwright 测试脚本需放在 /workspace 下运行（ESM import 按脚本位置解析 node_modules）；临时测试脚本统一移到 /tmp/opencode/tests/ 保留
  - Playwright `chromium.launch({ channel: 'chromium' })` 完整版下 `canvas.captureStream` + MediaRecorder 录制的 webm 会损坏（仅 110B 头，无 cluster）；headless shell 录制正常。生成测试视频源应优先用 ffmpeg lavfi：`ff.run('-f','lavfi','-i','testsrc2=size=320x180:rate=15','-t','1.5','-c:v','libvpx','-an','-y','src.webm')`
  - 生产构建（vite preview）下 `/src/...` 源码模块路由不可访问（返回 index.html 的 text/html），测试只能 import 构建产物或走 UI 公开行为
  - 播放器 12 格式验证通过：MP4/WebM/MKV/AVI/MOV/OGV/MP3/M4A/WAV/OGG 走原生或转码，FLV/TS 走 mpegts.js 引擎

[Project Knowledge Summary]
- Date: 2026-08-02
- Context: Discovered by Agent while debugging ffmpeg.wasm transcode and HEVC encoding attempts
- Category: Troubleshooting & Debugging
- Instructions:
  - ffmpeg.wasm v0.11.6 的 libx265 (HEVC) 编码会卡死（pthread 不兼容单线程 wasm），测试中必须排除 HEVC 编码，避免无限超时
  - `startTranscode` 必须防重入（`if (this.transcodeAbort) return`）并在成功/失败分支清空 transcodeAbort；否则 video `error` 事件重复触发会并发启动多个 transcodeFile，共享同一 ffmpeg FS 文件互相 unlink 导致失败
  - video 元素对无法解码的 file 会触发 `error` 事件（code 4），播放器通过 onError -> _handleError -> startTranscode 自动转码兜底；`play()` 的 NotAllowedError（autoplay 被拒）不应触发转码
