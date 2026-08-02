import { isMediaFile } from '../utils.js'

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
 * 读取已持久化的本地视频目录句柄（无则返回 null）
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
 * 持久化用户授权的目录句柄，供下次打开程序时自动恢复
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
 * 递归扫描目录（含所有子目录），收集播放器支持的全部媒体文件
 */
export async function scanDirectory(dirHandle, out = []) {
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'directory') {
      await scanDirectory(entry, out)
    } else if (entry.kind === 'file') {
      const f = await entry.getFile()
      if (isMediaFile(f)) out.push(f)
    }
  }
  return out
}
