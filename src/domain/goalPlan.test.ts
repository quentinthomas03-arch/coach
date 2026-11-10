import { describe, expect, it } from 'vitest'
import type { Goal } from './goals'
import { goalWeekTemplates, phasesFor, racePaceFor, totalWeeks, weeklyMinutesPlan } from './goalPlan'
import { toIntervalsText } from './workout'

const g = (over: Partial<Goal>): Goal => ({ id: 'g', type: 'route', distance: '10k', date: '2027-04-11', createdAt: '', ...over })

describe('périodisation', () => {
  it('nombre de semaines', () => {
    expect(totalWeeks('2027-01-18', '2027-04-11')).toBe(12)
  })
  it('12 semaines pour un 10 km : base, dev, spé, 1 semaine d’affûtage, semaine de course', () => {
    const p = phasesFor(12, 1)
    expect(p).toHaveLength(12)
    expect(p.filter((x) => x === 'base')).toHaveLength(4)
    expect(p.slice(-2)).toEqual(['affutage', 'course'])
  })
  it('marathon : 3 semaines d’affûtage', () => {
    expect(phasesFor(18, 3).slice(-4)).toEqual(['affutage', 'affutage', 'affutage', 'course'])
  })
  it('volume : +8 % max, semaine allégée, plafond, affûtage décroissant', () => {
    const p = phasesFor(12, 1)
    const v = weeklyMinutesPlan(p, 120, 180)
    // Chaque semaine de charge : ≤ +8 % par rapport à la semaine de charge précédente (hors semaine allégée).
    const load = v.slice(0, 10).filter((_, i) => i % 4 !== 3)
    for (let i = 1; i < load.length; i++) expect(load[i] / load[i - 1]).toBeLessThanOrEqual(1.08)
    expect(v[3]).toBeLessThan(v[2]) // semaine allégée
    expect(Math.max(...v)).toBeLessThanOrEqual(180)
    expect(v[10]).toBeLessThan(v[9])
    expect(v[11]).toBeLessThan(v[10])
  })
})

describe('séances de la semaine', () => {
  const vdot = 42
  it('développement 10 km : sortie longue + seuil en allure min/km + endurance', () => {
    const t = goalWeekTemplates({ goal: g({}), phase: 'developpement', weekInPhase: 1, minutes: 160, runs: 3, vdot, deload: false })
    expect(t.map((x) => x.kind)).toEqual(['sortie-longue', 'seuil', 'endurance'])
    expect(toIntervalsText(t[1].workout)).toMatch(/\d:\d\d-\d:\d\d\/km Pace/)
    expect(Math.abs(t.reduce((a, x) => a + x.minutes, 0) - 160)).toBeLessThanOrEqual(15)
  })
  it('spécifique 5 km : fractionné 1000 m', () => {
    const t = goalWeekTemplates({ goal: g({ distance: '5k', targetTimeSec: 1380 }), phase: 'specifique', weekInPhase: 0, minutes: 150, runs: 3, vdot, deload: false })
    const f = t.find((x) => x.kind === 'fractionne')!
    expect(toIntervalsText(f.workout)).toMatch(/4x\n- Rapide 1km/)
  })
  it('spécifique marathon : fin de sortie longue à allure course', () => {
    const t = goalWeekTemplates({ goal: g({ distance: 'marathon', targetTimeSec: 3 * 3600 + 45 * 60 }), phase: 'specifique', weekInPhase: 2, minutes: 300, runs: 4, vdot, deload: false })
    expect(t[0].reason).toMatch(/dernières minutes à allure course/)
    expect(toIntervalsText(t[0].workout)).toMatch(/Fin à allure course 35m/)
  })
  it('sans forme connue : zones cardio', () => {
    const t = goalWeekTemplates({ goal: g({}), phase: 'developpement', weekInPhase: 0, minutes: 150, runs: 3, deload: false })
    expect(toIntervalsText(t[1].workout)).toMatch(/Z4 HR/)
  })
  it('trail : côtes et D+ sur la sortie longue', () => {
    const t = goalWeekTemplates({ goal: { id: 't', type: 'trail', trailKm: 25, elevationGainM: 1200, date: '', createdAt: '' }, phase: 'specifique', weekInPhase: 0, minutes: 220, runs: 3, deload: false })
    expect(t.map((x) => x.kind)).toContain('cotes')
    expect(t[0].reason).toMatch(/m D\+/)
  })
  it('semaine de course : la course + rappel d’allure', () => {
    const t = goalWeekTemplates({ goal: g({ targetTimeSec: 2700 }), phase: 'course', weekInPhase: 0, minutes: 80, runs: 3, vdot, deload: false })
    expect(t[0]).toMatchObject({ kind: 'test', title: 'Course objectif', key: true })
    expect(t[0].reason).toMatch(/4:30\/km/)
  })
  it('semaine allégée : pas de séance de qualité', () => {
    const t = goalWeekTemplates({ goal: g({}), phase: 'developpement', weekInPhase: 3, minutes: 120, runs: 3, vdot, deload: true })
    expect(t.some((x) => x.kind === 'seuil' || x.kind === 'fractionne')).toBe(false)
  })
  it('allure de course : chrono visé sinon prédiction', () => {
    expect(racePaceFor(g({ targetTimeSec: 2700 }))).toBe(270)
    expect(racePaceFor(g({}), 42)).toBeGreaterThan(270)
  })
})
