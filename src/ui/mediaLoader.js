import { detectKind, isSupportedLocalFile } from '../player/sources.js'
import { transcodeFile } from '../player/transcoder.js'
import { baseName, toast } from '../utils.js'

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
  },

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
