import { isSupportedLocalFile } from '../player/sources.js'
import { loadDirHandle, saveDirHandle, scanDirectory } from '../player/localVideos.js'
import { toast } from '../utils.js'

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
      // 有扫描条目但无视频 → 可能是格式不支持
      if (stats.scanned > 0) {
        toast('该文件夹下没有找到支持播放的视频文件', 'error')
      } else {
        // 完全没有扫描到文件 → 可能是权限问题，静默处理避免误导
        toast('未找到可播放的媒体文件', 'error')
      }
      return
    }
    this._addLocalFiles(files)
  },
}
