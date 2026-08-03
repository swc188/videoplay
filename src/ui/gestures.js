export const gestureMethods = {
  _gestureDown(e) {
    this._gStartX = e.clientX
    this._gStartY = e.clientY
    this._gStartTime = performance.now()
    this._gLastX = e.clientX
    this.dragMode = false
    this._moved = false
    try { this.centerZone.setPointerCapture(e.pointerId) } catch {}
  },

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
  },

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
  },
}
