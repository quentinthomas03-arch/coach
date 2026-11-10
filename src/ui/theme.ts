import { db, getSetting, setSetting, SETTING } from '../data/db'

export type Piste = 'a' | 'b'

export function applyPiste(p: Piste) {
  document.documentElement.dataset.piste = p
  const meta = document.querySelector('meta[name="theme-color"]')
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().split(/\s+/).join(',')
  if (meta && bg) meta.setAttribute('content', `rgb(${bg})`)
}

export async function loadPiste(): Promise<Piste> {
  const p = (await getSetting<Piste>(SETTING.piste, db)) ?? 'a'
  applyPiste(p)
  return p
}

export async function savePiste(p: Piste) {
  applyPiste(p)
  await setSetting(SETTING.piste, p)
}
