import { attachEngine, detectKind, needTranscode } from './sources.js'

export class Player {
  /**
   * @param {HTMLVideoElement} video
   * @param {Object} events
   */
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
    v.addEventListener('error', (e) => {
      this.events.onError?.(e)
    })
  }

  /**
   * 加载一个来源
   * @param {Object} source { type:'url'|'file', url?, file?, title?, mime?, kind? }
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
    } else {
      if (!kind) {
        kind = detectKind({ url, mime: source.mime, name: source.name || url }).kind
      }
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

  play() { return this.video.play().catch(() => {}) }
  pause() { this.video.pause() }
  toggle() { return this.video.paused ? this.play() : this.pause() }
  seek(t) {
    if (Number.isFinite(t)) this.video.currentTime = Math.max(0, Math.min(t, this.duration || 0))
  }
  seekBy(delta) { this.seek((this.video.currentTime || 0) + delta) }
  stepFrames(n = 1) {
    if (this.video.paused) {
      this.video.currentTime += (16 / 1000) * n
    }
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

  // 截图
  captureFrame() {
    const v = this.video
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    if (!canvas.width || !canvas.height) return null
    const ctx = canvas.getContext('2d')
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
    return canvas
  }

  async requestPiP() {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture()
    } else if (this.video.requestPictureInPicture) {
      await this.video.requestPictureInPicture()
    }
  }

  destroy() {
    this.destroyEngine()
    this.video.pause()
    this.video.removeAttribute('src')
    this.video.load()
  }
}
