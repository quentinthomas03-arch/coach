import type { ISODate, PlannedSession, PlanVersion } from '../data/types'
import { db, getSetting, setSetting, type CoachDB } from '../data/db'
import { addDays, daysBetween, mondayOf } from '../domain/dates'
import { diffSessions } from '../domain/changes'
import { planWeek } from '../domain/planner'
import { nextLevel, nextStrengthLevel, reviewWeek } from '../domain/progression'
import { nextBaseMinutes } from '../domain/forme'
import type { FragileZone } from '../domain/routines'
import { isPaused, resumeAfterPause, type Pause } from '../domain/pause'
import { ENGINE_CHANGELOG, ENGINE_VERSION, explainChanges, type PlanInputs } from '../domain/planInputs'
import { estimateFitness, type Performance } from '../domain/fitness'
import { sessionPaces } from '../domain/sessionPaces'
import { detectOverload, OVERLOAD_DAYS, OVERLOAD_VOLUME_FACTOR } from '../domain/overload'
import type { LevelDecision } from '../domain/reprise'
import { getAvailability, getEquipment, getPlanConfig, KEYS, savePlanConfig } from './config'
import { goalWeek } from './goals'

/**
 * Service du plan : relie le moteur (fonctions pures) aux données du téléphone.
 *
 * - `regenerate` recalcule la semaine en cours et la suivante (horizon ≥ 7 jours).
 * - Chaque recalcul qui change quelque chose crée une version (avant/après + résumé)
 *   qu'on peut annuler. En mode « valider », la version reste en attente de mon accord.
 * - Les séances verrouillées, faites ou passées ne sont jamais modifiées.
 */

const INPUTS_KEY = 'plan.inputs'

export const RUN_KINDS = new Set(['endurance', 'marche-course', 'seuil', 'fractionne', 'sortie-longue', 'cotes', 'recuperation', 'test'])
export const isRunSession = (s: PlannedSession) => RUN_KINDS.has(s.kind)

export function weekIndexOf(startDate: ISODate, weekStart: ISODate) {
  return Math.max(0, Math.floor(daysBetween(mondayOf(startDate), weekStart) / 7))
}

/** Conserve l'état d'envoi d'une séance inchangée. */
function mergeSync(next: PlannedSession, prev?: PlannedSession): PlannedSession {
  if (!prev) return next
  const same = prev.date === next.date && prev.kind === next.kind && (prev.workoutText ?? '') === (next.workoutText ?? '')
  return {
    ...next,
    status: prev.status === 'done' ? 'done' : next.status,
    sync: same ? prev.sync : { ...prev.sync, status: prev.sync.status === 'sent' ? 'outdated' : prev.sync.status },
  }
}

/** Applique le bilan des semaines terminées (montée/maintien/baisse de niveau). */
export async function applyWeeklyReviews(today: ISODate, database: CoachDB = db): Promise<LevelDecision[]> {
  const cfg = await getPlanConfig(database)
  if (!cfg) return []
  const currentWeek = mondayOf(today)
  const firstWeek = mondayOf(cfg.startDate)
  let week = cfg.lastReviewedWeek ? addDays(cfg.lastReviewedWeek, 7) : firstWeek
  const decisions: LevelDecision[] = []
  const [sessions, feedback, checkins] = await Promise.all([database.sessions.toArray(), database.feedback.toArray(), database.checkins.toArray()])
  let { repriseLevel, strengthLevel, mode = 'reprise', formeBaseMinutes } = cfg
  let prevStrength
  while (week < currentWeek) {
    const run = reviewWeek(week, sessions, feedback, checkins, 'course')
    const str = reviewWeek(week, sessions, feedback, checkins, 'renfo')
    if (run.planned > 0 && mode === 'reprise') {
      const d = nextLevel(repriseLevel, run)
      repriseLevel = d.level
      decisions.push(d)
      if (d.completed) {
        // Passage en Forme continue : on part du volume de course de cette dernière semaine.
        const end = addDays(week, 7)
        mode = 'forme'
        formeBaseMinutes = Math.max(90, sessions.filter((s) => s.date >= week && s.date < end && isRunSession(s)).reduce((a, s) => a + s.durationMin, 0))
      }
    } else if (run.planned > 0 && mode === 'forme') {
      const { days } = await getAvailability(addDays(week, 7), database)
      const maxAvail = days.filter((d) => d.available).map((d) => d.maxMinutes).sort((a, b) => b - a).slice(0, cfg.runsPerWeek).reduce((a, b) => a + b, 0)
      const n = nextBaseMinutes(formeBaseMinutes ?? 120, run, weekIndexOf(cfg.startDate, week), maxAvail)
      decisions.push({ level: repriseLevel, change: n.minutes > (formeBaseMinutes ?? 120) ? 'monte' : n.minutes < (formeBaseMinutes ?? 120) ? 'baisse' : 'stable', reason: n.reason })
      formeBaseMinutes = n.minutes
    }
    if (str.planned > 0) {
      strengthLevel = nextStrengthLevel(strengthLevel, str, prevStrength).level
    }
    prevStrength = str
    cfg.lastReviewedWeek = week
    week = addDays(week, 7)
  }
  if (decisions.length || cfg.repriseLevel !== repriseLevel || cfg.strengthLevel !== strengthLevel) {
    await savePlanConfig({ ...cfg, repriseLevel, strengthLevel, mode, formeBaseMinutes }, database)
    await setSetting(KEYS.lastDecisions, { at: today, decisions }, database)
  } else if (cfg.lastReviewedWeek) await savePlanConfig(cfg, database)
  return decisions
}

