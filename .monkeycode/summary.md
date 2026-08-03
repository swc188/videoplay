## Goal
- 构建跨端视频播放器并适配各种显示器，修复播放列表点击灰色无法点选问题，实现播放时点击切换 UI 显示/隐藏，修复多选文件播放列表为空问题

## Constraints & Preferences
- 被测试应用：http://localhost:5173（dev server）
- 预览 URL：https://5173-151a8e2fc0f6ed86.monkeycode-ai.online
- 适配目标：4K/超宽屏、桌面、平板横竖、手机横竖、矮窗口
- 临时测试脚本置放 `/workspace/` 下，用毕移入 `/tmp/opencode/tests/`

## Progress
### Done
- 多设备适配（`src/style.css` + `src/ui/controls.js`）：
  - 大屏（≥1600px）：播放器放大至 1460px、列表加宽 360px、按钮字体放大
  - 中屏（560-820px）：列表收窄 240px、隐藏次要按钮
  - 矮窗口（≤720px）：压缩空状态、控制栏、转码面板居中
  - 手机横屏（max-height≤500px）：播放列表变固定抽屉、播放器铺满
  - 极窄屏（≤400px）：隐藏 loop 按钮、压缩音量条
  - 容器查询（@container max-height≤320px）：竖屏/小屏紧凑空状态
  - 安全区（env(safe-area-inset-*)）：刘海屏适配
- 移动端播放列表默认折叠（`_syncPlaylistLayout` 基于 matchMedia），避免抽屉遮挡播放器
- 移动端抽屉打开时显示遮罩（`pl-overlay` z-index 34，播放列表 z-index 35）
- 修复桌面/移动端播放列表点击拦截问题：
  - 将 `plOverlay` 追加到 root 末尾（playlist-panel 之后），避免 flex 布局导致 DOM 顺序异常
  - 为 `.playlist-panel` 添加 `z-index: 35`
  - 为 `.spinner` 添加 `pointer-events: none`（loading 状态不拦截点击）
- 实现点击播放器区域切换 UI 显示/隐藏：
  - `pointermove` 仅显示 UI，不重置自动隐藏计时器
  - 新增 `_toggleUI()` 方法：点击时切换 `ui-visible` 类，管理 `uiTimer`
  - `_pokeUI()` 保持原有行为（用于播放控制按钮等场景）
- 修复 `isSupportedLocalFile` 函数：处理 `file.type` 为 undefined 的情况（某些浏览器返回无 MIME 类型文件）
- 修复移动端单选/多文件后播放列表保持折叠问题：`loadFiles()` 选择文件后自动调用 `togglePlaylist()` 展开播放列表
- 修复移动端展开播放列表时 top-bar 被拦截问题：
  - 修改 `.pl-overlay` 默认 `pointer-events: none`，仅 `.show` 状态时启用
  - 新增 `_updateTopBarVisibility()` 方法，移动端展开播放列表时隐藏 top-bar，折叠时恢复
- 11 设备测试全部通过
- 单文件/多文件播放测试通过（桌面+移动端）
- 拖拽文件测试通过

### In Progress
- 无，任务已完成

### Blocked
- 无

## Key Decisions
- 移动端默认折叠播放列表，切换视口自动同步开关
- 遮罩 z-index 34，播放列表 z-index 35，确保列表可点击
- 容器查询适配矮播放器（竖屏场景）
- overlay 元素追加到 DOM 末尾，避免 flex 布局导致层级混乱
- `file.type || ''` 默认值，避免 undefined 崩溃
- 选择文件后自动展开播放列表，确保移动端用户可见播放列表内容
- 移动端展开播放列表时隐藏 top-bar，避免按钮被覆盖

## Next Steps
- 无，任务已完成

## Critical Context
- `isSupportedLocalFile` 修复前：多选无 MIME 类型文件时 TypeError 崩溃
- 移动端（≤820px）初始状态 `plPanelOpen=false`，用户无法看到播放列表
- 修复后：`loadFiles()` 调用 `togglePlaylist()` 确保播放列表展开
- iPhone 12/13 Mini/SE、Pixel 5、Galaxy S9+：点击播放列表文件行正常
- iPad Mini：修复前 `plW=2px`，点击被 overlay 拦截；修复后正常
- 桌面 1280x720：修复前点击被 `app-main` 拦截；修复后正常
- 桌面 4K（2560x1440）：点击正常，overflow=false
- 宽屏矮窗口（1920x500）：横屏模式播放列表自动变固定抽屉
- 构建通过（`npm run build` ✓）

## Relevant Files
- `/workspace/src/style.css`：响应式适配 + 遮罩样式 + spinner pointer-events
- `/workspace/src/ui/controls.js`：播放列表折叠逻辑 + overlay 修复 + UI 切换 + 自动展开播放列表 + top-bar 可见性
- `/workspace/src/player/sources.js`：`isSupportedLocalFile` 修复 file.type undefined 问题
- `/tmp/opencode/tests/`：历史测试脚本
