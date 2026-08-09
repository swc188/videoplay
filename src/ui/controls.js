import { Player } from '../player/Player.js'
import { SubtitleManager } from './subtitles.js'
import { Playlist } from './playlist.js'
import { menuMethods, SPEEDS } from './menus.js'
import { gestureMethods } from './gestures.js'
import { shortcutMethods } from './shortcuts.js'
import { mediaLoaderMethods } from './mediaLoader.js'
import { localLibraryMethods } from './localLibrary.js'
import { playerEventsMethods } from './playerEvents.js'
import { domBuilderMethods } from './domBuilder.js'
import { loadPrefs } from './prefs.js'
import { el, icon, toast, fmtTime } from '../utils.js'

export class PlayerUI {
  constructor(rootEl) {
    this.root = rootEl
    this.prefs = loadPrefs()
    this.playlist = new Playlist(() => this.renderPlaylist())
    this.currentItem = null
    this.transcodeAbort = null
    this.uiTimer = null
    this.lastTap = 0
    this.tapTimer = null
    this.dragMode = false
    this.scrubbing = false
    this._build()
    this.player = new Player(this.video, this._playerEvents())
    this.subtitle = new SubtitleManager(this.subLayer, this.video)
    this._bind()
    this._applyPrefs()
    // 默认不显示首屏，直接展示播放列表（移动端折叠为抽屉按钮）
    this.emptyState.classList.add('hidden')
    this._syncPlaylistLayout()
    this._initLocalLibrary()
  }

  /* ================= DOM 构建 ================= */
  // 见 domBuilder.js（_build / _topBtn / _buildControlBar / _ctrlBtn / _buildUrlDialog）

