import { isSupportedLocalFile } from './sources.js'

const DB_NAME = 'uvp:library'
const DB_VERSION = 1
const STORE = 'dirs'
const KEY = 'videoDir'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(db, value, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * 读取已持久化的本地视频目录句柄
 */
export async function loadDirHandle() {
  try {
    const db = await openDB()
    return await idbGet(db, KEY)
  } catch {
    return null
  }
}

/**
 * 持久化用户授权的目录句柄
 */
export async function saveDirHandle(handle) {
  try {
    const db = await openDB()
    await idbPut(db, handle, KEY)
    return true
  } catch {
    return false
  }
}

/**
 * 递归扫描目录，收集支持的全部媒体文件。
 * 跳过 Android 系统目录，单条目失败不中断，用 yield 让出主线程防止卡死。
 */
export async function scanDirectory(dirHandle, out = [], stats) {
  const s = stats || { scanned: 0, skipped: 0, errors: 0 }
  await new Promise((r) => setTimeout(r, 0))
  try {
    for await (const entry of dirHandle.values()) {
      try {
        if (entry.kind === 'directory') {
          if (/^Android(\/|$)/.test(entry.name)) continue
          await scanDirectory(entry, out, s)
        } else if (entry.kind === 'file') {
          s.scanned++
          const f = await entry.getFile()
          const name = f.name || entry.name || ''
          const file = name && name !== f.name ? new File([f], name, { type: f.type }) : f
          if (isSupportedLocalFile(file)) out.push(file)
          else s.skipped++
        }
      } catch {
        s.errors++
      }
    }
  } catch {
    s.errors++
  }
  return out
}
