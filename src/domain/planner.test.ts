import { describe, expect, it } from 'vitest'
import type { DayAvailability, EquipmentId, PlannedSession } from '../data/types'
import { addDays, weekdayIndex } from './dates'
import { planWeek, spreadDays, type WeekPlanInput } from './planner'
import { goalWeekTemplates } from './goalPlan'
import type { Goal } from './goals'

const HOME: EquipmentId[] = ['tapis', 'kettlebell', 'elastiques', 'roue-abdos', 'escalier', 'mur']
const MONDAY = '2026-11-16'

function avail(minutes: number[] = [60, 60, 60, 60, 60, 90, 120]): DayAvailability[] {
  return minutes.map((m, weekday) => ({ weekday, available: m > 0, maxMinutes: m }))
}

function input(over: Partial<WeekPlanInput> = {}): WeekPlanInput {
  return {
    weekStart: MONDAY,
    planStart: MONDAY,
    today: MONDAY,
    weekIndex: 0,
    availability: avail(),
    runsPerWeek: 3,
    strengthPerWeek: 2,
    longRunWeekday: 6,
    repriseLevel: 2,
    strengthLevel: 1,
    equipment: HOME,
    existing: [],
    ...over,
  }
}

const days = (ss: PlannedSession[], pred: (s: PlannedSession) => boolean) => ss.filter(pred).map((s) => weekdayIndex(s.date))
const runDays = (ss: PlannedSession[]) => days(ss, (s) => s.kind !== 'renfo')
const strengthDays = (ss: PlannedSession[]) => days(ss, (s) => s.kind === 'renfo')

describe('spreadDays', () => {
  it('maximise l’écart', () => {
    expect(spreadDays([0, 1, 2, 3, 4, 5], [6], 2)).toEqual([0, 3])
    expect(spreadDays([0, 1, 2, 3, 4, 5], [-1, 6], 2)).toEqual([2, 4])
  })
})