  /* ================= 事件绑定 ================= */
  _bind() {
    // 按钮委托
    this.playerEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]')
      if (!btn) return
      const action = btn.getAttribute('data-action')
      if (action) this._act(action)
    })

    // 中央点击 / 手势
    this.centerZone.addEventListener('pointerdown', (e) => this._gestureDown(e))
    this.centerZone.addEventListener('pointermove', (e) => this._gestureMove(e))
    this.centerZone.addEventListener('pointerup', (e) => this._gestureUp(e))
    this.centerZone.addEventListener('pointercancel', () => this._gestureUp())
    this.centerZone.addEventListener('dblclick', (e) => { e.preventDefault() })

    // 进度条
    this._bindProgress()

    // 音量
    this.volRange.addEventListener('input', () => {
      const v = parseFloat(this.volRange.value)
      this.player.setVolume(v, false)
    })

    // 文件选择
    this.fileInput.addEventListener('change', () => {
      if (this.fileInput.files.length) this.loadFiles(this.fileInput.files)
      this.fileInput.value = ''
    })
    this.subInput.addEventListener('change', () => {
      if (this.subInput.files.length) this.loadSubtitleFile(this.subInput.files[0])
      this.subInput.value = ''
    })
    this.folderInput.addEventListener('change', () => {
      if (this.folderInput.files.length) this._addLocalFiles(this.folderInput.files)
      this.folderInput.value = ''
    })

    // 拖拽到整个窗口
    ;['dragenter', 'dragover'].forEach((ev) =>
      window.addEventListener(ev, (e) => { e.preventDefault(); this.emptyState.classList.add('drag-over') }))
    ;['dragleave', 'drop'].forEach((ev) =>
      window.addEventListener(ev, (e) => { e.preventDefault(); this.emptyState.classList.remove('drag-over') }))
    window.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files.length) this.loadFiles(e.dataTransfer.files)
    })

    // 键盘快捷键
    window.addEventListener('keydown', (e) => this._shortcut(e))

    // 鼠标移动显示 UI 并重置隐藏计时器
    this.playerEl.addEventListener('pointermove', () => {
      this.playerEl.classList.remove('ui-hidden')
      clearTimeout(this.uiTimer)
      if (!this.player.paused) {
        this.uiTimer = setTimeout(() => {
          this.playerEl.classList.add('ui-hidden')
        }, 3000)
      }
    })

    // 点击播放器切换 UI 显示/隐藏
    this.playerEl.addEventListener('click', (e) => {
      // 忽略控制栏、播放列表、菜单上的点击
      if (e.target.closest('.control-bar') || e.target.closest('.playlist-panel') ||
          e.target.closest('.menu') || e.target.closest('.icon-btn') ||
          e.target.closest('.pl-item') || e.target.closest('.pl-overlay')) return
      this._toggleUI()
    })

    // 空状态点击
    this.emptyState.addEventListener('click', (e) => {
      if (e.target.closest('.empty-btn.secondary')) { this.urlMask.classList.add('open'); return }
      this.fileInput.click()
    })

    // 全屏状态
    document.addEventListener('fullscreenchange', () => {
      const fs = !!FS.element
      this.playerEl.classList.toggle('fullscreen-mode', fs)
      this.btnFs.innerHTML = ''
      this.btnFs.append(icon(fs ? 'fullscreenExit' : 'fullscreen', 19))
    })
    // 兼容旧版 Safari/Chrome 的全屏事件名
    document.addEventListener('webkitfullscreenchange', () => {
      const fs = !!FS.element
      this.playerEl.classList.toggle('fullscreen-mode', fs)
      this.btnFs.innerHTML = ''
      this.btnFs.append(icon(fs ? 'fullscreenExit' : 'fullscreen', 19))
    })

    // 播放列表按钮
    this.plClearBtn.addEventListener('click', () => {
      this.playlist.clear()
      this.renderPlaylist()
    })
    this.plFolderBtn.addEventListener('click', () => this._selectFolder())

    // 转码面板（点击隐藏）
    this.tp.addEventListener('click', () => {
      if (this.transcodeAbort) { this.transcodeAbort.abort(); toast('已取消转码') }
    })

    // 移动端抽屉点击外部关闭
    this.playerEl.addEventListener('click', (e) => {
      if (!this.plPanel.classList.contains('open')) return
      const plRect = this.plPanel.getBoundingClientRect()
      if (e.clientX < plRect.left) {
        this.plPanel.classList.remove('open')
        this._updatePlOverlay()
        this._updateTopBarVisibility()
      }
    })

    // 全局错误捕获：任何未捕获异常都提示，避免「闪退为空」后页面静默空白
    window.addEventListener('error', (e) => {
      if (e && e.message && e.message !== 'Script error.') toast(`页面错误：${e.message}`, 'error')
    })
    window.addEventListener('unhandledrejection', (e) => {
      const msg = e && e.reason ? (e.reason.message || String(e.reason)) : '未知错误'
      if (msg && msg !== 'aborted') toast(`运行错误：${msg}`, 'error')
    })

    // 布局切换时自动同步播放列表开关
    const mqlMobile = window.matchMedia('(max-width: 820px)')
    const mqlLandscape = window.matchMedia('(max-height: 500px) and (orientation: landscape)')
    const sync = () => this._syncPlaylistLayout()
    mqlMobile.addEventListener('change', sync)
    mqlLandscape.addEventListener('change', sync)
  }

  _bindProgress() {
    const wrap = this.playerEl.querySelector('.progress-wrap')
    let dragging = false

    const clientXFromEvent = (e) => (e.touches ? e.touches[0].clientX : e.clientX)
    const apply = (e) => {
      const rect = wrap.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (clientXFromEvent(e) - rect.left) / rect.width))
      return ratio
    }

    wrap.addEventListener('pointerdown', (e) => {
      dragging = true
      this.scrubbing = true
      wrap.classList.add('scrubbing')
      wrap.setPointerCapture(e.pointerId)
      this._previewScrub(apply(e))
    })
    wrap.addEventListener('pointermove', (e) => {
      const ratio = apply(e)
      this.progTooltip.textContent = fmtTime(ratio * this.player.duration)
      this.progTooltip.style.left = `${ratio * 100}%`
      if (dragging) this._previewScrub(ratio)
    })
    const end = () => {
      if (dragging) {
        this.player.seek(this.player.duration * this._scrubRatio)
      }
      dragging = false
      this.scrubbing = false
      wrap.classList.remove('scrubbing')
    }
    wrap.addEventListener('pointerup', end)
    wrap.addEventListener('pointercancel', end)
  }

  _previewScrub(ratio) {
    this._scrubRatio = ratio
    this.playBar.style.width = `${ratio * 100}%`
    this.thumb.style.left = `${ratio * 100}%`
  }

  /* ================= 播放器事件 ================= */
  // 见 playerEvents.js（_playerEvents 回调集）

  /* ================= 加载 / 播放 ================= */
  // 见 mediaLoader.js（loadUrl / loadFiles / playItem / playLast / startTranscode / loadSubtitleFile）
  // 见 localLibrary.js（_initLocalLibrary / _selectFolder / _addLocalFiles / _loadFromHandle）

  /* ================= 控制动作 ================= */
  _act(action) {
    switch (action) {
      case 'play': this.player.toggle(); this._pokeUI(); break
      case 'prev':
        if (!this.playlist.items.length) break
        const idx = this.playlist.items.findIndex(i => i.id === this.currentItem?.id)
        if (idx > 0) this.playItem(this.playlist.items[idx - 1].id)
        else this.playItem(this.playlist.items[this.playlist.items.length - 1].id)
        this._pokeUI()
        break
      case 'next':
        if (!this.playlist.items.length) break
        const ni = this.playlist.items.findIndex(i => i.id === this.currentItem?.id)
        if (ni >= 0 && ni < this.playlist.items.length - 1) this.playItem(this.playlist.items[ni + 1].id)
        else if (this.playlist.items.length > 0) this.playItem(this.playlist.items[0].id)
        this._pokeUI()
        break
      case 'rewind': this.player.seekBy(-10); this._pokeUI(); break
      case 'forward': this.player.seekBy(10); this._pokeUI(); break
      case 'mute': this.player.setVolume(this.player.volume, !this.player.muted); break
      case 'pip':
        if (!PiP.request) return toast('当前环境不支持画中画', 'error')
        PiP.request(this.player.video).catch(() => toast('当前环境不支持画中画', 'error'))
        break
      case 'capture': this.capture(); break
      case 'loop': this.toggleLoop(); break
      case 'fullscreen': this.toggleFullscreen(); break
      case 'open-file': this.fileInput.click(); break
      case 'open-url': this.urlMask.classList.add('open'); break
      case 'toggle-playlist': this.togglePlaylist(); break
      case 'menu-speed': this.openMenu('speed'); break
      case 'subtitle': this.openMenu('subtitle'); break
      default: break
    }
  }

  capture() {
    const canvas = this.player.captureFrame()
    if (!canvas) { toast('当前帧无法截取', 'error'); return }
    const a = el('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `capture-${Date.now()}.png`
    a.click()
    toast('截图已保存')
  }

  toggleLoop() {
    const on = !this.player.video.loop
    this.player.setLoop(on)
    this.btnLoop.classList.toggle('active', on)
    toast(`循环播放已${on ? '开启' : '关闭'}`)
  }

  async toggleFullscreen() {
    if (FS.element) {
      await FS.exit?.()?.catch(() => {})
    } else {
      await FS.request(this.playerEl)?.catch(() => toast('当前环境不支持全屏', 'error'))
    }
  }

  togglePlaylist() {
    this.plPanel.classList.toggle('open')
    this._updatePlOverlay()
    this._updateTopBarVisibility()
    if (this.plPanel.classList.contains('open')) this.renderPlaylist()
  }

  /**
   * 移动端（≤820px 或横屏矮窗）默认折叠播放列表，窗口撑开后自动展开
   */
  _syncPlaylistLayout() {
    const mobile = window.matchMedia('(max-width: 820px)').matches ||
      (window.matchMedia('(max-height: 500px)').matches && window.matchMedia('(orientation: landscape)').matches)
    this.plPanel.classList.toggle('open', !mobile)
    this._updatePlOverlay()
    this._updateTopBarVisibility()
    if (!mobile) this.renderPlaylist()
  }

  _updatePlOverlay() {
    const mobile = window.matchMedia('(max-width: 820px)').matches ||
      (window.matchMedia('(max-height: 500px)').matches && window.matchMedia('(orientation: landscape)').matches)
    this.plOverlay.classList.toggle('show', this.plPanel.classList.contains('open') && mobile)
  }

  _updateTopBarVisibility() {
    const mobile = window.matchMedia('(max-width: 820px)').matches ||
      (window.matchMedia('(max-height: 500px)').matches && window.matchMedia('(orientation: landscape)').matches)
    if (mobile) {
      this.topBar.style.display = this.plPanel.classList.contains('open') ? 'none' : 'flex'
    }
  }

  /* ================= 播放列表渲染 ================= */
  renderPlaylist() {
    // 分块渲染：大列表（数千个视频）一次性构建 DOM 会阻塞主线程数十秒
    this._plRenderToken = (this._plRenderToken || 0) + 1
    const token = this._plRenderToken
    this.plList.innerHTML = ''
    const items = this.playlist.items
    if (!items.length) {
      this.plList.append(el('div', { class: 'pl-empty' }, [
        '列表为空。', el('br'),
        '点击上方「文件夹」选择本地视频目录，自动加载全部视频。',
      ]))
      return
    }
    const CHUNK = 200
    const build = (start, end) => {
      for (let idx = start; idx < end && idx < items.length; idx++) {
        const item = items[idx]
        const row = el('div', { class: 'pl-item' + (item.id === this.currentItem?.id ? ' active' : '') }, [
          el('span', { class: 'pl-index' }, String(idx + 1)),
          el('span', { class: 'pl-title' }, item.title),
          el('span', { class: 'pl-type' }, item.kind || (item.source.type === 'file' ? 'file' : 'net')),
          el('button', { class: 'pl-del', type: 'button', title: '移除' }, [icon('trash', 14)]),
        ])
        row.addEventListener('click', (e) => {
          if (e.target.closest('.pl-del')) { this.playlist.remove(item.id); return }
          if (item.id !== this.currentItem?.id) this.playItem(item.id)
          this.plList.focus({ preventScroll: true })
        })
        this.plList.append(row)
      }
    }
    let i = 0
    const next = () => {
      if (token !== this._plRenderToken) return
      build(i, i + CHUNK)
      i += CHUNK
      if (i < items.length) requestAnimationFrame(next)
    }
    build(0, CHUNK)
    if (items.length > CHUNK) requestAnimationFrame(next)
  }


  /* ================= UI 显隐 ================= */
  _pokeUI() {
    this.playerEl.classList.remove('ui-hidden')
    clearTimeout(this.uiTimer)
    if (!this.player.paused) {
      this.uiTimer = setTimeout(() => {
        this.playerEl.classList.add('ui-hidden')
      }, 3000)
    }
  }

  _toggleUI() {
    if (this.playerEl.classList.contains('ui-hidden')) {
      this.playerEl.classList.remove('ui-hidden')
      clearTimeout(this.uiTimer)
    } else {
      this.playerEl.classList.add('ui-hidden')
      clearTimeout(this.uiTimer)
      if (!this.player.paused) {
        this.uiTimer = setTimeout(() => {
          this.playerEl.classList.add('ui-hidden')
        }, 3000)
      }
    }
  }

  /* ================= 错误处理 ================= */
  _restoreEmpty() {
    const v = this.video
    const idle = !v.currentSrc && !v.error && !this.transcodeAbort
    if (idle) this.emptyState.classList.remove('hidden')
  }

  _handleError(err) {
    const msg = err?.message || '加载失败'
    toast(msg, 'error')
    if (this.currentItem && this.currentItem.source.type === 'file' && !this.transcodeAbort) {
      toast('尝试使用 ffmpeg.wasm 转码播放…')
      setTimeout(() => this.startTranscode(this.currentItem.source.file), 800)
    } else {
      this._restoreEmpty()
    }
  }

  _onEnded() {
    this.spinner.classList.remove('show')
    this.playerEl.classList.remove('buffering')
    if (this.player.video.loop) {
      this.player.play()
      return
    }
    // 连播下一项
    const next = this.playlist.next(this.currentItem?.id)
    if (next && next.id !== this.currentItem?.id) {
      this.playItem(next.id)
      toast(`下一集：${next.title}`)
    }
  }

  /* ================= 偏好应用 ================= */
  _applyPrefs() {
    const p = this.prefs
    if (typeof p.volume === 'number') {
      this.player.setVolume(p.volume, p.muted)
      this.volRange.value = String(p.volume)
    }
    if (typeof p.rate === 'number' && SPEEDS.includes(p.rate)) {
      this.player.setRate(p.rate)
      this.btnSpeed.textContent = `${p.rate}x`
    }
    if (p.loop) {
      this.player.setLoop(true)
      this.btnLoop.classList.add('active')
    }
    if (p.subSize) {
      this.subtitle.setSize(p.subSize)
    }
  }
}

Object.assign(PlayerUI.prototype, menuMethods, gestureMethods, shortcutMethods, mediaLoaderMethods, localLibraryMethods, playerEventsMethods, domBuilderMethods)
