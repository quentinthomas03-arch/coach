import type { Activity, ISODate, PlannedSession, SessionFeedback } from '../data/types'
import { addDays, mondayOf } from './dates'
import { RUN_TYPES } from './activities'

/**
 * CHARGE D'ENTRAÎNEMENT ET GARDE-FOUS.
 *
 * Charge d'une séance = durée (min) × effort ressenti (1-10) — méthode « session-RPE » (Foster).
 * Sans effort saisi, on utilise un effort par défaut selon le type de séance.
 *
 * Garde-fous (repères documentés, pas des promesses) :
 * - Ratio charge aiguë / chronique (7 derniers jours vs moyenne hebdo des 28 derniers) :
 *   au-delà de 1,5, le risque de blessure augmente nettement dans les études → alerte.
 * - Volume de course de la semaine > +15 % par rapport à la précédente → alerte « tu montes trop vite ».
 * Ces alertes ne s'appliquent que si l'historique est suffisant (sinon elles n'ont pas de sens).
 */

export const ACWR_ALERT = 1.5
export const VOLUME_JUMP_ALERT = 0.15
const DEFAULT_RPE: Record<string, number> = {
  'marche-course': 3, endurance: 3, controle: 3, recuperation: 2, 'sortie-longue': 4, fractionne: 6, seuil: 6, cotes: 6, test: 8, renfo: 5,
}

export interface LoadEntry {
  date: ISODate
  minutes: number
  rpe: number
  load: number
  run: boolean
  km?: number
  source: 'activite' | 'manuel'
}

/**
 * Construit la liste des séances réellement faites :
 * - chaque activité Intervals.icu (avec son effort si saisi, sinon celui du retour ou par défaut) ;
 * - chaque séance marquée « faite » à la main sans activité rapprochée (durée prévue).
 */
export function buildLoadEntries(activities: Activity[], sessions: PlannedSession[], feedback: SessionFeedback[]): LoadEntry[] {
  const out: LoadEntry[] = []
  const matched = new Set(activities.map((a) => a.matchedSessionId).filter(Boolean))
  for (const a of activities) {
    const s = sessions.find((x) => x.id === a.matchedSessionId)
    const fb = feedback.find((f) => f.activityId === a.id || (s && f.sessionId === s.id))
    const run = RUN_TYPES.has(a.type)
    const rpe = fb?.rpe ?? a.rpe ?? (s ? DEFAULT_RPE[s.kind] : run ? 3 : 4)
    const minutes = Math.round(a.durationSec / 60)
    out.push({ date: a.date, minutes, rpe, load: minutes * rpe, run, km: a.distanceM ? a.distanceM / 1000 : undefined, source: 'activite' })
  }
  for (const s of sessions) {
    if (s.status !== 'done' || matched.has(s.id)) continue
    const fb = feedback.find((f) => f.sessionId === s.id)
    const rpe = fb?.rpe ?? DEFAULT_RPE[s.kind] ?? 3
    out.push({ date: s.date, minutes: s.durationMin, rpe, load: s.durationMin * rpe, run: s.kind !== 'renfo', source: 'manuel' })
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1))
}

export interface WeekLoad {
  weekStart: ISODate
  load: number
  runMinutes: number
  runKm: number
  strengthSessions: number
  sessions: number
}

export function weeklyLoads(entries: LoadEntry[], lastWeekStart: ISODate, weeks: number): WeekLoad[] {
  const out: WeekLoad[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(lastWeekStart, -7 * i)
    const we = addDays(ws, 7)
    const e = entries.filter((x) => x.date >= ws && x.date < we)
    out.push({
      weekStart: ws,
      load: e.reduce((a, x) => a + x.load, 0),
      runMinutes: e.filter((x) => x.run).reduce((a, x) => a + x.minutes, 0),
      runKm: Math.round(e.filter((x) => x.run).reduce((a, x) => a + (x.km ?? 0), 0) * 10) / 10,
      strengthSessions: e.filter((x) => !x.run).length,
      sessions: e.length,
    })
  }
  return out
}

export interface LoadStatus {
  acute: number
  chronicWeekly: number
  ratio?: number
  thisWeekRunMin: number
  lastWeekRunMin: number
  alerts: { rule: 'acwr' | 'volume'; text: string }[]
}

export function loadStatus(entries: LoadEntry[], today: ISODate): LoadStatus {
  const sum = (from: ISODate, to: ISODate, f: (e: LoadEntry) => number) => entries.filter((e) => e.date >= from && e.date < to).reduce((a, e) => a + f(e), 0)
  const tomorrow = addDays(today, 1)
  const acute = sum(addDays(today, -6), tomorrow, (e) => e.load)
  const chronicWeekly = sum(addDays(today, -27), tomorrow, (e) => e.load) / 4
  const firstDate = entries.reduce<string | undefined>((m, e) => (!m || e.date < m ? e.date : m), undefined)
  const enoughHistory = !!firstDate && firstDate <= addDays(today, -21) && chronicWeekly > 0
  const ratio = enoughHistory ? Math.round((acute / chronicWeekly) * 100) / 100 : undefined
  const ws = mondayOf(today)
  const thisWeekRunMin = sum(ws, addDays(ws, 7), (e) => (e.run ? e.minutes : 0))
  const lastWeekRunMin = sum(addDays(ws, -7), ws, (e) => (e.run ? e.minutes : 0))
  const alerts: LoadStatus['alerts'] = []
  if (ratio != null && ratio > ACWR_ALERT) {
    alerts.push({ rule: 'acwr', text: `Charge des 7 derniers jours ${ratio.toFixed(1).replace('.', ',')} fois supérieure à ta moyenne : risque de blessure accru, lève le pied quelques jours.` })
  }
  if (lastWeekRunMin >= 60 && thisWeekRunMin > lastWeekRunMin * (1 + VOLUME_JUMP_ALERT)) {
    const pct = Math.round((thisWeekRunMin / lastWeekRunMin - 1) * 100)
    alerts.push({ rule: 'volume', text: `Volume de course déjà +${pct} % par rapport à la semaine dernière (${thisWeekRunMin} vs ${lastWeekRunMin} min) : tu montes trop vite.` })
  }
  return { acute, chronicWeekly: Math.round(chronicWeekly), ratio, thisWeekRunMin, lastWeekRunMin, alerts }
}
