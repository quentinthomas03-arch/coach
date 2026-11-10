import { describe, expect, it } from 'vitest'
import type { PlannedSession } from '../data/types'
import { diffSessions } from './changes'
import { nextStrengthLevel, reviewWeek } from './progression'

const s = (id: string, date: string, over: Partial<PlannedSession> = {}): PlannedSession => ({
  id, date, kind: 'marche-course', title: 'Marche-course', durationMin: 31, reasons: [], status: 'planned',
  externalId: `coach-${id}`, sync: { status: 'sent' }, workoutText: 'x', ...over,
})

describe('ce qui a changé', () => {
  it('aucun changement', () => {
    expect(diffSessions([s('a', '2026-11-17')], [s('a', '2026-11-17')])).toEqual([])
  })
  it('déplacement, durée, ajout, retrait', () => {
    const before = [s('course-2026-11-17', '2026-11-17'), s('renfo-2026-11-18', '2026-11-18', { kind: 'renfo', title: 'Renfo A', durationMin: 18 })]
    const after = [s('course-2026-11-19', '2026-11-19', { durationMin: 22 }), s('course-2026-11-22', '2026-11-22', { kind: 'sortie-longue', title: 'Sortie longue', durationMin: 38 })]
    const d = diffSessions(before, after)
    expect(d).toContain('Marche-course : déplacée du mardi 17 au jeudi 19.')
    expect(d).toContain('Marche-course du jeudi 19 : 31 → 22 min.')
    expect(d).toContain('Renfo A (18 min) du mercredi 18 : retirée.')
    expect(d).toContain('Sortie longue (38 min) ajoutée le dimanche 22.')
  })
  it('remplacement par du repos', () => {
    const d = diffSessions([s('a', '2026-11-17')], [s('a', '2026-11-17', { kind: 'repos', title: 'Repos', durationMin: 0 })])
    expect(d).toEqual(['mardi 17 : Marche-course remplacée par Repos.'])
  })
})

describe('bilan de semaine', () => {
  const week = '2026-11-16'
  const sessions = [
    s('r1', '2026-11-17', { status: 'done' }),
    s('r2', '2026-11-19', { status: 'done' }),
    s('r3', '2026-11-22', { status: 'missed' }),
    s('k1', '2026-11-18', { kind: 'renfo', status: 'done' }),
    s('hors', '2026-11-24', { status: 'done' }),
  ]
  const fb = [
    { id: 'f1', sessionId: 'r1', date: '2026-11-17', rpe: 4, at: '' },
    { id: 'f2', sessionId: 'r2', date: '2026-11-19', rpe: 6, at: '' },
  ]
  it('course', () => {
    expect(reviewWeek(week, sessions, fb, [], 'course')).toEqual({ planned: 3, done: 2, avgRpe: 5, pain: false })
  })
  it('renfo', () => {
    expect(reviewWeek(week, sessions, fb, [], 'renfo')).toMatchObject({ planned: 1, done: 1 })
  })
  it('douleur du check', () => {
    const c = [{ date: '2026-11-20', physique: 3, moral: 3, travail: 3, viePerso: 3, at: '', douleur: { zone: 'genou', intensite: 2 } }]
    expect(reviewWeek(week, sessions, fb, c, 'course').pain).toBe(true)
  })
  it('renfo : monte après 2 semaines complètes', () => {
    const full = { planned: 2, done: 2, pain: false }
    expect(nextStrengthLevel(1, full, full).level).toBe(2)
    expect(nextStrengthLevel(1, full, { planned: 2, done: 1, pain: false }).level).toBe(1)
    expect(nextStrengthLevel(5, full, full).level).toBe(5)
    expect(nextStrengthLevel(3, { ...full, pain: true }).level).toBe(2)
  })
})