describe('planWeek', () => {
  it('semaine type : 3 sorties espacées, longue le dimanche, 2 renfos', () => {
    const { sessions } = planWeek(input({ ranPreviousSunday: true }))
    expect(runDays(sessions)).toEqual([2, 4, 6])
    expect(strengthDays(sessions)).toEqual([0, 3])
    const long = sessions.find((s) => s.kind === 'sortie-longue')!
    expect(long.key).toBe(true)
    expect(long.workoutText).toContain('8x')
  })

  it('jamais de renfo la veille de la sortie longue', () => {
    for (let lr = 0; lr < 7; lr++) {
      const { sessions } = planWeek(input({ longRunWeekday: lr }))
      const key = days(sessions, (s) => !!s.key)
      for (const d of strengthDays(sessions)) expect(key).not.toContain(d + 1)
    }
  })

  it('pas deux sorties d’affilée quand on a le choix', () => {
    const r = runDays(planWeek(input()).sessions)
    for (let i = 1; i < r.length; i++) expect(r[i] - r[i - 1]).toBeGreaterThan(1)
  })

  it('respecte les jours indisponibles et la durée max', () => {
    const { sessions } = planWeek(input({ availability: avail([0, 45, 0, 45, 0, 0, 30]) }))
    for (const s of sessions) {
      const wd = weekdayIndex(s.date)
      expect([1, 3, 6]).toContain(wd)
    }
    const sun = sessions.find((s) => weekdayIndex(s.date) === 6)!
    expect(sun.durationMin).toBeLessThanOrEqual(30)
    expect(sun.reasons.join(' ')).toMatch(/Raccourcie/)
  })

  it('déplace la sortie longue si le dimanche est pris, et le dit', () => {
    const { sessions, notes } = planWeek(input({ availability: avail([60, 60, 60, 60, 60, 90, 0]) }))
    expect(sessions.find((s) => s.kind === 'sortie-longue')!.date).toBe(addDays(MONDAY, 5))
    expect(notes.join(' ')).toMatch(/samedi/)
  })

  it('ne planifie rien avant la date de début choisie', () => {
    const start = addDays(MONDAY, 3)
    const { sessions } = planWeek(input({ planStart: start }))
    expect(sessions.every((s) => s.date >= start)).toBe(true)
    expect(sessions.length).toBeGreaterThan(0)
  })

  it('ne touche pas au passé', () => {
    const today = addDays(MONDAY, 2)
    const { sessions } = planWeek(input({ today }))
    expect(sessions.every((s) => s.date >= today)).toBe(true)
  })

  it('garde mes séances verrouillées et planifie autour', () => {
    const mine: PlannedSession = {
      id: 'course-perso',
      date: addDays(MONDAY, 1),
      kind: 'endurance',
      title: 'Footing avec un ami',
      durationMin: 40,
      reasons: ['Ajoutée par moi'],
      status: 'planned',
      externalId: 'coach-course-perso',
      sync: { status: 'not-sent' },
      locked: true,
      origin: 'moi',
    }
    const { sessions } = planWeek(input({ existing: [mine] }))
    expect(sessions).toContainEqual(mine)
    const r = runDays(sessions)
    expect(r).toHaveLength(3)
    expect(r).toContain(1)
    expect(r.filter((d) => d === 1)).toHaveLength(1)
  })

  it('remplace les séances non verrouillées du futur', () => {
    const old = planWeek(input({ repriseLevel: 1 })).sessions
    const { sessions } = planWeek(input({ repriseLevel: 3, existing: old }))
    expect(sessions.filter((s) => s.kind !== 'renfo').every((s) => s.reasons[0].includes('niveau 3'))).toBe(true)
    expect(sessions).toHaveLength(5)
  })

  it('semaine allégée : un niveau en dessous', () => {
    const { sessions, notes } = planWeek(input({ weekIndex: 3, repriseLevel: 4 }))
    expect(sessions[0].reasons[0]).toContain('niveau 3')
    expect(notes[0]).toMatch(/allégée/)
  })

  it('renfo le même jour qu’une sortie facile si pas d’autre créneau', () => {
    const { sessions, notes } = planWeek(input({ availability: avail([0, 75, 0, 75, 0, 0, 120]), runsPerWeek: 3 }))
    const s = strengthDays(sessions)
    expect(s.length).toBeGreaterThan(0)
    expect(s).not.toContain(5)
    expect(notes.join(' ')).toMatch(/même jour/)
  })

  it('identifiants externes stables et séances envoyables', () => {
    const a = planWeek(input()).sessions
    const b = planWeek(input()).sessions
    expect(a.map((s) => s.externalId)).toEqual(b.map((s) => s.externalId))
    expect(a.every((s) => s.workoutText && s.externalId.startsWith('coach-'))).toBe(true)
  })

  it('forme continue : longue le dimanche, séance soutenue loin d’elle, renfo jamais la veille', () => {
    const { sessions } = planWeek(input({ mode: 'forme', formeBaseMinutes: 160, weekIndex: 1, ranPreviousSunday: true }))
    const long = sessions.find((s) => s.kind === 'sortie-longue')!
    const q = sessions.find((s) => s.kind === 'fractionne')!
    expect(weekdayIndex(long.date)).toBe(6)
    expect(Math.abs(weekdayIndex(q.date) - 6)).toBeGreaterThan(1)
    const keys = days(sessions, (s) => !!s.key)
    for (const d of strengthDays(sessions)) expect(keys).not.toContain(d + 1)
    const runMin = sessions.filter((s) => s.kind !== 'renfo').reduce((a, s) => a + s.durationMin, 0)
    expect(Math.abs(runMin - 160)).toBeLessThanOrEqual(5)
  })

  it('forme continue : semaine allégée sans séance soutenue', () => {
    const { sessions } = planWeek(input({ mode: 'forme', formeBaseMinutes: 160, weekIndex: 3 }))
    expect(sessions.some((s) => s.kind === 'fractionne')).toBe(false)
    expect(sessions.filter((s) => s.kind !== 'renfo').reduce((a, s) => a + s.durationMin, 0)).toBeLessThanOrEqual(125)
  })

  const goal: Goal = { id: 'g', type: 'route', distance: '10k', targetTimeSec: 2700, date: addDays(MONDAY, 6), createdAt: '' }

  it('objectif : séances clés jamais collées, longue le dimanche', () => {
    const t = goalWeekTemplates({ goal, phase: 'specifique', weekInPhase: 0, minutes: 200, runs: 4, vdot: 44, deload: false })
    const { sessions } = planWeek(input({ mode: 'objectif', goalTemplates: t, runsPerWeek: 4 }))
    const keys = days(sessions, (s) => !!s.key).sort()
    for (let i = 1; i < keys.length; i++) expect(keys[i] - keys[i - 1]).toBeGreaterThan(1)
    expect(sessions.find((s) => s.kind === 'sortie-longue')!.date).toBe(addDays(MONDAY, 6))
    expect(sessions.some((s) => s.workoutText?.includes('/km Pace'))).toBe(true)
  })

  it('semaine de course : la course le jour J même s’il est indisponible, rien la veille', () => {
    const t = goalWeekTemplates({ goal, phase: 'course', weekInPhase: 0, minutes: 80, runs: 3, vdot: 44, deload: false })
    const { sessions } = planWeek(input({ mode: 'objectif', goalTemplates: t, raceDate: goal.date, availability: avail([60, 60, 60, 60, 60, 60, 0]) }))
    const race = sessions.find((s) => s.kind === 'test')!
    expect(race.date).toBe(goal.date)
    expect(race.title).toBe('Course objectif')
    expect(sessions.filter((s) => s.kind !== 'renfo').some((s) => s.date === addDays(goal.date, -1))).toBe(false)
    expect(strengthDays(sessions)).not.toContain(5)
  })

  it('séance ratée : elle n’est pas comptée et une autre est replanifiée plus tard', () => {
    const first = planWeek(input()).sessions
    const tue = first.find((s) => s.kind !== 'renfo' && weekdayIndex(s.date) <= 2)!
    const missed = { ...tue, status: 'missed' as const, locked: true }
    const today = addDays(MONDAY, weekdayIndex(tue.date) + 1)
    const { sessions } = planWeek(input({ today, existing: [missed, ...first.filter((s) => s.id !== tue.id)] }))
    const futureRuns = sessions.filter((s) => s.kind !== 'renfo' && s.date >= today && s.status === 'planned')
    expect(futureRuns.length).toBe(3)
    expect(sessions).toContainEqual(missed)
    expect(futureRuns.some((s) => s.reasons.join(' ').includes('Remplace la séance non faite'))).toBe(true)
  })
})
