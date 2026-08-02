import { Player } from '../player/Player.js'
import { transcodeFile } from '../player/transcoder.js'
import { detectKind, isSupportedLocalFile } from '../player/sources.js'
import { loadDirHandle, saveDirHandle, scanDirectory } from '../player/localVideos.js'
import { SubtitleManager } from './subtitles.js'
import { Playlist } from './playlist.js'
import { el, icon, toast, fmtTime, baseName, extname } from '../utils.js'

const LS_PREFS = 'uvp:prefs'
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3]
const DEFAULT_URLS = [
  'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  'https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd',
  'https://www.w3schools.com/html/mov_bbb.mp4',
]

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(LS_PREFS) || '{}') } catch { return {} }
}
function savePrefs(p) {
  try { localStorage.setItem(LS_PREFS, JSON.stringify(p)) } catch {}
}

const FILE_PICKER_ACCEPT = 'video/*,audio/*,.m3u8,.mpd,.srt,.vtt,.mkv,.avi,.mov,.wmv,.rmvb,.flv,.ts'

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
    // 默认不显示首屏，直接展示播放列表
    this.emptyState.classList.add('hidden')
    this.plPanel.classList.add('open')
    this._initLocalLibrary()
  }

  /* ================= DOM 构建 ================= */
  _build() {
    const main = el('div', { class: 'app-main' })
    this.root.append(main)

    this.playerEl = el('div', { class: 'player ui-visible' })
    this.video = el('video', { playsinline: '', preload: 'auto' })

    this.subLayer = el('div', { class: 'subtitle-layer size-normal' })

    const gradT = el('div', { class: 'gradient top' })
    const gradB = el('div', { class: 'gradient bottom' })

    // 空状态
    this.emptyState = el('div', { class: 'empty-state' }, [
      el('div', { class: 'empty-logo' }, [icon('brand', 44)]),
      el('div', { class: 'empty-title' }, '全能视频播放器'),
      el('div', { class: 'empty-sub' }, [
        '拖拽视频文件到此处，或点击下方按钮加载资源。',
        el('br'),
        '在线支持 HLS、DASH、FLV 与 MP4 / WebM；本地任意格式将由 ', el('code', null, 'ffmpeg.wasm'), ' 自动转码播放。',
      ]),
      el('div', { class: 'empty-actions' }, [
        el('button', { class: 'empty-btn primary', type: 'button' }, [icon('folder', 17), '打开本地文件']),
        el('button', { class: 'empty-btn secondary', type: 'button' }, [icon('link', 17), '播放网络视频']),
      ]),
      el('div', { class: 'empty-formats' }, [
        'MP4', 'WebM', 'MKV', 'AVI', 'MOV', 'WMV', 'RMVB', 'FLV', 'TS', 'M3U8', 'MPD', 'MP3',
      ]),
    ])

    // 中央区域
    this.centerZone = el('div', { class: 'center-zone' })
    this.bigPlay = el('button', { class: 'big-play', type: 'button' }, [icon('play', 30)])
    this.centerZone.append(this.bigPlay)

    this.spinner = el('div', { class: 'spinner' }, [el('div', { class: 'spinner-ring' })])

    // 顶栏
    this.titleEl = el('div', { class: 'title' }, '未选择媒体')
    this.topBar = el('div', { class: 'top-bar' }, [
      el('div', { class: 'brand' }, [icon('brand', 18), 'Player']),
      this.titleEl,
      el('div', { class: 'spacer' }),
      this._topBtn('open-file', 'folder', '打开文件', 'open'),
      this._topBtn('open-url', 'link', '网络视频', 'open'),
      this._topBtn('toggle-playlist', 'list', '播放列表', 'toggle'),
    ])

    // 控制栏
    this.controlBar = el('div', { class: 'control-bar' })
    this._buildControlBar()

    // 菜单
    this.menu = el('div', { class: 'menu' })

    // 转码面板
    this.tp = el('div', { class: 'transcode-progress' }, [
      el('div', { class: 'tp-head' }, [
        el('div', { class: 'tp-icon' }, [icon('gear', 20)]),
        el('div', { class: 'tp-label' }, '正在转码为 MP4 (H.264)'),
        el('div', { class: 'tp-pct' }, '0%'),
      ]),
      el('div', { class: 'tp-track' }, [this.tpFill = el('div', { class: 'tp-fill' })]),
      el('div', { class: 'tp-meta' }, ''),
    ])

    this.playerEl.append(this.video, this.subLayer, gradT, gradB, this.emptyState, this.spinner, this.centerZone, this.topBar, this.controlBar, this.menu, this.tp)

    // 播放列表面板
    this.plPanel = el('aside', { class: 'playlist-panel' }, [
      el('div', { class: 'playlist-header' }, [
        el('h3', null, [icon('list', 17), '播放列表']),
        el('div', { class: 'playlist-actions' }, [
          this.plFolderBtn = el('button', { class: 'playlist-clear', type: 'button', title: '选择本地视频文件夹，自动加载全部视频' }, [icon('folder', 15), ' 文件夹']),
          this.plClearBtn = el('button', { class: 'playlist-clear', type: 'button' }, '清空'),
        ]),
      ]),
      this.plList = el('div', { class: 'playlist-list' }),
    ])

    main.append(this.playerEl, this.plPanel)

    // 文件选择器
    this.fileInput = el('input', { type: 'file', accept: FILE_PICKER_ACCEPT, multiple: '', style: 'display:none' })
    this.folderInput = el('input', { type: 'file', webkitdirectory: '', multiple: '', style: 'display:none' })
    this.subInput = el('input', { type: 'file', accept: '.srt,.vtt', style: 'display:none' })
    this.root.append(this.fileInput, this.folderInput, this.subInput)

    // URL 对话框
    this.urlDialog = this._buildUrlDialog()
    this.root.append(this.urlDialog)
  }

  _topBtn(action, ic, label, cmd) {
    return el('button', { class: 'icon-btn', type: 'button', 'data-action': action, title: label },
      [icon(ic, 18), el('span', { class: 'label-text hide-mobile' }, label), el('span', { class: 'cmd', style: 'display:none' }, cmd)])
  }

  _buildControlBar() {
    const progress = el('div', { class: 'progress-wrap', 'data-action': 'progress' }, [
      el('div', { class: 'progress-track' }, [
        this.bufBar = el('div', { class: 'progress-buffer' }),
        this.playBar = el('div', { class: 'progress-played' }),
        this.thumb = el('div', { class: 'progress-thumb' }),
      ]),
      this.progTooltip = el('div', { class: 'progress-tooltip' }),
    ])

    this.btnPlay = el('button', { class: 'ctrl-btn btn-play-pause', type: 'button', 'data-action': 'play' }, [icon('play', 20)])
    this.timeCur = el('span', { class: 'cur' }, '0:00')
    this.timeDur = el('span', { class: 'dur' }, '0:00')

    const row = el('div', { class: 'controls-row' }, [
      this.btnPlay,
      this._ctrlBtn('rewind', 'rewind', '后退 10 秒', 'rewind', false),
      this._ctrlBtn('forward', 'forward', '前进 10 秒', 'forward', false),
      el('div', { class: 'time-display' }, [this.timeCur, el('span', { class: 'sep' }, '/'), this.timeDur]),
      el('div', { class: 'spacer', style: 'flex:1' }),
      this.volumeBox = el('div', { class: 'volume-box' }, [
        this.btnMute = this._ctrlBtn('mute', 'volume', '静音', 'mute', false),
        el('div', { class: 'vol-range' }, [
          this.volRange = el('input', { type: 'range', min: '0', max: '1', step: '0.01', value: '1' }),
        ]),
      ]),
      this.btnSpeed = el('button', { class: 'ctrl-btn speed-chip', type: 'button', 'data-action': 'menu-speed' }, '1x'),
      this.btnSub = this._ctrlBtn('subtitle', 'subtitle', '字幕', 'subtitle', true),
      this.btnPip = this._ctrlBtn('pip', 'pip', '画中画', 'pip', true),
      this.btnShot = this._ctrlBtn('capture', 'camera', '截图', 'capture', true),
      this.btnLoop = this._ctrlBtn('loop', 'repeat', '循环播放', 'loop', false),
      this.btnFs = this._ctrlBtn('fullscreen', 'fullscreen', '全屏', 'fullscreen', false),
    ])

    this.controlBar.append(progress, row)
  }

  _ctrlBtn(action, ic, title, cmd, hideMobile) {
    return el('button', {
      class: `ctrl-btn ${hideMobile ? 'hide-mobile' : ''}`,
      type: 'button', 'data-action': action, title,
    }, [icon(ic, 19)])
  }

  _buildUrlDialog() {
    const nameInput = el('input', { class: 'input', placeholder: '自定义名称（可选）' })
    const urlInput = el('input', { class: 'input', placeholder: 'https://example.com/movie.mp4', spellcheck: 'false' })
    const chips = el('div', { class: 'hint-chips' }, DEFAULT_URLS.map((u) =>
      el('button', { class: 'hint-chip', type: 'button' }, baseName(u))))
    chips.addEventListener('click', (e) => {
      const chip = e.target.closest('.hint-chip')
      if (chip) { urlInput.value = chip.textContent; urlInput.focus() }
    })
    const dialog = el('div', { class: 'dialog' }, [
      el('h3', null, [icon('link', 18), '播放网络视频']),
      el('div', { class: 'desc' }, '粘贴媒体地址，支持 HLS(.m3u8)、DASH(.mpd)、FLV、MP4、WebM 及任意可直接访问的视频直链。'),
      el('div', { class: 'field' }, [el('label', null, '媒体地址'), urlInput, chips]),
      el('div', { class: 'field' }, [el('label', null, '标题'), nameInput]),
      el('div', { class: 'dialog-actions' }, [
        el('button', { class: 'btn btn-ghost', type: 'button' }, '取消'),
        el('button', { class: 'btn btn-primary', type: 'button' }, [icon('play', 14), ' 播放']),
      ]),
    ])
    this.urlMask = el('div', { class: 'dialog-mask' }, [dialog])
    this.urlMask.addEventListener('click', (e) => {
      if (e.target === this.urlMask) this.urlMask.classList.remove('open')
    })
    dialog.querySelector('.btn-ghost').addEventListener('click', () => this.urlMask.classList.remove('open'))
    dialog.querySelector('.btn-primary').addEventListener('click', () => {
      const url = urlInput.value.trim()
      if (!url) { toast('请输入媒体地址', 'error'); return }
      this.urlMask.classList.remove('open')
      this.loadUrl(url, nameInput.value.trim() || undefined)
      urlInput.value = ''
      nameInput.value = ''
    })
    return this.urlMask
  }

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

    // 鼠标移动显示 UI
    this.playerEl.addEventListener('pointermove', () => this._pokeUI())

    // 空状态点击
    this.emptyState.addEventListener('click', (e) => {
      if (e.target.closest('.empty-btn.secondary')) { this.urlMask.classList.add('open'); return }
      this.fileInput.click()
    })

    // 全屏状态
    document.addEventListener('fullscreenchange', () => {
      const fs = !!document.fullscreenElement
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

    // 全局错误捕获：任何未捕获异常都提示，避免「闪退为空」后页面静默空白
    window.addEventListener('error', (e) => {
      if (e && e.message && e.message !== 'Script error.') toast(`页面错误：${e.message}`, 'error')
    })
    window.addEventListener('unhandledrejection', (e) => {
      const msg = e && e.reason ? (e.reason.message || String(e.reason)) : '未知错误'
      if (msg && msg !== 'aborted') toast(`运行错误：${msg}`, 'error')
    })
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
  _playerEvents() {
    return {
      onLoadStart: () => {
        this.spinner.classList.add('show')
        this.playerEl.classList.add('buffering')
        this.emptyState.classList.add('hidden')
      },
      onReady: () => {
        this._pokeUI()
      },
      onPlay: () => {
        this.playerEl.classList.add('playing')
        this.btnPlay.classList.add('playing')
        this.btnPlay.innerHTML = ''
        this.btnPlay.append(icon('pause', 20))
        this.bigPlay.innerHTML = ''
        this.bigPlay.append(icon('pause', 30))
      },
      onPause: () => {
        this.playerEl.classList.remove('playing')
        this.btnPlay.classList.remove('playing')
        this.btnPlay.innerHTML = ''
        this.btnPlay.append(icon('play', 20))
        this.bigPlay.innerHTML = ''
        this.bigPlay.append(icon('play', 30))
      },
      onPlaying: () => {
        this.spinner.classList.remove('show')
        this.playerEl.classList.remove('buffering')
      },
      onWaiting: () => {
        this.spinner.classList.add('show')
        this.playerEl.classList.add('buffering')
      },
      onEnded: () => {
        this._onEnded()
      },
      onTimeUpdate: () => {
        const cur = this.player.currentTime
        if (!this.scrubbing) {
          this.timeCur.textContent = fmtTime(cur)
          const d = this.player.duration || 0
          const pct = d ? (cur / d) * 100 : 0
          this.playBar.style.width = `${pct}%`
          this.thumb.style.left = `${pct}%`
        }
        this.subtitle.update()
      },
      onProgress: () => {
        const v = this.video
        if (v.buffered.length) {
          const end = v.buffered.end(v.buffered.length - 1)
          const d = this.player.duration || 0
          this.bufBar.style.width = `${d ? (end / d) * 100 : 0}%`
        }
      },
      onLoadedMetadata: () => {
        this.timeDur.textContent = fmtTime(this.player.duration)
        this.playerEl.classList.toggle('audio-only', !(this.video.videoWidth > 0))
      },
      onDurationChange: () => {
        this.timeDur.textContent = fmtTime(this.player.duration)
      },
      onVolumeChange: () => {
        const m = this.player.muted
        this.btnMute.innerHTML = ''
        this.btnMute.append(icon(m || this.player.volume === 0 ? 'volumeMute' : 'volume', 19))
        this.volRange.value = String(this.player.volume)
      },
      onRateChange: () => {
        this.btnSpeed.textContent = `${this.player.rate}x`
      },
      onEngineError: (err) => {
        this._handleError(err)
      },
      onError: () => {
        this.spinner.classList.remove('show')
        this.playerEl.classList.remove('buffering')
        const v = this.video
        const code = v.error ? v.error.code : null
        if (this.currentItem && code === 4) {
          // 解码失败：尝试转码
          this._handleError(new Error('当前浏览器无法解码该文件'))
        }
      },
    }
  }

  /* ================= 加载 / 播放 ================= */
  async loadUrl(url, title) {
    const kind = detectKind({ url }).kind
    this.playlist.add({ title: title || baseName(url), source: { type: 'url', url }, kind })
    await this.playLast()
  }

  async loadFiles(fileList) {
    const files = [...fileList].filter(isSupportedLocalFile)
    if (!files.length) { toast('未找到可播放的媒体文件', 'error'); return }
    const entries = files.map((f) => this.playlist.addFile(f))
    await this.playItem(entries[0].id)
  }

  /* ================= 本地视频库（打开程序自动加载） ================= */
  async _initLocalLibrary() {
    if (!window.showDirectoryPicker) return
    const handle = await loadDirHandle()
    if (!handle) { this.renderPlaylist(); return }
    let perm = 'prompt'
    try { perm = await handle.queryPermission({ mode: 'read' }) } catch {}
    if (perm === 'granted') await this._loadFromHandle(handle)
  }

  async _selectFolder() {
    if (!window.showDirectoryPicker) { this.folderInput.click(); return }
    let handle
    try {
      handle = await window.showDirectoryPicker({ mode: 'read' })
    } catch (e) {
      if (e && e.name === 'AbortError') return
      this.folderInput.click()
      return
    }
    await saveDirHandle(handle)
    await this._loadFromHandle(handle)
  }

  /**
   * 过滤、排序并加入播放列表展示（不自动播放，等待用户点击）
   */
  _addLocalFiles(files) {
    const list = [...files].filter(isSupportedLocalFile)
    if (!list.length) { toast('该文件夹下没有找到支持播放的视频文件', 'error'); return }
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    list.forEach((f) => this.playlist.addFile(f))
    this.renderPlaylist()
    toast(`已加载 ${list.length} 个本地视频，点击列表播放`, 'success')
  }

  async _loadFromHandle(handle) {
    toast('正在扫描本地视频…')
    let files
    try {
      files = await scanDirectory(handle)
    } catch (e) {
      toast(`扫描失败：${e?.message || e?.name || '未知错误'}`, 'error')
      return
    }
    if (!files.length) { toast('该目录下没有找到支持播放的视频文件', 'error'); return }
    this._addLocalFiles(files)
  }

  async playLast() {
    const items = this.playlist.items
    if (!items.length) return
    await this.playItem(items[items.length - 1].id)
  }

  async playItem(id) {
    const item = this.playlist.items.find((i) => i.id === id)
    if (!item) return
    this.currentItem = item
    this.playerEl.classList.toggle('ui-hidden', false)
    this.renderPlaylist()

    // 取消进行中的转码
    if (this.transcodeAbort) { this.transcodeAbort.abort(); this.transcodeAbort = null }
    this.tp.classList.remove('show')

    try {
      this.titleEl.textContent = item.title
      const res = await this.player.load(item.source)
      if (res.transcode) {
        this.startTranscode(item.source.file)
        return
      }
      // 自动开始播放
      this.player.play()
    } catch (e) {
      this.spinner.classList.remove('show')
      this.playerEl.classList.remove('buffering')
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        toast('浏览器阻止了自动播放，请点击播放', 'error')
        return
      }
      this._handleError(e)
    }
  }

  startTranscode(file) {
    if (this.transcodeAbort) return
    const ctrl = new AbortController()
    this.transcodeAbort = ctrl
    this.tpFill.style.width = '0%'
    this.tp.querySelector('.tp-pct').textContent = '0%'
    this.tp.querySelector('.tp-meta').textContent = '准备解码引擎（首次约 10MB）…'
    this.tp.classList.add('show')

    const started = Date.now()
    transcodeFile(file, {
      onProgress: ({ pct, eta }) => {
        if (ctrl.signal.aborted) return
        this.tpFill.style.width = `${pct}%`
        this.tp.querySelector('.tp-pct').textContent = `${pct}%`
        const elapsed = Math.round((Date.now() - started) / 1000)
        this.tp.querySelector('.tp-meta').textContent = `已用 ${elapsed}s${eta > 0 ? ` · 剩余约 ${eta}s` : ''} · 点击可取消`
      },
      signal: ctrl.signal,
    }).then(async (blob) => {
      if (ctrl.signal.aborted) return
      this.transcodeAbort = null
      this.tp.classList.remove('show')
      toast('转码完成，开始播放', 'success')
      const url = URL.createObjectURL(blob)
      await this.player.load({ type: 'url', url, title: this.currentItem?.title || '转码结果' })
      this.player.play()
    }).catch((e) => {
      this.transcodeAbort = null
      this.tp.classList.remove('show')
      if (ctrl.signal.aborted) return
      toast(`转码失败：${e.message || '未知错误'}`, 'error')
      this._restoreEmpty()
    })
  }

  async loadSubtitleFile(file) {
    const text = await file.text()
    const n = this.subtitle.loadText(text)
    this.subtitle.setEnabled(true)
    this.subtitle.update()
    this.btnSub.classList.add('active')
    toast(n > 0 ? `已加载 ${n} 条字幕` : '字幕文件为空', n > 0 ? 'success' : 'error')
  }

  /* ================= 控制动作 ================= */
  _act(action) {
    switch (action) {
      case 'play': this.player.toggle(); this._pokeUI(); break
      case 'rewind': this.player.seekBy(-10); this._pokeUI(); break
      case 'forward': this.player.seekBy(10); this._pokeUI(); break
      case 'mute': this.player.setVolume(this.player.volume, !this.player.muted); break
      case 'pip': this.player.requestPiP().catch(() => toast('当前环境不支持画中画', 'error')); break
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
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {})
    } else {
      await this.playerEl.requestFullscreen().catch(() => toast('当前环境不支持全屏', 'error'))
    }
  }

  togglePlaylist() {
    this.plPanel.classList.toggle('open')
    if (this.plPanel.classList.contains('open')) this.renderPlaylist()
  }

  /* ================= 播放列表渲染 ================= */
  renderPlaylist() {
    this.plList.innerHTML = ''
    const items = this.playlist.items
    if (!items.length) {
      this.plList.append(el('div', { class: 'pl-empty' }, [
        '列表为空。', el('br'),
        '点击上方「文件夹」选择本地视频目录，自动加载全部视频。',
      ]))
      return
    }
    items.forEach((item, idx) => {
      const row = el('div', { class: 'pl-item' + (item.id === this.currentItem?.id ? ' active' : '') }, [
        el('span', { class: 'pl-index' }, String(idx + 1)),
        el('span', { class: 'pl-title' }, item.title),
        el('span', { class: 'pl-type' }, item.kind || (item.source.type === 'file' ? 'file' : 'net')),
        el('button', { class: 'pl-del', type: 'button', title: '移除' }, [icon('trash', 14)]),
      ])
      row.addEventListener('click', (e) => {
        if (e.target.closest('.pl-del')) { this.playlist.remove(item.id); return }
        if (item.id !== this.currentItem?.id) this.playItem(item.id)
      })
      this.plList.append(row)
    })
  }

  /* ================= 菜单 ================= */
  openMenu(type) {
    this.menu.innerHTML = ''
    this.menu.classList.add('open')

    if (type === 'speed') {
      this.menu.append(el('div', { class: 'menu-title' }, '播放速度'))
      SPEEDS.forEach((s) => {
        const active = Math.abs(this.player.rate - s) < 0.01
        const item = el('button', { class: `menu-item${active ? ' toggled' : ''}`, type: 'button' }, [
          el('span', null, `${s}x`),
          el('span', { class: 'value' }, active ? el('span', { class: 'check' }, '✓') : ''),
        ])
        item.addEventListener('click', () => {
          this.player.setRate(s)
          this.prefs.rate = s
          savePrefs(this.prefs)
          this.menu.classList.remove('open')
        })
        this.menu.append(item)
      })
      const qItem = el('button', { class: 'menu-item', type: 'button' }, [el('span', null, '清晰度'), el('span', { class: 'value' }, '')])
      qItem.addEventListener('click', () => this.openMenu('quality'))
      this.menu.append(qItem)
    } else if (type === 'subtitle') {
      this.menu.append(el('div', { class: 'menu-title' }, '字幕'))
      const on = this.subtitle.enabled
      const offItem = el('button', { class: `menu-item${!on ? ' toggled' : ''}`, type: 'button' }, [
        el('span', null, '关闭字幕'),
        el('span', { class: 'value' }, !on ? el('span', { class: 'check' }, '✓') : ''),
      ])
      offItem.addEventListener('click', () => { this.subtitle.setEnabled(false); this.btnSub.classList.remove('active'); this.menu.classList.remove('open') })
      this.menu.append(offItem)
      this.menu.append(el('div', { class: 'menu-title' }, '字幕大小'))
      ;[['small', '小'], ['normal', '中'], ['large', '大']].forEach(([val, label]) => {
        const item = el('button', { class: 'menu-item', type: 'button' }, [el('span', null, label), el('span', { class: 'value' }, '')])
        item.addEventListener('click', () => {
          this.subtitle.setSize(val)
          this.prefs.subSize = val
          savePrefs(this.prefs)
          this.menu.classList.remove('open')
        })
        this.menu.append(item)
      })
      const loadBtn = el('button', { class: 'menu-item', type: 'button' }, [el('span', null, '加载字幕文件 (.srt / .vtt)'), el('span', { class: 'value' }, '')])
      loadBtn.addEventListener('click', () => { this.menu.classList.remove('open'); this.subInput.click() })
      this.menu.append(loadBtn)
      if (this.subtitle.cues.length) {
        const delBtn = el('button', { class: 'menu-item', type: 'button' }, [el('span', null, '移除字幕'), el('span', { class: 'value' }, '')])
        delBtn.addEventListener('click', () => {
          this.subtitle.clear()
          this.btnSub.classList.remove('active')
          this.menu.classList.remove('open')
        })
        this.menu.append(delBtn)
      }
    } else if (type === 'quality') {
      const hls = this.player.engine
      this.menu.append(el('div', { class: 'menu-title' }, '清晰度'))
      if (hls && hls.levels && hls.levels.length) {
        const opts = [{ label: '自动', idx: -1 }].concat(hls.levels.map((l, i) => ({
          label: `${l.height}p${l.bitrate ? ` (${(l.bitrate / 1e6).toFixed(1)}M)` : ''}`,
          idx: i,
        })))
        opts.forEach((o) => {
          const active = hls.currentLevel === o.idx
          const item = el('button', { class: `menu-item${active ? ' toggled' : ''}`, type: 'button' }, [
            el('span', null, o.label),
            el('span', { class: 'value' }, active ? el('span', { class: 'check' }, '✓') : ''),
          ])
          item.addEventListener('click', () => {
            hls.currentLevel = o.idx
            this.menu.classList.remove('open')
          })
          this.menu.append(item)
        })
      } else {
        this.menu.append(el('div', { class: 'menu-item', style: 'cursor:default' }, [el('span', null, '当前媒体无清晰度选项')]))
      }
    }
  }

  /* ================= 手势 ================= */
  _gestureDown(e) {
    this._gStartX = e.clientX
    this._gStartY = e.clientY
    this._gStartTime = performance.now()
    this._gLastX = e.clientX
    this.dragMode = false
    this._moved = false
    try { this.centerZone.setPointerCapture(e.pointerId) } catch {}
  }

  _gestureMove(e) {
    if (this._moved) return
    const dx = e.clientX - this._gStartX
    const dy = e.clientY - this._gStartY
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      this._moved = true
      this.dragMode = true
      clearTimeout(this.tapTimer)
    }
    if (this.dragMode && Math.abs(dx) > Math.abs(dy) && this.player.duration) {
      const ddx = e.clientX - this._gLastX
      const ratio = ddx / this.playerEl.clientWidth
      this.player.seekBy(ratio * this.player.duration)
      this._gLastX = e.clientX
      this._pokeUI()
    }
  }

  _gestureUp() {
    if (this.dragMode) { this.dragMode = false; this._pokeUI(); return }
    const now = performance.now()
    if (now - this.lastTap < 350) {
      clearTimeout(this.tapTimer)
      this.lastTap = 0
      this.toggleFullscreen()
    } else {
      this.lastTap = now
      this.tapTimer = setTimeout(() => {
        this.player.toggle()
        this._pokeUI()
      }, 250)
    }
  }

  /* ================= UI 显隐 ================= */
  _pokeUI() {
    this.playerEl.classList.add('ui-visible')
    clearTimeout(this.uiTimer)
    this.uiTimer = setTimeout(() => {
      if (!this.player.paused) this.playerEl.classList.remove('ui-visible')
    }, 2600)
  }

  /* ================= 快捷键 ================= */
  _shortcut(e) {
    const t = e.target
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
    const k = e.key.toLowerCase()
    const v = this.player

    switch (k) {
      case ' ':
      case 'k': e.preventDefault(); v.toggle(); this._pokeUI(); break
      case 'arrowleft': e.preventDefault(); v.seekBy(e.shiftKey ? -30 : -5); this._pokeUI(); break
      case 'arrowright': e.preventDefault(); v.seekBy(e.shiftKey ? 30 : 5); this._pokeUI(); break
      case 'arrowup': e.preventDefault(); this._nudgeVolume(0.05); break
      case 'arrowdown': e.preventDefault(); this._nudgeVolume(-0.05); break
      case 'j': v.seekBy(-10); this._pokeUI(); break
      case 'l': v.seekBy(10); this._pokeUI(); break
      case 'm': v.setVolume(v.volume, !v.muted); break
      case 'f': this.toggleFullscreen(); break
      case 't': v.requestPiP().catch(() => {}); break
      case 'i': this.capture(); break
      case 'c': this.openMenu('subtitle'); break
      case 'r': v.setRate(v.rate >= 3 ? 1 : v.rate + 0.25); this.prefs.rate = v.rate; savePrefs(this.prefs); break
      case '.': if (v.paused) v.stepFrames(1); break
      case ',': if (v.paused) v.stepFrames(-1); break
      case 'enter':
        if (this.urlMask.classList.contains('open')) break
        break
      default:
        if (/^[0-9]$/.test(k)) {
          v.seek(v.duration * (Number(k) / 10))
          this._pokeUI()
        }
    }
  }

  _nudgeVolume(d) {
    const nv = Math.max(0, Math.min(1, this.player.volume + d))
    this.player.setVolume(nv, false)
    toast(`音量 ${Math.round(nv * 100)}%`)
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

  setRatePersist() {}
}
