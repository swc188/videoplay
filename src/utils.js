export const el = (tag, props = {}, children = []) => {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') node.className = v
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v)
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v)
    else if (k === 'html') node.innerHTML = v
    else if (v !== null && v !== undefined) node.setAttribute(k, v)
  }
  for (const c of [].concat(children)) {
    if (c == null) continue
    node.append(c instanceof Node ? c : document.createTextNode(String(c)))
  }
  return node
}

export const fmtTime = (s) => {
  if (!Number.isFinite(s) || s < 0) s = 0
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

export const fmtBytes = (n) => {
  if (!Number.isFinite(n)) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(n >= 100 ? 0 : 1)} ${units[i]}`
}

let toastWrap
export function toast(msg, type = '') {
  if (!toastWrap) {
    toastWrap = el('div', { class: 'toast-wrap' })
    document.body.append(toastWrap)
  }
  const t = el('div', { class: `toast ${type}` }, msg)
  toastWrap.append(t)
  setTimeout(() => {
    t.classList.add('hide')
    setTimeout(() => t.remove(), 300)
  }, 2800)
}

const ICON_PATHS = {
  play: '<polygon points="6,3 21,12 6,21" fill="currentColor"/>',
  pause: '<rect x="5" y="4" width="5" height="16" rx="1.5" fill="currentColor"/><rect x="14" y="4" width="5" height="16" rx="1.5" fill="currentColor"/>',
  forward: '<path d="M4 5v14l8-7z" fill="currentColor"/><path d="M13 5v14l8-7z" fill="currentColor"/>',
  rewind: '<path d="M21 5v14l-8-7z" fill="currentColor"/><path d="M12 5v14l-8-7z" fill="currentColor"/>',
  volume: '<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/>',
  volumeMute: '<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M17 9l5 5m0-5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  fullscreen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  fullscreenExit: '<path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  folder: '<path d="M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" fill="currentColor"/>',
  link: '<path d="M10 14a5 5 0 007.07 0l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 10a5 5 0 00-7.07 0l-3 3a5 5 0 007.07 7.07l1.71-1.71" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  list: '<rect x="4" y="5" width="16" height="3" rx="1.5" fill="currentColor"/><rect x="4" y="10.5" width="16" height="3" rx="1.5" fill="currentColor"/><rect x="4" y="16" width="16" height="3" rx="1.5" fill="currentColor"/>',
  camera: '<rect x="3" y="6" width="13" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 10l5-3v10l-5-3z" fill="currentColor"/>',
  pip: '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="12" y="13" width="6" height="4" rx="1" fill="currentColor"/>',
  zoomIn: '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8.5 10.5h4M10.5 8.5v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  zoomOut: '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8.5 10.5h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  gear: '<path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" fill="currentColor"/><path d="M19.4 13a7.6 7.6 0 000-2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 00-1.8-1L15 3.4h-4l-.3 2.7c-.7.3-1.3.6-1.8 1l-2.3-1-2 3.4L6.6 11a7.6 7.6 0 000 2l-2 1.5 2 3.4 2.3-1c.5.4 1.1.7 1.8 1l.3 2.7h4l.3-2.7c.7-.3 1.3-.6 1.8-1l2.3 1 2-3.4-2-1.5z" fill="currentColor"/>',
  repeat: '<path d="M17 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 11V9a4 4 0 014-4h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 22l-4-4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 13v2a4 4 0 01-4 4H3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  subtitle: '<rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 14h4M13 14h4M7 10.5h2M13 10.5h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  trash: '<path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m3 0l-.8 12a2 2 0 01-2 1.9H8.8a2 2 0 01-2-1.9L6 7h12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  drag: '<path d="M9 5h2v2H9V5zm4 0h2v2h-2V5zM9 9h2v2H9V9zm4 0h2v2h-2V9zM9 13h2v2H9v-2zm4 0h2v2h-2v-2zM9 17h2v2H9v-2zm4 0h2v2h-2v-2z" fill="currentColor"/>',
  brand: '<rect x="3" y="4" width="18" height="16" rx="4" fill="url(#g)"/><polygon points="10,8 17,12 10,16" fill="#fff"/>',
  check: '<path d="M4 12l5 5L20 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  save: '<path d="M5 3h11l3 3v15H5V3zm6 6v8m0-8l-3 3m3-3l3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  cc: '<path d="M3 6h18v12H3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 10.5c-.6-.6-1.8-.6-2.4 0-.8.8-.8 2.2 0 3 .6.6 1.8.6 2.4 0M14.5 10.5c-.6-.6-1.8-.6-2.4 0-.8.8-.8 2.2 0 3 .6.6 1.8.6 2.4 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8h.01M12 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  prev: '<polygon points="5,4 15,12 5,20" fill="currentColor"/><rect x="3" y="4" width="2" height="16" rx="1" fill="currentColor"/>',
  next: '<polygon points="19,4 9,12 19,20" fill="currentColor"/><rect x="19" y="4" width="2" height="16" rx="1" fill="currentColor"/>',
}

export const icon = (name, size = 20) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', size)
  svg.setAttribute('height', size)
  svg.setAttribute('fill', 'none')
  svg.innerHTML = ICON_PATHS[name] || ''
  if (name === 'brand') {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    defs.innerHTML = '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4d4f"/><stop offset="1" stop-color="#ff7a45"/></linearGradient>'
    svg.prepend(defs)
  }
  return svg
}

export const debounce = (fn, ms) => {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

export const extname = (name = '') => {
  const clean = name.split('?')[0].split('#')[0]
  const m = clean.match(/\.([a-z0-9]{1,8})$/i)
  return m ? m[1].toLowerCase() : ''
}

export const baseName = (url = '') => {
  try {
    const u = new URL(url)
    return decodeURIComponent(u.pathname.split('/').pop() || u.hostname)
  } catch {
    return url
  }
}

export const uid = () => Math.random().toString(36).slice(2, 10)
