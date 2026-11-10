import type { DayAvailability, EquipmentId, ISODate, PlannedSession, SessionKind } from '../data/types'
import { addDays, weekdayIndex } from './dates'
import { getLevel, isDeloadWeek, repriseLabel, repriseWorkout } from './reprise'
import { buildStrengthSession, strengthDescription } from './strength'
import { easyWorkout, fartlekWorkout, formeWeek, weekMinutes, type FormeSessionTemplate } from './forme'
import { withRoutines, type FragileZone } from './routines'
import { estimateDurationSec, toIntervalsText, type Workout } from './workout'

/**
 * PLANIFICATEUR DE SEMAINE (mode Reprise, Phase 1).
 *
 * Règles, toutes explicables :
 * 1. Les séances verrouillées par moi (ou déjà faites) sont gardées telles quelles.
 * 2. Rien n'est planifié avant la date de début du plan, ni dans le passé.
 * 3. La sortie longue va sur le jour préféré (dimanche par défaut) s'il est disponible.
 * 4. Les autres sorties sont espacées au maximum (jamais deux jours d'affilée si possible).
 * 5. Le renfo va de préférence un jour sans course, jamais la veille d'une séance clé.
 * 6. Chaque séance tient dans le temps disponible du jour ; sinon elle est raccourcie (et on le dit).
 */

const WEEKDAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
/** Durée minimale d'un créneau course : séance + échauffement guidé + étirements. */
export const MIN_RUN_MIN = 35
export const MIN_STRENGTH_MIN = 15

export interface WeekPlanInput {
  /** Lundi de la semaine à planifier. */
  weekStart: ISODate
  /** Date de début du plan choisie par moi. */
  planStart: ISODate
  /** Aujourd'hui : on ne replanifie pas le passé. */
  today: ISODate
  /** Numéro de semaine depuis le début du plan (0 = première). */
  weekIndex: number
  availability: DayAvailability[]
  runsPerWeek: number
  strengthPerWeek: number
  /** 0 = lundi … 6 = dimanche */
  longRunWeekday: number
  repriseLevel: number
  strengthLevel: number
  equipment: EquipmentId[]
  /** Séances déjà présentes cette semaine : les verrouillées / faites / passées sont conservées. */
  existing: PlannedSession[]
  /** Vrai si j'ai couru le dimanche précédent : évite une sortie dès le lundi. */
  ranPreviousSunday?: boolean
  /** reprise (par défaut), forme continue, ou objectif. */
  mode?: 'reprise' | 'forme' | 'objectif'
  /** Objectif : séances de la semaine (voir goalPlan.ts). */
  goalTemplates?: FormeSessionTemplate[]
  /** Objectif : date de la course (placée ce jour-là quoi qu'il arrive). */
  raceDate?: ISODate
  /** Objectif trail : renfo orienté descentes et proprioception. */
  trail?: boolean
  /** Zones fragiles : échauffement, étirements et renfo ciblés. */
  zones?: FragileZone[]
  /** Jours sans aucune séance (pause : vacances, maladie, blessure). */
  blockedDates?: ISODate[]
  /** Forme continue : volume de course d'une semaine de charge, en minutes. */
  formeBaseMinutes?: number
}

export interface WeekPlan {
  sessions: PlannedSession[]
  /** Remarques générales sur la semaine (affichées dans l'écran Semaine). */
  notes: string[]
}

const isRun = (k: SessionKind) => k !== 'renfo' && k !== 'repos'
const mins = (w: Workout) => Math.round(estimateDurationSec(w) / 60)

/** Une séance existante est conservée telle quelle si verrouillée, faite, ou dans le passé. */
export function isKept(s: PlannedSession, today: ISODate): boolean {
  return !!s.locked || s.status === 'done' || s.date < today
}

export function sessionId(kind: 'course' | 'renfo', date: ISODate) {
  return `${kind}-${date}`
}

