import type { ISODate, PlannedSession } from '../data/types'
import { db, getSetting, setSetting, type CoachDB } from '../data/db'
import { addDays, mondayOf } from '../domain/dates'
import { estimateFitness, type Performance } from '../domain/fitness'
import { assessGoal, type Goal, type GoalAssessment } from '../domain/goals'
import { deloadFlags, goalWeekTemplates, peakMinutesFor, phasesFor, taperWeeksFor, totalWeeks, weeklyMinutesPlan, type Phase } from '../domain/goalPlan'
import type { FormeSessionTemplate } from '../domain/forme'
import { buildLoadEntries } from '../domain/load'
import { estimateDurationSec, toIntervalsText, type Workout } from '../domain/workout'
import { getPlanConfig, KEYS, type PlanConfig } from './config'
import { addMySession, regenerate } from './plan'

/** Objectif actif enregistré (avec le point de départ du plan, fixé à son démarrage). */
export interface StoredGoal extends Goal {
  planStart?: ISODate
  startMinutes?: number
}

export const getGoal = (database: CoachDB = db) => getSetting<StoredGoal>(KEYS.goal, database)
export const getPerformances = async (database: CoachDB = db) => (await getSetting<Performance[]>(KEYS.perfs, database)) ?? []

export async function addPerformance(p: Omit<Performance, 'id'> & { id?: string }, database: CoachDB = db) {
  const list = await getPerformances(database)
  const id = p.id ?? `perf-${Date.now().toString(36)}`
  await setSetting(KEYS.perfs, [...list.filter((x) => x.id !== id), { ...p, id }], database)
}
export async function removePerformance(id: string, database: CoachDB = db) {
  await setSetting(KEYS.perfs, (await getPerformances(database)).filter((p) => p.id !== id), database)
}

/** Minutes de course par semaine, moyenne des 4 dernières semaines. */
export async function recentWeeklyMinutes(today: ISODate, database: CoachDB = db) {
  const from = addDays(today, -28)
  const [acts, sessions, fb] = await Promise.all([
    database.activities.where('date').between(from, today, true, true).toArray(),
    database.sessions.where('date').between(from, today, true, true).toArray(),
    database.feedback.where('date').between(from, today, true, true).toArray(),
  ])
  return buildLoadEntries(acts, sessions, fb).filter((e) => e.run).reduce((a, e) => a + e.minutes, 0) / 4
}

export async function assess(goal: Goal, today: ISODate, database: CoachDB = db): Promise<GoalAssessment> {
  const cfg = await getPlanConfig(database)
  const fitness = estimateFitness(await getPerformances(database), today)
  const canRun30 = (cfg?.mode ?? 'reprise') !== 'reprise'
  return assessGoal({ goal, today, fitness, recentWeeklyMin: await recentWeeklyMinutes(today, database), canRun30, repriseLevel: cfg?.repriseLevel ?? 1 })
}

export async function setGoal(goal: Goal, today: ISODate, database: CoachDB = db) {
  await setSetting(KEYS.goal, { ...goal } satisfies StoredGoal, database)
  return regenerate(`Nouvel objectif : ${goal.name ?? goal.type}`, today, database, { force: 'auto' })
}

export async function abandonGoal(today: ISODate, database: CoachDB = db) {
  await database.settings.delete(KEYS.goal)
  return regenerate('Objectif abandonné : retour en Forme continue', today, database, { force: 'auto' })
}

export interface GoalWeekInfo {
  phase: Phase
  weekIndex: number
  total: number
  templates: FormeSessionTemplate[]
}

/**
 * Séances objectif d'une semaine (ou undefined si pas d'objectif applicable :
 * reprise en cours, semaine hors plan…). Fixe le départ du plan au premier appel.
 */
export async function goalWeek(weekStart: ISODate, today: ISODate, cfg: PlanConfig, database: CoachDB = db): Promise<GoalWeekInfo | undefined> {
  const goal = await getGoal(database)
  if (!goal || (cfg.mode ?? 'reprise') === 'reprise' || goal.date < today) return undefined
  if (!goal.planStart) {
    goal.planStart = mondayOf(today)
    goal.startMinutes = Math.round(Math.max(cfg.formeBaseMinutes ?? 0, await recentWeeklyMinutes(today, database), 90))
    await setSetting(KEYS.goal, goal, database)
  }
  const n = totalWeeks(goal.planStart, goal.date)
  const idx = Math.round((new Date(weekStart).getTime() - new Date(mondayOf(goal.planStart)).getTime()) / (7 * 86400000))
  if (idx < 0 || idx >= n) return undefined
  const phases = phasesFor(n, taperWeeksFor(goal))
  const minutes = weeklyMinutesPlan(phases, goal.startMinutes ?? 110, peakMinutesFor(goal))
  const deload = deloadFlags(phases)
  const phase = phases[idx]
  const fitness = estimateFitness(await getPerformances(database), today)
  return {
    phase,
    weekIndex: idx,
    total: n,
    templates: goalWeekTemplates({ goal, phase, weekInPhase: idx - phases.indexOf(phase), minutes: minutes[idx], runs: cfg.runsPerWeek, vdot: fitness.vdot, deload: deload[idx] }),
  }
}

/* ---------- Test de calibration ---------- */

export const TEST_TITLE = 'Test 30 min'

export function calibrationWorkout(): Workout {
  return {
    blocks: [
      { role: 'warmup', steps: [{ label: 'Échauffement progressif', durationSec: 15 * 60, target: { kind: 'hrZone', zone: 2 } }] },
      { role: 'main', steps: [{ label: 'Test 30 min le plus loin possible, allure régulière', durationSec: 30 * 60 }] },
      { role: 'cooldown', steps: [{ label: 'Retour au calme', durationSec: 10 * 60, target: { kind: 'hrZone', zone: 1 } }] },
    ],
  }
}

export async function scheduleCalibrationTest(date: ISODate, today: ISODate, database: CoachDB = db) {
  const w = calibrationWorkout()
  return addMySession(
    {
      date,
      kind: 'test',
      title: TEST_TITLE,
      durationMin: Math.round(estimateDurationSec(w) / 60),
      workout: w,
      workoutText: toIntervalsText(w),
      key: true,
      reasons: [
        'Test de calibration : 15 min d’échauffement, puis 30 min le plus loin possible à allure régulière (sur terrain plat), puis 10 min de retour au calme.',
        'Ta distance en 30 min permet de calculer tes vraies allures et de prédire tes chronos.',
        'À faire reposé, pas le lendemain d’une grosse séance.',
      ],
    },
    today,
    database,
  )
}

/** Tests et courses objectif faits dont le résultat n'est pas encore saisi. */
export async function resultsAwaited(today: ISODate, database: CoachDB = db): Promise<PlannedSession[]> {
  const perfs = await getPerformances(database)
  const done = await database.sessions.where('date').between(addDays(today, -7), today, true, true).filter((s) => s.kind === 'test' && s.status === 'done').toArray()
  return done.filter((s) => !perfs.some((p) => p.id === `perf-${s.id}`))
}

export async function saveTestResult(session: PlannedSession, result: { distanceM: number; timeSec: number }, today: ISODate, database: CoachDB = db) {
  await addPerformance(
    { id: `perf-${session.id}`, date: session.date, distanceM: result.distanceM, timeSec: result.timeSec, source: session.title === TEST_TITLE ? 'test' : 'course', label: session.title },
    database,
  )
  await regenerate('Nouvelle performance : allures recalculées', today, database)
}
