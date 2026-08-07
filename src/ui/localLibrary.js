import { isSupportedLocalFile } from '../player/sources.js'
import { loadDirHandle, saveDirHandle, scanDirectory } from '../player/localVideos.js'
import { toast } from '../utils.js'

/**
 * 检测浏览器是否支持目录选择（showDirectoryPicker 或 webkitdirectory）
 * QQ浏览器/百度浏览器等国产浏览器通常不支持
 */
function supportsDirectoryPicker() {
  if (typeof window.showDirectoryPicker === 'function') return true
  // 检测 webkitdirectory 支持（Chrome/Edge 桌面 + Chrome Android 108+）
  const testInput = document.createElement('input')
  testInput.type = 'file'
  testInput.setAttribute('webkitdirectory', '')
  return !!testInput.webkitdirectory
}

export const localLibraryMethods = {
  /* 打开程序自动加载本地视频库 */
  async _initLocalLibrary() {
    if (!window.showDirectoryPicker) return
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
    if (!window.showDirectoryPicker) { this.folderInput.click(); return }
    let handle
    try {
      handle = await window.showDirectoryPicker({ mode: 'read' })
    } catch (e) {
      if (e && e.name === 'AbortError') return
      this.folderInput.click()
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
    list.forEach((f) => this.playlist.addFile(f))
    this.renderPlaylist()
    toast(`已加载 ${list.length} 个本地视频，点击列表播放`, 'success')
  },

  async _loadFromHandle(handle) {
    toast('正在扫描本地视频…')
    const stats = { scanned: 0, skipped: 0, errors: 0 }
    let files
    try {
      files = await scanDirectory(handle, [], stats)
    } catch (e) {
      toast(`扫描失败：${e?.message || e?.name || '未知错误'}`, 'error')
      return
    }
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
}
