import { el, icon, toast, baseName } from '../utils.js'

const DEFAULT_URLS = [
  'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  'https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd',
  'https://www.w3schools.com/html/mov_bbb.mp4',
]

const FILE_PICKER_ACCEPT = 'video/*,audio/*,.m3u8,.mpd,.srt,.vtt,.mkv,.avi,.mov,.wmv,.rmvb,.flv,.ts'

export const domBuilderMethods = {
  /* ================= DOM 构建 ================= */
  _build() {
    const main = el('div', { class: 'app-main' })
    this.root.append(main)

    this.playerEl = el('div', { class: 'player' })
    this.video = el('video', { playsinline: '',webkitPlaysInline: '', mozPlaysInline: '',preload: 'auto', autoplay: '', muted: '' })

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
      this.plList = el('div', { class: 'playlist-list', tabindex: '-1' }),
    ])

    main.append(this.playerEl, this.plPanel)

    // 文件选择器 - 使用 clip 隐藏，兼容 Android Chrome
    this.fileInput = el('input', { type: 'file', accept: FILE_PICKER_ACCEPT, multiple: '', tabindex: '0', style: 'position:absolute;left:0;top:0;clip:rect(0,0,0,0);clip-path:inset(50%);height:1px;width:1px;overflow:hidden' })
    this.folderInput = el('input', { type: 'file', webkitdirectory: '', multiple: '', tabindex: '0', style: 'position:absolute;left:0;top:0;clip:rect(0,0,0,0);clip-path:inset(50%);height:1px;width:1px;overflow:hidden' })
    this.subInput = el('input', { type: 'file', accept: '.srt,.vtt', tabindex: '0', style: 'position:absolute;left:0;top:0;clip:rect(0,0,0,0);clip-path:inset(50%);height:1px;width:1px;overflow:hidden' })

    // 移动端抽屉遮罩（放在末尾，确保 z-index 控制层级）
    this.plOverlay = el('div', { class: 'pl-overlay' })
    this.root.append(this.fileInput, this.folderInput, this.subInput)
    this.root.append(this.plOverlay)

    // URL 对话框
    this.urlDialog = this._buildUrlDialog()
    this.root.append(this.urlDialog)
  },

  _topBtn(action, ic, label, cmd) {
    return el('button', { class: 'icon-btn', type: 'button', 'data-action': action, title: label },
      [icon(ic, 18), el('span', { class: 'label-text hide-mobile' }, label), el('span', { class: 'cmd', style: 'display:none' }, cmd)])
  },

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
      this._ctrlBtn('prev', 'next', '上一个', 'prev', false),
      this.btnPlay,
      this._ctrlBtn('next', 'prev', '下一个', 'next', false),
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
    this.btnLoop.classList.add('hide-narrow')

    this.controlBar.append(progress, row)
  },

  _ctrlBtn(action, ic, title, cmd, hideMobile) {
    return el('button', {
      class: `ctrl-btn ${hideMobile ? 'hide-mobile' : ''}`,
      type: 'button', 'data-action': action, title,
    }, [icon(ic, 19)])
  },

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
  },
}
