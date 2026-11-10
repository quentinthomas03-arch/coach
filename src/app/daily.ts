import type { ISODate, MorningCheckin, PlannedSession, Wellness } from '../data/types'
import { db, getSetting, setSetting } from '../data/db'
import { addDays } from '../domain/dates'
import { coachMessages, type CoachMessage } from '../domain/coach'
import { computeReadiness, proposeAdjustment, type Readiness, type SessionProposal } from '../domain/readiness'
import type { LevelDecision } from '../domain/reprise'
import { tabacStatus, type TabacStatus } from '../domain/tabac'
import { getPlanConfig, getTabac, KEYS } from './config'
import { applyWeeklyReviews, endPause, regenerate } from './plan'
import { syncToWatch, type SyncResult } from './sync'
import { activitiesAwaitingRpe, importFromIntervals } from './importer'
import { nutritionDay } from './nutrition'
import { buildLoadEntries, loadStatus, type LoadStatus } from '../domain/load'
import type { Activity } from '../data/types'
import type { FragileZone } from '../domain/routines'
import { isPaused } from '../domain/pause'
import { detectOverload } from '../domain/overload'

/** Routine à l'ouverture de l'appli : bilan hebdo, recalcul, envoi montre. */
export async function dailyRefresh(today: ISODate): Promise<{ sync?: SyncResult }> {
  const cfg0 = await getPlanConfig()
  if (!cfg0) return {}
  // Pause arrivée à échéance : reprise automatique.
  if (cfg0.pause?.until && cfg0.pause.until < today) await endPause(today)
  // 1. Ce que j'ai fait (Garmin → Intervals.icu → appli), avant tout bilan.
  await importFromIntervals(today).catch(() => undefined)
  const decisions = await applyWeeklyReviews(today)
  // Les séances passées non faites sont marquées « non faites ».
  const stale = await db.sessions.where('date').below(today).filter((s) => s.status === 'planned' && s.kind !== 'repos').toArray()
  for (const s of stale) await db.sessions.update(s.id, { status: 'missed' })
  const cause = decisions.length ? `Bilan de la semaine : ${decisions[decisions.length - 1].reason}` : stale.length ? 'Séance(s) non faite(s)' : 'Mise à jour du plan'
  await regenerate(cause, today)
  const sync = await syncToWatch(today).catch(() => undefined)
  return { sync }
}

export interface TodayView {
  today: ISODate
  sessions: PlannedSession[]
  todaySessions: PlannedSession[]
  tomorrow: PlannedSession[]
  checkin?: MorningCheckin
  readiness?: Readiness
  proposals: SessionProposal[]
  messages: CoachMessage[]
  tabac?: TabacStatus
  tabacReasons: string[]
  awaitingRpe: Activity[]
  load: LoadStatus
  pause?: import('../domain/pause').Pause
}

export async function loadToday(today: ISODate): Promise<TodayView> {
  const cfg = await getPlanConfig()
  const from = addDays(today, -14)
  const [sessions, checkins, wellnessToday, wellness30] = await Promise.all([
    db.sessions.where('date').between(from, addDays(today, 14), true, true).toArray(),
    db.checkins.where('date').between(from, today, true, true).toArray(),
    db.wellness.get(today),
    db.wellness.where('date').between(addDays(today, -30), today, true, false).toArray(),
  ])
  const checkin = checkins.find((c) => c.date === today)
  const rhr = wellness30.map((w: Wellness) => w.restingHr).filter((x): x is number => x != null)
  const readiness = checkin ? computeReadiness(checkin, wellnessToday, rhr.length >= 5 ? rhr.reduce((a, b) => a + b, 0) / rhr.length : undefined) : undefined
  const todaySessions = sessions.filter((s) => s.date === today && s.status !== 'skipped').sort((a, b) => (a.kind === 'renfo' ? 1 : b.kind === 'renfo' ? -1 : 0))
  const dismissed = (await getSetting<string[]>(`${KEYS.dismissedProposal}.${today}`)) ?? []
  const proposals = readiness
    ? todaySessions
        .filter((s) => s.status === 'planned' && !dismissed.includes(s.id))
        .map((s) => proposeAdjustment(s, readiness))
        .filter((p) => p.change !== 'aucun')
    : []
  const tabacCfg = await getTabac()
  const logs = (await db.checkins.toArray()).filter((c) => c.cigarettes != null).map((c) => ({ date: addDays(c.date, -1), count: c.cigarettes! }))
  const tabac = tabacCfg ? tabacStatus(tabacCfg, logs, today) : undefined
  const last = await getSetting<{ at: ISODate; decisions: LevelDecision[] }>(KEYS.lastDecisions)
  const levelDecision = last && last.at >= addDays(today, -2) ? last.decisions[last.decisions.length - 1] : undefined
  const [acts, allSessions, feedback] = await Promise.all([
    db.activities.where('date').between(addDays(today, -35), today, true, true).toArray(),
    db.sessions.where('date').between(addDays(today, -35), today, true, true).toArray(),
    db.feedback.where('date').between(addDays(today, -35), today, true, true).toArray(),
  ])
  const load = loadStatus(buildLoadEntries(acts, allSessions, feedback), today)
  const yWater = await nutritionDay(addDays(today, -1))
  const waterYesterday = yWater.waterSource !== 'aucune' ? { ml: yWater.waterMl, target: yWater.hydration.ml } : undefined
  const fragileZones = ((await db.profile.get('me'))?.injuries ?? []) as FragileZone[]
  const notice = await getSetting<{ at: ISODate; messages: string[] }>(KEYS.notice)
  const paused = isPaused(cfg?.pause, today)
  const overload = detectOverload(checkins, today)
  const messages = cfg ? coachMessages({ overload, paused, notice: notice && notice.at >= addDays(today, -3) ? notice.messages : undefined, today, tone: cfg.tone, sessions, checkins, readiness, levelDecision, tabac, loadAlerts: load.alerts, waterYesterday, fragileZones }) : []
  return {
    today,
    sessions,
    todaySessions,
    tomorrow: sessions.filter((s) => s.date === addDays(today, 1) && s.status !== 'skipped'),
    checkin,
    readiness,
    proposals,
    messages,
    tabac,
    tabacReasons: tabacCfg?.reasons ?? [],
    awaitingRpe: await activitiesAwaitingRpe(today),
    load,
    pause: paused ? cfg?.pause : undefined,
  }
}

export async function dismissProposal(today: ISODate, sessionId: string) {
  const key = `${KEYS.dismissedProposal}.${today}`
  const list = (await getSetting<string[]>(key)) ?? []
  await setSetting(key, [...list, sessionId])
}

export async function addFragileZone(zone: FragileZone, today: ISODate) {
  const p = await db.profile.get('me')
  if (!p) return
  if (!p.injuries.includes(zone)) await db.profile.put({ ...p, injuries: [...p.injuries, zone], updatedAt: new Date().toISOString() })
  await regenerate('Zone fragile ajoutée : échauffement et renfo ciblés', today, db, { force: 'auto' })
}
