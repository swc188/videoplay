const LS_PREFS = 'uvp:prefs'

export function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(LS_PREFS) || '{}') } catch { return {} }
}

export function savePrefs(p) {
  try { localStorage.setItem(LS_PREFS, JSON.stringify(p)) } catch {}
}
