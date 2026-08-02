## Goal
- 构建跨端视频播放器并适配各种显示器，修复播放列表点击灰色无法点选问题，实现菜单显示/隐藏切换功能

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
- 修复 `isSupportedLocalFile` 函数：处理 `file.type` 为 undefined 的情况，避免多选文件时崩溃
- 11 设备测试全部通过（桌面 1920x1080/1366x768/4K/Wide、iPad Pro 11、iPad Mini、iPhone 12/13 Mini/SE、Pixel 5、Galaxy S9+）
- 无溢出、无遮挡、无横向滚动

### In Progress
- 无，任务已完成

### Blocked
- 无

## Key Decisions
- 移动端默认折叠播放列表，切换视口自动同步开关
- 遮罩 z-index 34，播放列表 z-index 35，确保列表可点击
- container 查询适配矮播放器（竖屏场景）
- overlay 元素追加到 DOM 末尾，避免 flex 布局导致层级混乱
- spinner 添加 pointer-events: none 避免拦截点击
- UI 切换逻辑：pointermove 不设置隐藏计时器，由点击或键盘触发

## Next Steps
- 无，任务已完成

## Relevant Files
- `/workspace/src/style.css`：响应式适配 + 遮罩样式 + spinner pointer-events
- `/workspace/src/ui/controls.js`：播放列表默认折叠逻辑 + 遮罩点击关闭 + overlay DOM 顺序修复 + UI 显示/隐藏切换
- `/tmp/opencode/tests/`：测试脚本
