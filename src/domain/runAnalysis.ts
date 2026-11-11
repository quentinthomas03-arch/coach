import type { Activity, PlannedSession } from '../data/types'
import { formatPace, type Target } from './workout'

/**
 * ANALYSE AUTOMATIQUE D'UNE SORTIE (comme les applis de coaching).
 * Compare ce que la montre a enregistré à ce qui était demandé :
 * - séance facile en continu : allure moyenne vs fourchette « course facile » ;
 * - marche-course (l'allure moyenne mélange marche et course) : FC moyenne vs 85 % de la FC max ;
 * - durée faite vs durée prévue.
 * Courir trop vite les séances faciles est l'erreur la plus fréquente : le coach le signale.
 */

export type RunVerdict = 'dans-la-cible' | 'trop-vite' | 'trop-lent' | 'trop-intense' | 'inconnu'

export interface RunAnalysis {
  activityId: string
  date: string
  paceSecPerKm?: number
  km?: number
  minutes: number
  avgHr?: number
  verdict: RunVerdict
  /** Phrase du coach. */
  text: string
  /** Proposition de correction d'allure qui en découle. */
  suggest?: 'trop-lent' | 'trop-rapide'
}

/** Fourchette « course facile » de la séance prévue (étape principale avec une cible d'allure). */
export function easyTarget(s?: PlannedSession): [number, number] | undefined {
  const main = s?.workout?.blocks.find((b) => b.role === 'main')
  const step = main?.steps.find((x) => x.target?.kind === 'pace' && !/marche|récup|trot/i.test(x.label ?? ''))
  const t = step?.target as Extract<Target, { kind: 'pace' }> | undefined
  return t ? [t.fastSecPerKm, t.slowSecPerKm] : undefined
}

const fmt = (s: number) => `${formatPace(s)}/km`

export function analyzeRun(a: Activity, s: PlannedSession | undefined, hrMax: number): RunAnalysis {
  const minutes = Math.round(a.durationSec / 60)
  const km = a.distanceM ? a.distanceM / 1000 : undefined
  const pace = km && km > 0.5 ? a.durationSec / km : undefined
  const base = { activityId: a.id, date: a.date, paceSecPerKm: pace, km, minutes, avgHr: a.avgHr }
  const easySession = !!s && ['endurance', 'sortie-longue', 'recuperation'].includes(s.kind)
  const walkRun = s?.kind === 'marche-course'
  const target = easyTarget(s)
  const hrPct = a.avgHr ? a.avgHr / hrMax : undefined
  const durNote = s && s.durationMin && minutes < s.durationMin * 0.7 ? ` Séance écourtée (${minutes} min sur ${s.durationMin} prévues) : pas grave, la régularité compte plus.` : ''

  if (easySession && pace && target) {
    if (pace < target[0] - 15) {
      const d = Math.round(target[0] - pace)
      return { ...base, verdict: 'trop-vite', suggest: undefined, text: `${fmt(pace)} de moyenne : ${d} s/km plus vite que ta fourchette facile (${fmt(target[0])}–${fmt(target[1])}). En endurance, ralentir te fera progresser plus vite et sans te blesser.${durNote}` }
    }
    if (pace > target[1] + 30 && (hrPct ?? 0) < 0.75) {
      return { ...base, verdict: 'trop-lent', suggest: 'trop-lent', text: `${fmt(pace)} de moyenne, plus lent que ta fourchette, avec une FC basse : la fourchette est peut-être trop prudente. Dis-le-moi si c’était trop facile.${durNote}` }
    }
    return { ...base, verdict: 'dans-la-cible', text: `${fmt(pace)} de moyenne, dans ta fourchette facile (${fmt(target[0])}–${fmt(target[1])}). Parfait.${durNote}` }
  }
  if ((walkRun || easySession) && hrPct) {
    if (hrPct >= 0.85) {
      return { ...base, verdict: 'trop-intense', suggest: 'trop-rapide', text: `FC moyenne ${a.avgHr} (${Math.round(hrPct * 100)} % de ta FC max) : trop intense pour une séance facile. Cours plus lentement, tu dois pouvoir parler.${durNote}` }
    }
    return { ...base, verdict: 'dans-la-cible', text: `FC moyenne ${a.avgHr} (${Math.round(hrPct * 100)} % de ta FC max) : intensité bien maîtrisée.${durNote}` }
  }
  return { ...base, verdict: 'inconnu', text: `${km ? `${km.toFixed(1).replace('.', ',')} km` : ''}${pace ? ` à ${fmt(pace)}` : ''} en ${minutes} min.${durNote}`.trim() }
}
