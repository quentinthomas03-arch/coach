import { describe, expect, it } from 'vitest'
import type { Activity, PlannedSession } from '../data/types'
import { addDays } from './dates'
import { analyzeRun, easyTarget } from './runAnalysis'
import { fitnessSeries, recoveryHours, recoveryLeft, trainingStatus } from './fitnessModel'
import type { LoadEntry } from './load'

const session = (kind: PlannedSession['kind'], target?: [number, number]): PlannedSession => ({
  id: 's', date: '2026-12-02', kind, title: '', durationMin: 45, reasons: [], status: 'done', externalId: '', sync: { status: 'sent' },
  workout: { blocks: [{ role: 'main', steps: [{ label: 'Endurance facile', durationSec: 2400, target: target ? { kind: 'pace', fastSecPerKm: target[0], slowSecPerKm: target[1] } : { kind: 'hrZone', zone: 2 } }] }] },
})
const act = (km: number, min: number, hr?: number): Activity => ({ id: 'a', date: '2026-12-02', type: 'Run', durationSec: min * 60, distanceM: km * 1000, avgHr: hr })

describe('analyse des sorties', () => {
  it('fourchette lue dans la séance', () => {
    expect(easyTarget(session('endurance', [400, 440]))).toEqual([400, 440])
  })
  it('séance facile courue trop vite', () => {
    const r = analyzeRun(act(7, 42), session('endurance', [400, 440]), 186) // 6:00/km
    expect(r.verdict).toBe('trop-vite')
    expect(r.text).toMatch(/40 s\/km plus vite/)
  })
  it('dans la cible', () => {
    expect(analyzeRun(act(6, 42), session('endurance', [400, 440]), 186).verdict).toBe('dans-la-cible') // 7:00/km
  })
  it('marche-course trop intense à la FC', () => {
    const r = analyzeRun(act(4, 35, 165), session('marche-course'), 186)
    expect(r).toMatchObject({ verdict: 'trop-intense', suggest: 'trop-rapide' })
  })
  it('séance écourtée signalée sans reproche', () => {
    expect(analyzeRun(act(3, 20), session('endurance', [400, 440]), 186).text).toMatch(/écourtée.*pas grave/)
  })
})

describe('condition, fatigue, fraîcheur', () => {
  const day0 = '2026-10-01'
  const regular: LoadEntry[] = Array.from({ length: 60 }, (_, i) => i).filter((i) => i % 2 === 0).map((i) => ({ date: addDays(day0, i), minutes: 40, rpe: 4, load: 160 + i * 2, run: true, source: 'manuel' }))
  it('progression régulière → productif, fraîcheur légèrement négative', () => {
    const s = fitnessSeries(regular, addDays(day0, 30), addDays(day0, 59))
    expect(s[s.length - 1].condition).toBeGreaterThan(s[0].condition)
    expect(trainingStatus(s, regular, addDays(day0, 59))).toBe('productif')
  })
  it('gros bloc soudain → surcharge', () => {
    const spike = [...regular, ...Array.from({ length: 6 }, (_, i) => ({ date: addDays(day0, 60 + i), minutes: 90, rpe: 8, load: 720, run: true, source: 'manuel' as const }))]
    const s = fitnessSeries(spike, addDays(day0, 40), addDays(day0, 65))
    expect(trainingStatus(s, spike, addDays(day0, 65))).toBe('surcharge')
  })
  it('fenêtre d’affichage plus longue que l’historique : pas de fausse surcharge', () => {
    const s = fitnessSeries(regular, addDays(day0, -60), addDays(day0, 59))
    expect(trainingStatus(s, regular, addDays(day0, 59))).toBe('productif')
  })
  it('arrêt de 12 jours → désentraînement', () => {
    const s = fitnessSeries(regular, addDays(day0, 40), addDays(day0, 70))
    expect(trainingStatus(s, regular, addDays(day0, 70))).toBe('desentrainement')
  })
  it('temps de récupération', () => {
    expect(recoveryHours(40, 4)).toBe(12)
    expect(recoveryHours(100, 7)).toBe(48)
    const now = new Date('2026-12-02T20:00:00')
    expect(recoveryLeft([{ endAt: new Date('2026-12-02T08:00:00'), minutes: 100, rpe: 7 }], now)).toBe(36)
  })
})
