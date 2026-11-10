import type { ISODate, MorningCheckin, PlannedSession, Wellness } from '../data/types'
import { db, getSetting, setSetting } from '../data/db'
import { addDays } from '../domain/dates'
import { coachMessages, type CoachMessage } from '../domain/coach'
import { computeReadiness, proposeAdjustment, type Readiness, type SessionProposal } from '../domain/readiness'
import type { LevelDecision } from '../domain/reprise'
import { tabacStatus, type TabacStatus } from '../domain/tabac'
import { getPlanConfig, getTabac, KEYS } from './config'
import { applyWeeklyReviews, regenerate } from './plan'
import { syncToWatch, type SyncResult } from './sync'

/** Routine à l'ouverture de l'appli : bilan hebdo, recalcul, envoi montre. */
export async function dailyRefresh(today: ISODate): Promise<{ sync?: SyncResult }> {
  if (!(await getPlanConfig())) return {}
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
  const messages = cfg ? coachMessages({ today, tone: cfg.tone, sessions, checkins, readiness, levelDecision, tabac }) : []
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
  }
}

export async function dismissProposal(today: ISODate, sessionId: string) {
  const key = `${KEYS.dismissedProposal}.${today}`
  const list = (await getSetting<string[]>(key)) ?? []
  await setSetting(key, [...list, sessionId])
}
