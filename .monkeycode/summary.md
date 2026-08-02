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
- 修复 overlay 遮挡点击问题：将 plOverlay 追加到 DOM 末尾，playlist-panel 添加 z-index: 35
- 修复 spinner 拦截点击：添加 `pointer-events: none`
- **UI 显示/隐藏切换功能**：
  - 播放时鼠标悬停 3 秒后自动隐藏 UI
  - 点击播放器区域显示/隐藏 UI（切换）
  - 鼠标移动仅显示 UI，不重置隐藏计时器
  - 暂停时 UI 保持显示
- 11 设备测试通过（iPhone 12/13 Mini/SE、Pixel 5、Galaxy S9+、iPad Mini/Pro 11、桌面 1920x1080/1366x768/4K）
- 无溢出、无遮挡、无横向滚动
- 点击播放列表文件行正常响应

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
