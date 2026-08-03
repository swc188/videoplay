import { el } from '../utils.js'
import { savePrefs } from './prefs.js'

export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3]

export const menuMethods = {
  openMenu(type) {
    this.menu.innerHTML = ''
    this.menu.classList.add('open')

    if (type === 'speed') {
      this.menu.append(el('div', { class: 'menu-title' }, '播放速度'))
      SPEEDS.forEach((s) => {
        const active = Math.abs(this.player.rate - s) < 0.01
        const item = el('button', { class: `menu-item${active ? ' toggled' : ''}`, type: 'button' }, [
          el('span', null, `${s}x`),
          el('span', { class: 'value' }, active ? el('span', { class: 'check' }, '✓') : ''),
        ])
        item.addEventListener('click', () => {
          this.player.setRate(s)
          this.prefs.rate = s
          savePrefs(this.prefs)
          this.menu.classList.remove('open')
        })
        this.menu.append(item)
      })
      const qItem = el('button', { class: 'menu-item', type: 'button' }, [el('span', null, '清晰度'), el('span', { class: 'value' }, '')])
      qItem.addEventListener('click', () => this.openMenu('quality'))
      this.menu.append(qItem)
    } else if (type === 'subtitle') {
      this.menu.append(el('div', { class: 'menu-title' }, '字幕'))
      const on = this.subtitle.enabled
      const offItem = el('button', { class: `menu-item${!on ? ' toggled' : ''}`, type: 'button' }, [
        el('span', null, '关闭字幕'),
        el('span', { class: 'value' }, !on ? el('span', { class: 'check' }, '✓') : ''),
      ])
      offItem.addEventListener('click', () => { this.subtitle.setEnabled(false); this.btnSub.classList.remove('active'); this.menu.classList.remove('open') })
      this.menu.append(offItem)
      this.menu.append(el('div', { class: 'menu-title' }, '字幕大小'))
      ;[['small', '小'], ['normal', '中'], ['large', '大']].forEach(([val, label]) => {
        const item = el('button', { class: 'menu-item', type: 'button' }, [el('span', null, label), el('span', { class: 'value' }, '')])
        item.addEventListener('click', () => {
          this.subtitle.setSize(val)
          this.prefs.subSize = val
          savePrefs(this.prefs)
          this.menu.classList.remove('open')
        })
        this.menu.append(item)
      })
      const loadBtn = el('button', { class: 'menu-item', type: 'button' }, [el('span', null, '加载字幕文件 (.srt / .vtt)'), el('span', { class: 'value' }, '')])
      loadBtn.addEventListener('click', () => { this.menu.classList.remove('open'); this.subInput.click() })
      this.menu.append(loadBtn)
      if (this.subtitle.cues.length) {
        const delBtn = el('button', { class: 'menu-item', type: 'button' }, [el('span', null, '移除字幕'), el('span', { class: 'value' }, '')])
        delBtn.addEventListener('click', () => {
          this.subtitle.clear()
          this.btnSub.classList.remove('active')
          this.menu.classList.remove('open')
        })
        this.menu.append(delBtn)
      }
    } else if (type === 'quality') {
      const hls = this.player.engine
      this.menu.append(el('div', { class: 'menu-title' }, '清晰度'))
      if (hls && hls.levels && hls.levels.length) {
        const opts = [{ label: '自动', idx: -1 }].concat(hls.levels.map((l, i) => ({
          label: `${l.height}p${l.bitrate ? ` (${(l.bitrate / 1e6).toFixed(1)}M)` : ''}`,
          idx: i,
        })))
        opts.forEach((o) => {
          const active = hls.currentLevel === o.idx
          const item = el('button', { class: `menu-item${active ? ' toggled' : ''}`, type: 'button' }, [
            el('span', null, o.label),
            el('span', { class: 'value' }, active ? el('span', { class: 'check' }, '✓') : ''),
          ])
          item.addEventListener('click', () => {
            hls.currentLevel = o.idx
            this.menu.classList.remove('open')
          })
          this.menu.append(item)
        })
      } else {
        this.menu.append(el('div', { class: 'menu-item', style: 'cursor:default' }, [el('span', null, '当前媒体无清晰度选项')]))
      }
    }
  },
}
