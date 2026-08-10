export const gestureMethods = {
  _gestureDown(e) {
    this._gStartX = e.clientX
    this._gStartY = e.clientY
    this._gStartTime = performance.now()
    this._gLastX = e.clientX
    this.dragMode = false
    this._moved = false

    // 双指手势检测
    if (e.pointerType === 'touch' && e.isPrimary) {
      this._initTouchStartX = e.clientX
      this._initTouchStartY = e.clientY
    }

    try { this.centerZone.setPointerCapture(e.pointerId) } catch {}
  },

  _gestureMove(e) {
    // 双指缩放手势
    if (e.pointerType === 'touch' && e.pointerCount === 2) {
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY)

      if (this._initTouchDist === 0) {
        this._initTouchDist = dist
      } else {
        const scale = dist / this._initTouchDist
        const newZoom = Math.max(1, Math.min(5, this._zoomLevel * scale))
        this._applyZoom(newZoom, e.clientX, e.clientY)
      }
      return
    }

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
      // 拖动视频内容，不是跳转进度
      const video = this.player.video
      const currentTransform = video.style.transform || ''
      const match = currentTransform.match(/translate\((-?[\d.]+)px,\s*([-]?\d+px)\)/)
      let offsetX = match ? parseFloat(match[1]) : 0
      let offsetY = match ? parseFloat(match[2]) : 0
      offsetX -= ddx
      this._gLastX = e.clientX
      this._zoomOffsetX = offsetX
      this._applyZoomTransform()
      this._pokeUI()
    }
  },

  _gestureUp(e) {
    // 重置双指距离
    this._initTouchDist = 0

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

  _applyZoom(zoom, centerX, centerY) {
    this._zoomLevel = zoom
    const video = this.player.video
    const rect = this.playerEl.getBoundingClientRect()
    const x = centerX - rect.left - rect.width / 2
    const y = centerY - rect.top - rect.height / 2
    this._zoomOffsetX = x * (1 - 1 / zoom)
    this._zoomOffsetY = y * (1 - 1 / zoom)
    this._applyZoomTransform()
    this.playerEl.classList.add('zoomed')
  },

  _applyZoomTransform() {
    const video = this.player.video
    const transform = `scale(${this._zoomLevel}) translate(${this._zoomOffsetX / this._zoomLevel}px, ${this._zoomOffsetY / this._zoomLevel}px)`
    video.style.transform = transform
  },

  _resetZoom() {
    this._zoomLevel = 1
    this._zoomOffsetX = 0
    this._zoomOffsetY = 0
    this.player.video.style.transform = ''
    this.playerEl.classList.remove('zoomed')
  },
}