/** Calcule le plan proposé (semaine en cours + suivante) sans rien enregistrer. */
export async function computePlan(today: ISODate, database: CoachDB = db): Promise<{ before: PlannedSession[]; after: PlannedSession[]; notes: string[]; inputs?: PlanInputs }> {
  const cfg = await getPlanConfig(database)
  if (!cfg) return { before: [], after: [], notes: [] }
  const availHash: Record<ISODate, string> = {}
  let goalKey: string | undefined
  let vdotRef: number | undefined
  const notes: string[] = []
  const fitnessNow = estimateFitness((await getSetting<Performance[]>(KEYS.perfs, database)) ?? [], today)
  const paces = sessionPaces(fitnessNow, (cfg.mode ?? 'reprise') === 'reprise')
  const equipment = await getEquipment(database)
  const overload = detectOverload(await database.checkins.where('date').between(addDays(today, -OVERLOAD_DAYS), today, true, true).toArray(), today)
  if (overload.active) notes.push(`Allègement temporaire : ${overload.reasons.join(', ')} ces 3 dernières semaines.`)
  const zones = ((await database.profile.get('me'))?.injuries ?? []) as FragileZone[]
  const w0 = mondayOf(today)
  const before: PlannedSession[] = []
  const after: PlannedSession[] = []
  for (const weekStart of [w0, addDays(w0, 7)]) {
    const end = addDays(weekStart, 7)
    const existing = await database.sessions.where('date').between(weekStart, end, true, false).toArray()
    // Le dimanche précédent : celui qu'on vient de planifier (semaine en cours), sinon la base.
    const sundayDate = addDays(weekStart, -1)
    const prevSunday = after.some((s) => s.date === sundayDate)
      ? after.filter((s) => s.date === sundayDate)
      : await database.sessions.where('date').equals(sundayDate).toArray()
    const { days } = await getAvailability(weekStart, database)
    availHash[weekStart] = JSON.stringify(days.map((d) => [d.available, d.maxMinutes]))
    const gw = await goalWeek(weekStart, today, cfg, database)
    if (gw) {
      const g = await getSetting<{ id: string }>(KEYS.goal, database)
      goalKey = g?.id
    }
    if (gw) notes.push(`Objectif : semaine ${gw.weekIndex + 1}/${gw.total}, phase ${gw.phase}.`)
    const plan = planWeek({
      weekStart,
      planStart: cfg.startDate,
      today,
      weekIndex: weekIndexOf(cfg.startDate, weekStart),
      availability: days,
      // Surcharge prolongée : une sortie et un renfo de moins (minimum 2 sorties, 1 renfo).
      runsPerWeek: overload.active && !gw ? Math.max(2, cfg.runsPerWeek - 1) : cfg.runsPerWeek,
      strengthPerWeek: overload.active ? Math.max(1, cfg.strengthPerWeek - 1) : cfg.strengthPerWeek,
      longRunWeekday: cfg.longRunWeekday,
      repriseLevel: cfg.repriseLevel,
      strengthLevel: cfg.strengthLevel,
      equipment,
      existing,
      ranPreviousSunday: prevSunday.some((s) => isRunSession(s) && s.status !== 'skipped'),
      zones,
      paces,
      blockedDates: Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter((d) => isPaused(cfg.pause, d)),
      mode: gw ? 'objectif' : cfg.mode ?? 'reprise',
      formeBaseMinutes: cfg.formeBaseMinutes && overload.active ? Math.round(cfg.formeBaseMinutes * OVERLOAD_VOLUME_FACTOR) : cfg.formeBaseMinutes,
      goalTemplates: gw?.templates,
      raceDate: gw ? (await getSetting<{ date: ISODate }>(KEYS.goal, database))?.date : undefined,
      trail: gw ? (await getSetting<{ type: string }>(KEYS.goal, database))?.type === 'trail' : false,
    })
    before.push(...existing)
    after.push(...plan.sessions.map((s) => mergeSync(s, existing.find((e) => e.id === s.id))))
    notes.push(...plan.notes)
  }
  vdotRef = fitnessNow.vdot != null ? Math.round(fitnessNow.vdot) : undefined
  const sessionsAll = await database.sessions.where('date').between(addDays(w0, -7), addDays(w0, 14), true, false).toArray()
  const inputs: PlanInputs = {
    engine: ENGINE_VERSION,
    mode: cfg.mode ?? 'reprise',
    repriseLevel: cfg.repriseLevel,
    strengthLevel: cfg.strengthLevel,
    formeBase: cfg.formeBaseMinutes,
    runsPerWeek: cfg.runsPerWeek,
    strengthPerWeek: cfg.strengthPerWeek,
    longRunWeekday: cfg.longRunWeekday,
    startDate: cfg.startDate,
    availability: availHash,
    zones: [...zones].sort(),
    pause: cfg.pause ? `${cfg.pause.from}:${cfg.pause.reason}` : undefined,
    overload: overload.active,
    goal: goalKey,
    vdot: vdotRef,
    missed: sessionsAll.filter((s) => s.status === 'missed').map((s) => s.id).sort(),
    skipped: sessionsAll.filter((s) => s.status === 'skipped').map((s) => s.id).sort(),
  }
  return { before, after, notes, inputs }
}

