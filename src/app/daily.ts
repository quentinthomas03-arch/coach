import type { ISODate, MorningCheckin, PlannedSession, Wellness } from '../data/types'
import { db, getSetting, setSetting } from '../data/db'
import { addDays } from '../domain/dates'
import { coachMessages, type CoachMessage } from '../domain/coach'
import { computeReadiness, proposeAdjustment, type Readiness, type SessionProposal } from '../domain/readiness'
import type { LevelDecision } from '../domain/reprise'
import { tabacStatus, type TabacStatus } from '../domain/tabac'
import { getPlanConfig, getTabac, KEYS } from './config'
import { applyWeeklyReviews, dailyStale, endPause, regenerate } from './plan'
import { syncToWatch, type SyncResult } from './sync'
import { activitiesAwaitingRpe, importFromIntervals } from './importer'
import { nutritionDay } from './nutrition'
import { buildLoadEntries, loadStatus, type LoadStatus } from '../domain/load'
import type { Activity } from '../data/types'
import type { FragileZone } from '../domain/routines'
import { isPaused } from '../domain/pause'
import { detectOverload } from '../domain/overload'
import { analyzeNote } from '../domain/notes'
import { estimateFitness, hrMaxOf, type Performance } from '../domain/fitness'
import { fitnessSeries, recoveryLeft, trainingStatus, type FitnessPoint, type TrainingStatus } from '../domain/fitnessModel'
import { analyzeRun } from '../domain/runAnalysis'
import { RUN_TYPES } from '../domain/activities'
import { regularStreak } from '../domain/streak'
import { mondayOf } from '../domain/dates'
import { avgSleep, bedtime } from '../domain/sleep'

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
  const stale = await dailyStale(today)
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
  status: TrainingStatus
  recoveryLeftH: number
  streak: number
  week: { done: number; planned: number }
  sleepLastNight?: number
  series: FitnessPoint[]
  /** Heure de coucher conseillée ce soir (si séance clé demain ou sommeil court). */
  bedtimeTonight?: { time: string; why: string }
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
  // Charge, condition, récupération (calculées une fois pour la forme du jour et le coach).
  const [acts70, sess70, fb70] = await Promise.all([
    db.activities.where('date').between(addDays(today, -70), today, true, true).toArray(),
    db.sessions.where('date').between(addDays(today, -70), today, true, true).toArray(),
    db.feedback.where('date').between(addDays(today, -70), today, true, true).toArray(),
  ])
  const entries70 = buildLoadEntries(acts70, sess70, fb70)
  const series = fitnessSeries(entries70, addDays(today, -56), today)
  const status = trainingStatus(series, entries70, today)
  const recoveryLeftH = recoveryLeft(
    entries70.filter((e) => e.date >= addDays(today, -3) && e.date <= today).map((e) => ({ endAt: new Date(`${e.date}T18:30:00`), minutes: e.minutes, rpe: e.rpe })),
    new Date(),
  )
  const sleeps = wellness30.filter((w) => w.date < today && w.date >= addDays(today, -14)).map((w) => w.sleepHours).filter((x): x is number => x != null)
  const sleepBaseline = sleeps.length >= 5 ? sleeps.reduce((a, b) => a + b, 0) / sleeps.length : undefined
  const readiness = checkin
    ? computeReadiness(checkin, wellnessToday, rhr.length >= 5 ? rhr.reduce((a, b) => a + b, 0) / rhr.length : undefined, { sleepBaseline, recoveryLeftH })
    : undefined
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
  const notes = await db.notes.where('date').between(addDays(today, -5), today, true, true).toArray()
  const noteInsights = notes.flatMap(analyzeNote)
  const sleepAvg = avgSleep((await db.wellness.where('date').between(addDays(today, -6), today, true, true).toArray()).map((w) => w.sleepHours))
  const profile = await db.profile.get('me')
  const noPaceRef = estimateFitness((await getSetting<Performance[]>(KEYS.perfs)) ?? [], today).confidence === 'inconnue'
  const profileUnchecked = !!profile && profile.heightCm === 170 && profile.weightKg === 70 && profile.birthYear === 1990
  const prof = await db.profile.get('me')
  const hrMax = hrMaxOf(prof?.hrMax, prof ? new Date(today).getFullYear() - prof.birthYear : 35)
  const runAnalyses = acts70
    .filter((a) => a.date >= addDays(today, -2) && RUN_TYPES.has(a.type))
    .map((a) => {
      const s = sess70.find((x) => x.id === a.matchedSessionId)
      return { ...analyzeRun(a, s, hrMax), sessionId: s?.id, title: s?.title }
    })
    .filter((r) => !sess70.find((x) => x.id === r.sessionId)?.paceFeedback)
  const messages = cfg ? coachMessages({ runAnalyses, trainingStatus: status, noPaceRef, profileUnchecked, noteInsights, sleepAvg, overload, paused, notice: notice && notice.at >= addDays(today, -3) ? notice.messages : undefined, today, tone: cfg.tone, sessions, checkins, readiness, levelDecision, tabac, loadAlerts: load.alerts, waterYesterday, fragileZones }) : []
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
    status,
    recoveryLeftH,
    streak: regularStreak(await db.sessions.where('date').between(addDays(today, -7 * 53), today, true, true).toArray(), today),
    week: (() => {
      const ws = mondayOf(today)
      const wk = sessions.filter((s) => s.date >= ws && s.date < addDays(ws, 7) && s.kind !== 'repos' && s.status !== 'skipped')
      return { done: wk.filter((s) => s.status === 'done').length, planned: wk.length }
    })(),
    sleepLastNight: wellnessToday?.sleepHours,
    series,
    bedtimeTonight: (() => {
      const tomorrowKey = sessions.find((s) => s.date === addDays(today, 1) && s.key && s.status === 'planned')
      if (!tomorrowKey && !(sleepAvg != null && sleepAvg < 6.5)) return undefined
      return {
        time: bedtime(cfg?.wakeTime ?? '07:00', !!tomorrowKey),
        why: tomorrowKey ? `${tomorrowKey.title.toLowerCase()} demain` : 'tes nuits sont courtes cette semaine',
      }
    })(),
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
