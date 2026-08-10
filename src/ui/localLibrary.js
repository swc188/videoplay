import { isSupportedLocalFile, isMobileDevice } from '../player/sources.js'
import { loadDirHandle, saveDirHandle, scanDirectory } from '../player/localVideos.js'
import { toast } from '../utils.js'

/**
 * 检测浏览器是否为 QQ浏览器 / 百度浏览器等国产浏览器。
 * 它们基于 Chromium 内核但未实现目录选择 API（showDirectoryPicker / webkitdirectory 实际无效）。
 */
function isLegacyChinaBrowser() {
  const ua = (navigator.userAgent || '').toLowerCase()
  return ua.includes('qqbrowser') || ua.includes('mqqbrowser') ||
    ua.includes('baidu') || ua.includes('baiduboxapp') || ua.includes('bidubrowser') ||
    ua.includes('baidubrowser')
}

/**
 * 检测浏览器是否支持目录选择（showDirectoryPicker 或 webkitdirectory）
 * QQ浏览器/百度浏览器等国产浏览器通常不支持
 * Android Chrome 不支持 showDirectoryPicker，但支持 webkitdirectory
 */
function supportsDirectoryPicker() {
  if (isLegacyChinaBrowser()) return false
  if (typeof window.showDirectoryPicker === 'function') return true
  // Android Chrome 不支持 showDirectoryPicker，但支持 webkitdirectory
  if (isMobileDevice()) {
    const testInput = document.createElement('input')
    testInput.type = 'file'
    testInput.setAttribute('webkitdirectory', '')
    return !!testInput.webkitdirectory
  }
  // 检测 webkitdirectory 支持（Chrome/Edge 桌面 + Chrome Android 108+）
  const testInput = document.createElement('input')
  testInput.type = 'file'
  testInput.setAttribute('webkitdirectory', '')
  return !!testInput.webkitdirectory
}

export const localLibraryMethods = {
  /* 打开程序自动加载本地视频库 */
  async _initLocalLibrary() {
    if (!supportsDirectoryPicker()) return
    const handle = await loadDirHandle()
    if (!handle) { this.renderPlaylist(); return }
    let perm = 'prompt'
    try { perm = await handle.queryPermission({ mode: 'read' }) } catch {}
    if (perm === 'granted') await this._loadFromHandle(handle)
  },

  async _selectFolder() {
    if (!supportsDirectoryPicker()) {
      toast('当前浏览器不支持文件夹选择，将使用多选文件替代', 'info')
      this.fileInput.click()
      return
    }
    // Android Chrome 不支持 showDirectoryPicker，直接使用 webkitdirectory
    if (isMobileDevice() || !window.showDirectoryPicker) { this.folderInput.click(); return }
    let handle
    try {
      handle = await window.showDirectoryPicker({ mode: 'read' })
    } catch (e) {
      if (e && e.name === 'AbortError') return
      // showDirectoryPicker 不可用（QQ/百度等国产浏览器），回退到多选文件
      toast('当前浏览器不支持文件夹选择，将使用多选文件替代', 'info')
      this.fileInput.click()
      return
    }
    await saveDirHandle(handle)
    await this._loadFromHandle(handle)
  },

  /**
   * 过滤、排序并加入播放列表展示（不自动播放，等待用户点击）
   */
  _addLocalFiles(files) {
    const list = [...files].filter(isSupportedLocalFile)
    if (!list.length) { toast('该文件夹下没有找到支持播放的视频文件', 'error'); return }
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    if (this.playlist.addFiles) {
      this.playlist.addFiles(list)
    } else {
      list.forEach((f) => this.playlist.addFile(f))
    }
    this._renderPlaylistAsync(list)
    toast(`已加载 ${list.length} 个本地视频，点击列表播放`, 'success')
  },

  async _loadFromHandle(handle) {
    let progressTimer = null
    let progressCount = 0
    const showProgress = () => {
      progressCount++
      const msgs = [
        '正在扫描本地视频... 10%',
        '正在扫描本地视频... 20%',
        '正在扫描本地视频... 30%',
        '正在扫描本地视频... 40%',
        '正在扫描本地视频... 50%',
        '正在扫描本地视频... 60%',
        '正在扫描本地视频... 70%',
        '正在扫描本地视频... 80%',
        '正在扫描本地视频... 90%',
        '正在扫描本地视频... 95%',
      ]
      toast(msgs[Math.min(progressCount, msgs.length - 1)], 'info')
    }
    progressTimer = setInterval(showProgress, 500)
    showProgress()

    const stats = { scanned: 0, skipped: 0, errors: 0 }
    let files
    try {
      files = await scanDirectory(handle, [], stats)
    } catch (e) {
      clearInterval(progressTimer)
      toast(`扫描失败：${e?.message || e?.name || '未知错误'}`, 'error')
      return
    }
    clearInterval(progressTimer)

    if (!files.length) {
      if (stats.scanned > 0) {
        toast('该文件夹下没有找到支持播放的视频文件', 'error')
      } else {
        toast('未找到可播放的媒体文件', 'error')
      }
      return
    }
    this._addLocalFiles(files)
  },

  /**
   * 异步渲染播放列表，使用 requestIdleCallback 避免阻塞主线程
   */
  _renderPlaylistAsync(list) {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => this.renderPlaylist(), { timeout: 1000 })
    } else {
      setTimeout(() => this.renderPlaylist(), 0)
    }
  },
}