/** Remplace les séances non conservées par `after`, et mémorise les suppressions à envoyer à Intervals.icu. */
async function writeSessions(before: PlannedSession[], after: PlannedSession[], database: CoachDB) {
  const removed = before.filter((b) => !after.some((a) => a.id === b.id))
  const toDeleteRemote = removed.filter((r) => r.sync.status === 'sent' || r.sync.status === 'outdated').map((r) => r.externalId)
  // Une séance de course devenue repos doit aussi disparaître de la montre.
  for (const a of after) {
    const b = before.find((x) => x.id === a.id)
    if (b && isRunSession(b) && !isRunSession(a) && (b.sync.status === 'sent' || b.sync.status === 'outdated')) {
      toDeleteRemote.push(a.externalId)
      a.sync = { status: 'not-sent' }
    }
  }
  await database.transaction('rw', database.sessions, database.settings, async () => {
    await database.sessions.bulkDelete(removed.map((r) => r.id))
    await database.sessions.bulkPut(after)
    if (toDeleteRemote.length) {
      const pending = (await getSetting<string[]>(KEYS.pendingDeletes, database)) ?? []
      await setSetting(KEYS.pendingDeletes, [...new Set([...pending, ...toDeleteRemote])], database)
    }
  })
}

async function queueRemoteDelete(ids: string[], database: CoachDB) {
  const pending = (await getSetting<string[]>(KEYS.pendingDeletes, database)) ?? []
  await setSetting(KEYS.pendingDeletes, [...new Set([...pending, ...ids])], database)
}

const futureOnly = (today: ISODate) => (s: PlannedSession) => s.date >= today

export interface RegenerateResult {
  changed: boolean
  version?: PlanVersion
  notes: string[]
}

/**
 * Recalcule le plan. `cause` explique pourquoi (affiché dans l'historique).
 * Mode auto : appliqué tout de suite (annulable). Mode valider : version en attente.
 */