function runSession(date: ISODate, workout: Workout, opts: { long: boolean; level: number; reasons: string[] }): PlannedSession {
  const id = sessionId('course', date)
  return {
    id,
    date,
    kind: opts.long ? 'sortie-longue' : getLevel(opts.level).reps > 1 ? 'marche-course' : 'endurance',
    title: opts.long ? 'Sortie longue tranquille' : getLevel(opts.level).reps > 1 ? 'Marche-course' : 'Endurance facile',
    durationMin: Math.round(estimateDurationSec(workout) / 60),
    workoutText: toIntervalsText(workout),
    workout,
    reasons: opts.reasons,
    status: 'planned',
    externalId: `coach-${id}`,
    sync: { status: 'not-sent' },
    key: opts.long,
    origin: 'moteur',
  }
}

/** Choisit `count` jours parmi `candidates` en maximisant l'écart avec `taken`. Déterministe. */
export function spreadDays(candidates: number[], taken: number[], count: number): number[] {
  const chosen: number[] = []
  const pool = [...candidates]
  while (chosen.length < count && pool.length) {
    const all = [...taken, ...chosen]
    let best = pool[0]
    let bestScore = -Infinity
    for (const d of pool) {
      const gap = all.length ? Math.min(...all.map((x) => Math.abs(x - d))) : 7
      // Écart d'abord ; à égalité, on préfère le jour le plus tôt.
      const score = gap * 10 - d * 0.01
      if (score > bestScore) {
        bestScore = score
        best = d
      }
    }
    chosen.push(best)
    pool.splice(pool.indexOf(best), 1)
  }
  return chosen.sort((a, b) => a - b)
}

