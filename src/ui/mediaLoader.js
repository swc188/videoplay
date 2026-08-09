import { detectKind, isSupportedLocalFile, isMobileDevice } from '../player/sources.js'
import { transcodeFile } from '../player/transcoder.js'
import { baseName, extname, toast } from '../utils.js'

// 流式协议走专用引擎（hls.js/mpegts.js），原生解码失败不转码
const EXTS_NO_TRANSCODE = ['m3u8', 'mpd', 'flv', 'ts']

export const mediaLoaderMethods = {
  async loadUrl(url, title) {
    const kind = detectKind({ url }).kind
    this.playlist.add({ title: title || baseName(url), source: { type: 'url', url }, kind })
    await this.playLast()
  },

  async loadFiles(fileList) {
    const files = [...fileList].filter(isSupportedLocalFile)
    if (!files.length) { toast('未找到可播放的媒体文件', 'error'); return }
    const entries = files.map((f) => this.playlist.addFile(f))
    await this.playItem(entries[0].id)
    // 移动端选择文件后自动展开播放列表
    if (!this.plPanel.classList.contains('open')) this.togglePlaylist()
  },

  async playLast() {
    const items = this.playlist.items
    if (!items.length) return
    await this.playItem(items[items.length - 1].id)
  },

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
      // 自动开始播放（iOS Safari 需要用户交互，失败时静默处理）
      this.player.play().catch(() => {})
    } catch (e) {
      this.spinner.classList.remove('show')
      this.playerEl.classList.remove('buffering')
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        toast('浏览器阻止了自动播放，请点击播放', 'error')
        return
      }
      this._handleError(e)
    }
  },

  startTranscode(file) {
    if (this.transcodeAbort) return
    // 移动端不支持 ffmpeg.wasm 转码
    if (isMobileDevice()) {
      toast('移动端暂不支持转码，请使用 MP4 (H.264) 或 WebM 格式的视频', 'error')
      this._restoreEmpty()
      return
    }
    const ctrl = new AbortController()
    this.transcodeAbort = ctrl
    this.tpFill.style.width = '0%'
    this.tp.querySelector('.tp-pct').textContent = '0%'
    this.tp.querySelector('.tp-meta').textContent = '正在加载解码引擎（首次约 24MB）...'
    this.tp.classList.add('show')

    const started = Date.now()
    transcodeFile(file, {
      onEngineLoad: () => {
        if (ctrl.signal.aborted) return
        this.tp.querySelector('.tp-pct').textContent = '1%'
        this.tp.querySelector('.tp-meta').textContent = '解码引擎已就绪，开始转码...'
      },
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
      // blob URL 无扩展名，必须显式指定 kind 为 native，否则会再次误判为转码；
      // fromTranscode 标记防止转码结果再次解码失败时无限循环转码
      await this.player.load({ type: 'url', url, title: this.currentItem?.title || '转码结果', kind: 'native', fromTranscode: true })
      this.player.play()
    }).catch((e) => {
      this.transcodeAbort = null
      this.tp.classList.remove('show')
      if (ctrl.signal.aborted) return
      toast(`转码失败：${e.message || '未知错误'}`, 'error')
      this._restoreEmpty()
    })
  },

  // Edge/Chrome 原生解码失败（HEVC 等无内置解码器）时回退转码播放
  async _fallbackTranscode() {
    if (this.player.current?.fromTranscode) {
      // 转码后仍失败，给出明确提示
      toast('该格式在浏览器中无法播放，建议使用 MP4 (H.264) 或 WebM 格式', 'error')
      this._restoreEmpty()
      return
    }
    if (this.transcodeAbort) return
    // 移动端不支持转码
    if (isMobileDevice()) {
      toast('移动端暂不支持转码，请使用 MP4 (H.264) 或 WebM 格式的视频', 'error')
      this._restoreEmpty()
      return
    }
    const src = this.currentItem?.source
    if (!src) return
    this.spinner.classList.remove('show')
    this.playerEl.classList.remove('buffering')
    try {
      let file = src.type === 'file' ? src.file : null
      if (!file && src.url) {
        if (EXTS_NO_TRANSCODE.includes(extname(src.url))) {
          this._handleError(new Error('该格式不受浏览器支持'))
          return
        }
        this.tp.classList.add('show')
        this.tpFill.style.width = '0%'
        this.tp.querySelector('.tp-pct').textContent = '0%'
        this.tp.querySelector('.tp-meta').textContent = '正在下载视频用于转码...'
        const resp = await fetch(src.url)
        if (!resp.ok) throw new Error('视频下载失败')
        const buf = await resp.blob()
        file = new File([buf], baseName(src.url) || 'video.mp4', { type: buf.type || 'video/mp4' })
      }
      if (!file) { this._restoreEmpty(); return }
      this.startTranscode(file)
    } catch (e) {
      this._handleError(e)
    }
  },

  async loadSubtitleFile(file) {
    const text = await file.text()
    const n = this.subtitle.loadText(text)
    this.subtitle.setEnabled(true)
    this.subtitle.update()
    this.btnSub.classList.add('active')
    toast(n > 0 ? `已加载 ${n} 条字幕` : '字幕文件为空', n > 0 ? 'success' : 'error')
  },
}