export async function regenerate(cause: string, today: ISODate, database: CoachDB = db, opts: { force?: 'auto' } = {}): Promise<RegenerateResult> {
  const cfg = await getPlanConfig(database)
  if (!cfg) return { changed: false, notes: [] }
  const { before, after, notes, inputs } = await computePlan(today, database)
  const prevInputs = await getSetting<PlanInputs>(INPUTS_KEY, database)
  const changes = diffSessions(before.filter(futureOnly(today)), after.filter(futureOnly(today)))
  if (inputs) await setSetting(INPUTS_KEY, inputs, database)
  if (!changes.length) return { changed: false, notes }
  const first = before.length === 0
  const last = await getSetting<{ at: ISODate; decisions: LevelDecision[] }>(KEYS.lastDecisions, database)
  let causes = first || !inputs ? [] : explainChanges(prevInputs, inputs, [...before, ...after], last?.at === today ? last.decisions[last.decisions.length - 1]?.reason : undefined)
  // Plan créé avant cette version : on explique les mises à jour de l'appli intervenues depuis.
  if (!prevInputs && !first) causes = [ENGINE_CHANGELOG[4], ENGINE_CHANGELOG[5]]
  const onlyAppUpdate = causes.length > 0 && causes.every((c) => c.startsWith('Mise à jour de l’appli'))
  if (!first && !causes.length) causes = [`${cause} : jours passés et séances déjà faites pris en compte.`]
  const mode = opts.force ?? (first || onlyAppUpdate ? 'auto' : cfg.recalcMode)
  if (mode === 'valider') {
    const lastRejected = (await database.planVersions.orderBy('id').reverse().filter((v) => v.status === 'rejected').first())
    if (lastRejected && JSON.stringify(lastRejected.changes) === JSON.stringify(changes)) return { changed: false, notes }
  }
  const version: PlanVersion = {
    createdAt: new Date().toISOString(),
    cause: first ? cause : causes.join(' '),
    causes: first ? undefined : causes,
    changes,
    before,
    after,
    status: mode === 'auto' ? 'applied' : 'pending',
  }
  if (mode === 'valider') {
    // Une seule proposition en attente à la fois : la nouvelle remplace l'ancienne.
    await database.planVersions.filter((v) => v.status === 'pending').modify({ status: 'rejected' })
  }
  version.id = await database.planVersions.add(version)
  if (mode === 'auto') await writeSessions(before, after, database)
  return { changed: true, version, notes }
}

export async function acceptVersion(id: number, database: CoachDB = db) {
  const v = await database.planVersions.get(id)
  if (!v || v.status !== 'pending') return
  // Re-fusion sur l'état actuel au cas où des séances ont changé entre-temps.
  const current = await database.sessions.bulkGet(v.before.map((b) => b.id))
  await writeSessions(current.filter((x): x is PlannedSession => !!x), v.after, database)
  await database.planVersions.update(id, { status: 'applied' })
}

export async function rejectVersion(id: number, database: CoachDB = db) {
  await database.planVersions.update(id, { status: 'rejected' })
}

/** Annule une version appliquée : on remet les séances d'avant (sauf celles faites depuis). */
export async function undoVersion(id: number, database: CoachDB = db) {
  const v = await database.planVersions.get(id)
  if (!v || v.status !== 'applied') return
  const currentAfter = (await database.sessions.bulkGet(v.after.map((a) => a.id))).filter((x): x is PlannedSession => !!x)
  const restore = v.before.map((b) => {
    const now = currentAfter.find((c) => c.id === b.id)
    return now?.status === 'done' ? now : { ...b, sync: { ...b.sync, status: b.sync.status === 'sent' ? 'outdated' as const : b.sync.status } }
  })
  await writeSessions(currentAfter, restore, database)
  await database.planVersions.update(id, { status: 'undone' })
}

/* ---------- Mes actions sur le planning (j'ai toujours la main) ---------- */

async function userEdit(id: string, patch: Partial<PlannedSession>, cause: string, today: ISODate, database: CoachDB) {
  const s = await database.sessions.get(id)
  if (!s) return
  const next: PlannedSession = {
    ...s,
    ...patch,
    origin: 'moi',
    locked: patch.locked ?? true,
    sync: s.sync.status === 'sent' ? { ...s.sync, status: 'outdated' } : s.sync,
  }
  await database.planVersions.add({ createdAt: new Date().toISOString(), cause, changes: diffSessions([s], [next]), before: [s], after: [next], status: 'applied' })
  if (next.status === 'skipped' && (s.sync.status === 'sent' || s.sync.status === 'outdated')) {
    // Retirée par moi : on l'enlève aussi de la montre.
    await queueRemoteDelete([s.externalId], database)
    next.sync = { status: 'not-sent' }
  }
  await database.sessions.put(next)
  // Le reste de la semaine se réorganise autour de mon choix (toujours appliqué : c'est moi qui l'ai demandé).
  await regenerate(`Réorganisation après : ${cause.toLowerCase()}`, today, database, { force: 'auto' })
}