export function planWeek(input: WeekPlanInput): WeekPlan {
  const notes: string[] = []
  const dates = Array.from({ length: 7 }, (_, i) => addDays(input.weekStart, i))
  const avail = (wd: number) => input.availability.find((a) => a.weekday === wd)
  const open = (wd: number) => dates[wd] >= input.planStart && dates[wd] >= input.today && !(input.blockedDates ?? []).includes(dates[wd])

  const kept = input.existing.filter((s) => isKept(s, input.today))
  // Une séance ratée ou retirée garde sa place dans l'historique mais ne compte pas :
  // le moteur peut la remplacer plus tard dans la semaine.
  const counts = (s: PlannedSession) => s.status !== 'missed' && s.status !== 'skipped'
  const keptRunDays = kept.filter((s) => isRun(s.kind) && counts(s)).map((s) => weekdayIndex(s.date))
  const missedRun = kept.find((s) => isRun(s.kind) && s.status === 'missed')
  // Le dimanche précédent compte comme le « jour -1 » pour l'espacement.
  const spacingRefs = input.ranPreviousSunday ? [-1] : []
  const keptStrengthDays = kept.filter((s) => s.kind === 'renfo' && counts(s)).map((s) => weekdayIndex(s.date))
  const keptKeyDays = kept.filter((s) => s.key && counts(s)).map((s) => weekdayIndex(s.date))
  const occupied = new Set(kept.map((s) => weekdayIndex(s.date)))

  const deload = input.mode === 'objectif' ? false : isDeloadWeek(input.weekIndex)
  const level = deload ? Math.max(1, input.repriseLevel - 1) : input.repriseLevel
  const weekLabel = `Semaine ${input.weekIndex + 1} du plan`
  if (deload)
    notes.push(
      input.mode === 'forme'
        ? 'Semaine allégée : volume −25 % et une série de moins en renfo, pour assimiler les 3 semaines de charge.'
        : 'Semaine allégée : un cran plus doux en course et une série de moins en renfo, pour assimiler le travail des 3 dernières semaines.',
    )

  const usableFor = (minMin: number) =>
    [0, 1, 2, 3, 4, 5, 6].filter((wd) => open(wd) && !occupied.has(wd) && (avail(wd)?.available ?? false) && (avail(wd)?.maxMinutes ?? 0) >= minMin)

  // --- Course ---
  const raceWd = input.raceDate && dates.includes(input.raceDate) && input.raceDate >= input.today ? dates.indexOf(input.raceDate) : undefined
  const hasRace = raceWd !== undefined && !kept.some((s) => s.date === input.raceDate && s.kind === 'test')
  const runsNeeded = Math.max(0, input.runsPerWeek - keptRunDays.length - (hasRace ? 1 : 0))
  const runCandidates = usableFor(MIN_RUN_MIN).filter((d) => d !== raceWd && !(raceWd !== undefined && d === raceWd - 1))
  const runDays: number[] = []
  let longDay: number | undefined
  const hasKeptLong = kept.some((s) => s.kind === 'sortie-longue')
  const wantsLong = !(input.mode === 'objectif' && input.goalTemplates && !input.goalTemplates.some((t) => t.kind === 'sortie-longue'))
  if (runsNeeded > 0 && !hasKeptLong && wantsLong) {
    if (runCandidates.includes(input.longRunWeekday)) longDay = input.longRunWeekday
    else {
      const weekend = runCandidates.filter((d) => d >= 5)
      longDay = weekend.length ? weekend[weekend.length - 1] : runCandidates[runCandidates.length - 1]
      if (longDay !== undefined && runCandidates.length)
        notes.push(`Sortie longue placée le ${WEEKDAYS[longDay]} : le ${WEEKDAYS[input.longRunWeekday]} n'est pas disponible.`)
    }
    if (longDay !== undefined) runDays.push(longDay)
  }
  runDays.push(
    ...spreadDays(
      runCandidates.filter((d) => d !== longDay),
      [...spacingRefs, ...keptRunDays, ...runDays, ...(hasRace ? [raceWd!] : [])],
      runsNeeded - runDays.length,
    ),
  )
  runDays.sort((a, b) => a - b)
  if (runDays.length < runsNeeded) {
    notes.push(`Pas assez de jours disponibles (≥ ${MIN_RUN_MIN} min) : ${runDays.length + keptRunDays.length} sortie(s) au lieu de ${input.runsPerWeek} cette semaine.`)
  }
  const consecutive = runDays.some((d) => runDays.includes(d + 1) || keptRunDays.includes(d + 1) || keptRunDays.includes(d - 1))
  if (consecutive) notes.push('Deux sorties se suivent faute d’autres jours libres : la seconde reste très facile.')

  const sessions: PlannedSession[] = [...kept]
  const generatedKeyDays: number[] = []
  if (input.mode === 'forme' || input.mode === 'objectif') {
    let templates: FormeSessionTemplate[]
    if (input.mode === 'objectif' && input.goalTemplates) {
      templates = [...input.goalTemplates]
      // Moins de jours libres que de séances : on garde la course, la longue et les séances clés d'abord.
      const raceT = templates.filter((t) => t.kind === 'test')
      const others = templates.filter((t) => t.kind !== 'test').slice(0, runDays.length)
      templates = [...raceT, ...others]
      if (others.length < input.goalTemplates.length - raceT.length) notes.push('Pas assez de jours disponibles pour toutes les séances prévues : les séances faciles sautent en premier.')
    } else {
      // Volume de la semaine, réduit au prorata des sorties déjà fixées par moi.
      const base = weekMinutes(input.formeBaseMinutes ?? 120, input.weekIndex)
      const total = Math.round((base * runDays.length) / Math.max(1, input.runsPerWeek))
      templates = formeWeek(total, runDays.length, input.weekIndex)
    }
    const free = [...runDays]
    const keyRefs: number[] = [...keptKeyDays, ...(hasRace ? [raceWd!] : [])]
    const take = (d: number | undefined) => {
      if (d === undefined) return undefined
      free.splice(free.indexOf(d), 1)
      return d
    }
    for (const t of templates) {
      let wd: number | undefined
      if (t.kind === 'test') wd = raceWd
      else if (t.kind === 'sortie-longue') {
        wd = take(longDay !== undefined && free.includes(longDay) ? longDay : free[free.length - 1])
        if (wd !== undefined) keyRefs.push(wd)
      } else if (t.key) {
        // Séance clé : la plus éloignée des autres séances clés, jamais la veille ni le lendemain.
        const refs = keyRefs.length ? keyRefs : [longDay ?? 6]
        const gap = (d: number) => Math.min(...refs.map((r) => Math.abs(d - r)))
        const cands = free.filter((d) => gap(d) > 1).sort((a, b) => gap(b) - gap(a) || a - b)
        wd = take(cands[0])
        if (wd === undefined) {
          notes.push(`${t.title} non placée : pas de jour libre assez éloigné des autres séances clés.`)
          continue
        }
        keyRefs.push(wd)
      } else wd = take(free[0])
      if (wd === undefined) continue
      const max = t.kind === 'test' ? 24 * 60 : avail(wd)?.maxMinutes ?? 60
      const reasons = [
        input.mode === 'objectif' ? `${weekLabel} · plan objectif.` : `${weekLabel} · forme continue, semaine ${(input.weekIndex % 4) + 1}/4 du cycle.`,
        t.reason,
      ]
      const extra = 9 // échauffement guidé + étirements
      let workout = t.workout
      if (t.minutes + extra > max) {
        const m = max - extra
        workout = t.key && t.kind !== 'sortie-longue' ? (t.kind === 'fractionne' ? fartlekWorkout(m).workout : t.workout) : easyWorkout(m)
        reasons.push(`Raccourcie pour tenir dans tes ${max} min disponibles.`)
      }
      workout = withRoutines(workout, input.zones, { stretch: t.kind !== 'test' })
      reasons.push(t.kind === 'test' ? 'Échauffement guidé obligatoire avant le départ.' : 'Échauffement guidé au début et étirements à la fin : ils font partie de la séance.')
      if (deload && input.mode !== 'objectif') reasons.push('Semaine allégée.')
      const id = sessionId('course', dates[wd])
      if (t.key) generatedKeyDays.push(wd)
      sessions.push({
        id,
        date: dates[wd],
        kind: t.kind,
        title: t.title,
        durationMin: mins(workout),
        workoutText: toIntervalsText(workout),
        workout,
        reasons,
        status: 'planned',
        externalId: `coach-${id}`,
        sync: { status: 'not-sent' },
        key: t.key,
        origin: 'moteur',
      })
    }
  } else {
    for (const wd of runDays) {
      const long = wd === longDay
      const max = avail(wd)!.maxMinutes
      const reasons = [`${weekLabel} · reprise niveau ${level}/9.`]
      let lvl = level
      let isLong = long
      const build = () => withRoutines(repriseWorkout(lvl, isLong), input.zones)
      let w = build()
      if (long) reasons.push(`Sortie longue du ${WEEKDAYS[wd]} : ${repriseLabel(lvl, true)}, toujours à allure de conversation.`)
      else reasons.push(`${repriseLabel(lvl)}, à allure de conversation (zone 2).`)
      if (deload) reasons.push('Semaine allégée.')
      // Ajustement au temps disponible.
      while (estimateDurationSec(w) / 60 > max) {
        if (isLong) {
          isLong = false
        } else if (lvl > 1) {
          lvl -= 1
        } else break
        w = build()
      }
      if (lvl !== level || isLong !== long) reasons.push(`Raccourcie pour tenir dans tes ${max} min disponibles.`)
      reasons.push('Échauffement guidé au début et étirements à la fin : ils font partie de la séance.')
      if (missedRun && dates[wd] > missedRun.date) reasons.push(`Remplace la séance non faite du ${WEEKDAYS[weekdayIndex(missedRun.date)]}.`)
      if (long) generatedKeyDays.push(wd)
      sessions.push(runSession(dates[wd], w, { long, level: lvl, reasons }))
    }
  }

  // --- Renfo ---
  const allRunDays = [...keptRunDays, ...runDays]
  const keyDays = [...keptKeyDays, ...generatedKeyDays]
  const notBeforeKey = (d: number) => !keyDays.includes(d + 1)
  const strengthNeeded = Math.max(0, input.strengthPerWeek - keptStrengthDays.length)
  const sCandidates = usableFor(MIN_STRENGTH_MIN).filter(notBeforeKey)
  const restDays = sCandidates.filter((d) => !allRunDays.includes(d))
  const sDays = spreadDays(restDays, keptStrengthDays, strengthNeeded)
  if (sDays.length < strengthNeeded) {
    // Repli : le même jour qu'une sortie facile (renfo après la course), si le temps
    // disponible suffit pour les deux. Jamais un jour de séance clé ni la veille.
    const runMinOn = (d: number) => sessions.find((s) => s.date === dates[d] && isRun(s.kind))?.durationMin ?? 0
    const sameDayCandidates = runDays.filter(
      (d) => !keyDays.includes(d) && notBeforeKey(d) && (avail(d)?.maxMinutes ?? 0) - runMinOn(d) >= MIN_STRENGTH_MIN,
    )
    const extra = spreadDays(sameDayCandidates, [...keptStrengthDays, ...sDays], strengthNeeded - sDays.length)
    sDays.push(...extra)
    sDays.sort((a, b) => a - b)
    if (extra.length) notes.push('Pas assez de jours sans course : un renfo est placé après une sortie facile, le même jour.')
  }
  if (sDays.length < strengthNeeded) notes.push(`Renfo : ${sDays.length + keptStrengthDays.length} séance(s) au lieu de ${input.strengthPerWeek} (manque de créneaux).`)

  sDays.forEach((wd, n) => {
    const template = (input.weekIndex * input.strengthPerWeek + keptStrengthDays.length + n) % 2 === 0 ? 'A' : 'B'
    const runSameDay = allRunDays.includes(wd)
    const runMin = runSameDay ? (sessions.find((s) => s.date === dates[wd] && isRun(s.kind))?.durationMin ?? 0) : 0
    const maxMinutes = Math.min(20, (avail(wd)?.maxMinutes ?? 20) - runMin)
    const st = buildStrengthSession({ template, level: input.strengthLevel, equipment: input.equipment, deload, maxMinutes, trail: input.trail, zones: input.zones })
    const id = sessionId('renfo', dates[wd])
    const reasons = [
      input.trail
        ? `Renfo ${template} niveau ${st.level}/5 orienté trail : descentes (excentrique), équilibre, fessiers et mollets.`
        : `Renfo ${template} niveau ${st.level}/5 : gainage, fessiers, mollets et stabilité pour courir sans se blesser.`,
    ]
    reasons.push(runSameDay ? 'Placé après ta sortie facile du jour (pas d’autre créneau libre).' : 'Placé un jour sans course.')
    if (keyDays.length) reasons.push('Jamais la veille d’une séance clé (sortie longue, séance soutenue), pour arriver frais.')
    if (deload) reasons.push('Semaine allégée : une série de moins.')
    if (input.zones?.length) reasons.push('Commence par la prévention de tes zones fragiles.')
    sessions.push({
      id,
      date: dates[wd],
      kind: 'renfo',
      title: `Renfo ${template}`,
      durationMin: st.durationMin,
      workoutText: strengthDescription(st),
      strength: st,
      reasons,
      status: 'planned',
      externalId: `coach-${id}`,
      sync: { status: 'not-sent' },
      origin: 'moteur',
    })
  })

  sessions.sort((a, b) => (a.date === b.date ? (isRun(a.kind) ? -1 : 1) : a.date < b.date ? -1 : 1))
  return { sessions, notes }
}
