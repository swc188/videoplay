import { uid, extname } from '../utils.js'

const LS_KEY = 'uvp:playlist'

export class Playlist {
  constructor(onChange) {
    this.items = []
    this.onChange = onChange || (() => {})
    this._loadPersisted()
  }

  add(item) {
    const entry = {
      id: uid(),
      title: item.title || '未命名',
      source: item.source,
      persistable: item.persistable !== false,
      kind: item.kind || '',
    }
    this.items.push(entry)
    this._emit()
    return entry
  }

  addFile(file) {
    return this.add({
      title: file.name,
      source: { type: 'file', file },
      persistable: false,
      kind: extname(file.name),
    })
  }

  // 批量加入本地文件，仅触发一次 onChange，避免逐个 addFile 导致多次全量渲染卡死
  addFiles(files) {
    const entries = files.map((file) => ({
      id: uid(),
      title: file.name,
      source: { type: 'file', file },
      persistable: false,
      kind: extname(file.name),
    }))
    this.items.push(...entries)
    this._emit()
    return entries
  }

  addUrl(url, title) {
    return this.add({
      title: title || url,
      source: { type: 'url', url },
      kind: extname(url),
    })
  }

  remove(id) {
    this.items = this.items.filter((i) => i.id !== id)
    this._emit()
  }

  clear() {
    this.items = []
    this._emit()
  }

  get(index) { return this.items[index] }
  indexOf(id) { return this.items.findIndex((i) => i.id === id) }
  next(id) { return this.items[(this.indexOf(id) + 1) % this.items.length] }
  length() { return this.items.length }

  _emit() {
    this.onChange(this.items)
    this._savePersisted()
  }

  _persistable() {
    return this.items
      .filter((i) => i.persistable)
      .map((i) => ({ title: i.title, url: i.source.url, kind: i.kind }))
  }

  _savePersisted() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this._persistable()))
    } catch {}
  }

  _loadPersisted() {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) {
        for (const it of arr) {
          if (it && it.url) {
            this.addUrl(it.url, it.title)
          }
        }
      }
    } catch {}
  }
}