export const moveSession = (id: string, date: ISODate, today: ISODate, database: CoachDB = db) =>
  userEdit(id, { date }, 'Séance déplacée par toi', today, database)

export const removeSession = (id: string, today: ISODate, database: CoachDB = db) =>
  userEdit(id, { status: 'skipped' }, 'Séance retirée par toi', today, database)

export async function setLocked(id: string, locked: boolean, database: CoachDB = db) {
  await database.sessions.update(id, { locked, origin: 'moi' })
}

export async function addMySession(s: Omit<PlannedSession, 'id' | 'externalId' | 'sync' | 'status' | 'origin' | 'locked'>, today: ISODate, database: CoachDB = db) {
  const id = `perso-${s.date}-${Date.now().toString(36)}`
  const session: PlannedSession = { ...s, id, externalId: `coach-${id}`, status: 'planned', sync: { status: 'not-sent' }, origin: 'moi', locked: true }
  await database.sessions.put(session)
  await database.planVersions.add({ createdAt: new Date().toISOString(), cause: 'Séance ajoutée par toi', changes: diffSessions([], [session]), before: [], after: [session], status: 'applied' })
  await regenerate('Réorganisation après ton ajout', today, database, { force: 'auto' })
  return session
}

export async function markDone(id: string, rpe: number, database: CoachDB = db) {
  const s = await database.sessions.get(id)
  if (!s) return
  await database.sessions.update(id, { status: 'done' })
  await database.feedback.put({ id: `fb-${id}`, sessionId: id, date: s.date, rpe, at: new Date().toISOString() })
}

export async function markMissed(id: string, today: ISODate, database: CoachDB = db) {
  const s = await database.sessions.get(id)
  if (s && (s.sync.status === 'sent' || s.sync.status === 'outdated')) await queueRemoteDelete([s.externalId], database)
  await database.sessions.update(id, { status: 'missed', locked: true, sync: { status: 'not-sent' } })
  await regenerate('Séance non faite', today, database)
}

/** Remplace une séance par la version proposée (forme du jour), si j'accepte. */
export async function applyProposal(next: PlannedSession, cause: string, database: CoachDB = db) {
  const s = await database.sessions.get(next.id)
  if (!s) return
  await writeSessions([s], [{ ...next, locked: true, origin: 'moteur' }], database)
  await database.planVersions.add({ createdAt: new Date().toISOString(), cause, changes: diffSessions([s], [next]), before: [s], after: [next], status: 'applied' })
}

/* ---------- Pause ---------- */

export async function startPause(pause: Pause, today: ISODate, database: CoachDB = db) {
  const cfg = await getPlanConfig(database)
  if (!cfg) return
  await savePlanConfig({ ...cfg, pause }, database)
  await regenerate(`Plan en pause (${pause.reason})`, today, database, { force: 'auto' })
}

/** Fin de pause : reprise adaptée à la durée et au motif de l'arrêt. */
export async function endPause(today: ISODate, database: CoachDB = db) {
  const cfg = await getPlanConfig(database)
  if (!cfg?.pause) return
  const hasGoal = !!(await getSetting(KEYS.goal, database))
  const d = resumeAfterPause({ mode: cfg.mode ?? 'reprise', repriseLevel: cfg.repriseLevel, formeBaseMinutes: cfg.formeBaseMinutes }, cfg.pause, today, hasGoal)
  await savePlanConfig(
    { ...cfg, pause: undefined, mode: d.mode, repriseLevel: d.repriseLevel, formeBaseMinutes: d.formeBaseMinutes, lastReviewedWeek: addDays(mondayOf(today), -7) },
    database,
  )
  await setSetting(KEYS.notice, { at: today, messages: d.messages }, database)
  await regenerate('Fin de pause : reprise adaptée', today, database, { force: 'auto' })
  return d
}

/** Les séances passées non faites deviennent « non faites » (à l'ouverture de l'appli). */
export async function dailyStale(today: ISODate, database: CoachDB = db) {
  const stale = await database.sessions.where('date').below(today).filter((s) => s.status === 'planned' && s.kind !== 'repos').toArray()
  for (const s of stale) await database.sessions.update(s.id, { status: 'missed' })
  return stale
}
