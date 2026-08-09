import { attachEngine, detectKind, needTranscode } from './sources.js'

// 全屏 API 兼容层：统一处理标准 API 与各浏览器私有前缀
const FS = {
  request: (el) => el.requestFullscreen?.()
    || el.webkitRequestFullscreen?.()
    || el.mozRequestFullScreen?.()
    || el.msRequestFullscreen?.(),
  exit: () => document.exitFullscreen?.()
    || document.webkitExitFullscreen?.()
    || document.mozCancelFullScreen?.()
    || document.msExitFullscreen?.(),
  get element() {
    return document.fullscreenElement
      || document.webkitFullscreenElement
      || document.mozFullScreenElement
      || document.msFullscreenElement
  },
  get onchange() { return document.onfullscreenchange },
  set onchange(v) { document.onfullscreenchange = v },
}

// 画中画 API 兼容层
const PiP = {
  request: (el) => el.requestPictureInPicture?.()
    || el.webkitEnterPictureInPicture?.(),
  exit: () => document.exitPictureInPicture?.()
    || document.webkitExitPictureInPicture?.(),
  get element() {
    return document.pictureInPictureElement
      || document.webkitPictureInPictureElement
  },
}

export class Player {
  constructor(video, events = {}) {
    this.video = video
    this.events = events
    this.engine = null
    this.engineDestroy = null
    this.objectUrl = null
    this.current = null
    this.enginePromise = null
    this._bind()
  }

  _bind() {
    const v = this.video
    const map = {
      play: 'onPlay', pause: 'onPause', playing: 'onPlaying',
      waiting: 'onWaiting', canplay: 'onCanPlay', ended: 'onEnded',
      timeupdate: 'onTimeUpdate', progress: 'onProgress',
      loadedmetadata: 'onLoadedMetadata', durationchange: 'onDurationChange',
      volumechange: 'onVolumeChange', ratechange: 'onRateChange',
      error: 'onError', loadeddata: 'onLoadedData',
      seeked: 'onSeeked', seeking: 'onSeeking',
      enterpictureinpicture: 'onPiPEnter', leavepictureinpicture: 'onPiPLeave',
    }
    for (const [ev, key] of Object.entries(map)) {
      v.addEventListener(ev, (e) => this.events[key]?.(e))
    }
  }

  /**
   * 加载一个来源
   * @param {{type:'url'|'file', url?:string, file?:File, mime?:string, name?:string, kind?:string, title?:string}} source
   */
  async load(source) {
    this.destroyEngine()
    this.current = source
    this.events.onLoadStart?.()

    let url = source.url
    let kind = source.kind

    if (source.type === 'file' && source.file) {
      if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
      this.objectUrl = URL.createObjectURL(source.file)
      url = this.objectUrl
      kind = detectKind({ mime: source.file.type, name: source.file.name }).kind
    } else if (!kind) {
      kind = detectKind({ url, mime: source.mime, name: source.name || url }).kind
    }

    if (needTranscode(kind)) {
      this.events.onNeedTranscode?.(source)
      return { kind, transcode: true }
    }

    this.enginePromise = attachEngine(this.video, { kind, url })
    try {
      const { engine, destroy } = await this.enginePromise
      this.engine = engine
      this.engineDestroy = destroy
      this.events.onReady?.({ kind })
      return { kind }
    } catch (err) {
      this.enginePromise = null
      this.events.onEngineError?.(err)
      throw err
    }
  }

  destroyEngine() {
    if (this.engineDestroy) {
      try { this.engineDestroy() } catch {}
    }
    this.engine = null
    this.engineDestroy = null
    this.enginePromise = null
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl)
      this.objectUrl = null
    }
  }

  play() {
    // iOS Safari 自动播放策略：需要先静音才能自动播放
    if (this.video.paused && !this.video.muted) {
      const wasMuted = this.video.muted
      this.video.muted = true
      return this.video.play()
        .then(() => {
          // 播放成功后恢复静音状态
          if (!wasMuted) this.video.muted = false
        })
        .catch(() => {
          // 失败时恢复原状态
          this.video.muted = wasMuted
        })
    }
    return this.video.play().catch(() => {})
  }
  pause() { this.video.pause() }
  toggle() { return this.video.paused ? this.play() : this.pause() }

  seek(t) {
    if (Number.isFinite(t)) this.video.currentTime = Math.max(0, Math.min(t, this.duration || 0))
  }
  seekBy(delta) { this.seek((this.video.currentTime || 0) + delta) }
  stepFrames(n = 1) {
    if (this.video.paused) this.video.currentTime += (16 / 1000) * n
  }

  get paused() { return this.video.paused }
  get duration() { return Number.isFinite(this.video.duration) ? this.video.duration : 0 }
  get currentTime() { return this.video.currentTime }
  get ended() { return this.video.ended }
  get rate() { return this.video.playbackRate }
  setRate(r) { this.video.playbackRate = r }
  get volume() { return this.video.volume }
  get muted() { return this.video.muted }
  setVolume(v, muted) {
    this.video.volume = Math.max(0, Math.min(1, v))
    this.video.muted = !!muted
  }
  setLoop(on) { this.video.loop = on }

  captureFrame() {
    const v = this.video
    if (!v.videoWidth || !v.videoHeight) return null
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height)
    return canvas
  }

  async requestPiP() {
    if (PiP.element) {
      await PiP.exit?.()
    } else if (PiP.request(this.video)) {
      await PiP.request(this.video)
    }
  }

  destroy() {
    this.destroyEngine()
    this.video.pause()
    this.video.removeAttribute('src')
    this.video.load()
  }
}
