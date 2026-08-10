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
    const handle = await idbGet(db, KEY)
    // 验证句柄有效性
    if (!handle || typeof handle.requestPermission !== 'function') {
      return null
    }
    return handle
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
 * 优化：
 * - 减少 yield 频率（512 个条目）
 * - 合并文件信息获取（避免重复 getFile）
 * - 使用更高效的数据结构
 */
export async function scanDirectory(dirHandle, out = [], stats) {
  const s = stats || { scanned: 0, skipped: 0, errors: 0 }
  let seen = 0
  const YIELD_INTERVAL = 512 // 每 512 个条目让出主线程（优化：减少主线程阻塞次数）
  const BATCH_SIZE = 128 // 每批处理 128 个条目（优化：增大批次）

  // 批量获取文件信息，减少 await 次数
  const collectEntries = async (entries) => {
    const results = []
    for (const entry of entries) {
      if (entry.kind === 'directory') {
        if (/^Android(\/|$)/.test(entry.name)) {
          s.skipped++
          continue
        }
        // 递归扫描子目录
        const subFiles = []
        const subStats = { scanned: 0, skipped: 0, errors: 0 }
        await collectEntries(await entry.values()).then(async (subEntries) => {
          for (const subEntry of subEntries) {
            if (subEntry.kind === 'directory') {
              if (/^Android(\/|$)/.test(subEntry.name)) {
                s.skipped++
                continue
              }
              await scanDirectory(subEntry, out, s)
            } else {
              results.push(subEntry)
            }
          }
        })
        if (subEntries) {
          for (const subEntry of subEntries) {
            if (subEntry.kind === 'directory') {
              if (/^Android(\/|$)/.test(subEntry.name)) {
                s.skipped++
                continue
              }
              await scanDirectory(subEntry, out, s)
            } else {
              results.push(subEntry)
            }
          }
        }
      } else if (entry.kind === 'file') {
        results.push(entry)
      }
    }
    return results
  }

  // 使用迭代器批量处理，减少 await 开销
  const processBatch = async (entries) => {
    for (const entry of entries) {
      try {
        if (entry.kind === 'directory') {
          if (/^Android(\/|$)/.test(entry.name)) continue
          await scanDirectory(entry, out, s)
        } else if (entry.kind === 'file') {
          s.scanned++
          const f = await entry.getFile()
          // 优化：直接使用 entry.name，避免创建新的 File 对象（除非名称不同）
          if (isSupportedLocalFile(f)) {
            out.push(f)
          } else {
            s.skipped++
          }
        }
      } catch {
        s.errors++
      }
    }
  }

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
          // 优化：仅在名称不一致时创建新 File 对象
          const file = name && name !== f.name ? new File([f], name, { type: f.type }) : f
          if (isSupportedLocalFile(file)) out.push(file)
          else s.skipped++
        }
      } catch {
        s.errors++
      }

      // 每处理 YIELD_INTERVAL 个条目让出主线程
      if ((seen++ & (YIELD_INTERVAL - 1)) === YIELD_INTERVAL - 1) {
        await new Promise((r) => setTimeout(r, 0))
      }
    }
  } catch {
    s.errors++
  }
  return out
}
