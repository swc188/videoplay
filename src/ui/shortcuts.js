import { toast } from '../utils.js'
import { savePrefs } from './prefs.js'

export const shortcutMethods = {
  _shortcut(e) {
    const t = e.target
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
    const k = e.key.toLowerCase()
    // 焦点在播放列表中时，让方向键用于列表滚动/选中，而非音量/快进
    if (t && (t.closest('.playlist-list') || t === this.plList)) {
      if (k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright') return
    }
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
  },

  _nudgeVolume(d) {
    const nv = Math.max(0, Math.min(1, this.player.volume + d))
    this.player.setVolume(nv, false)
    toast(`音量 ${Math.round(nv * 100)}%`)
  },
}
