import { el, icon, toast, fmtTime } from '../utils.js'

export const playerEventsMethods = {
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
        // 播放开始后 3 秒自动隐藏 UI
        clearTimeout(this.uiTimer)
        this.uiTimer = setTimeout(() => {
          if (!this.player.paused) {
            this.playerEl.classList.remove('ui-visible')
          }
        }, 3000)
      },
      onPause: () => {
        this.playerEl.classList.remove('playing')
        this.btnPlay.classList.remove('playing')
        this.btnPlay.innerHTML = ''
        this.btnPlay.append(icon('play', 20))
        this.bigPlay.innerHTML = ''
        this.bigPlay.append(icon('play', 30))
        // 暂停时显示 UI
        clearTimeout(this.uiTimer)
        this.playerEl.classList.add('ui-visible')
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
        if (code === 2) {
          toast('网络错误，无法加载媒体资源', 'error')
          this._restoreEmpty()
        } else if (code === 3) {
          toast('媒体解码失败，文件可能已损坏或编码不受支持', 'error')
          this._restoreEmpty()
        } else if (this.currentItem && code === 4) {
          // 源不受支持：尝试转码
          this._handleError(new Error('该格式不受浏览器支持'))
        }
      },
    }
  },
}
