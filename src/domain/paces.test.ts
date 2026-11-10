import { describe, expect, it } from 'vitest'
import { detrainedVdot, formatTime, predictTimeSec, trainingPaces, vdotFromPerformance, DISTANCES } from './paces'

describe('VDOT', () => {
  it('valeurs de référence des tables de Daniels (±1)', () => {
    // 5 km en 20:00 ≈ VDOT 49.8 ; semi en 1h40 ≈ 45 ; marathon 3h34 ≈ 43
    expect(vdotFromPerformance(5000, 1200)).toBeCloseTo(49.8, 0)
    expect(vdotFromPerformance(DISTANCES.semi, 6000)).toBeGreaterThan(44)
    expect(vdotFromPerformance(DISTANCES.semi, 6000)).toBeLessThan(46)
    expect(vdotFromPerformance(DISTANCES.marathon, 3 * 3600 + 34 * 60)).toBeGreaterThan(42)
    expect(vdotFromPerformance(DISTANCES.marathon, 3 * 3600 + 34 * 60)).toBeLessThan(44)
  })
  it('prédiction cohérente (aller-retour)', () => {
    const v = vdotFromPerformance(10000, 45 * 60)
    expect(Math.abs(predictTimeSec(v, 10000) - 2700)).toBeLessThan(2)
    // VDOT 50 → 10 km ≈ 41:2x selon les tables
    expect(formatTime(predictTimeSec(50, 10000))).toMatch(/^41:/)
  })
  it('allures d’entraînement ordonnées (facile > marathon > seuil > intervalles)', () => {
    const p = trainingPaces(45)
    expect(p.facile[1]).toBeGreaterThan(p.facile[0])
    expect(p.facile[0]).toBeGreaterThan(p.marathon)
    expect(p.marathon).toBeGreaterThan(p.seuil[1])
    expect(p.seuil[0]).toBeGreaterThan(p.intervalles[1])
    // Références : tables VDOT de Daniels
    expect(Math.abs(p.seuil[0] - 280)).toBeLessThan(8) // tables : seuil ≈ 4:40/km
    expect(Math.abs(p.marathon - 298)).toBeLessThan(8) // tables : marathon ≈ 4:58/km
    expect(Math.abs(p.intervalles[0] - 258)).toBeLessThan(8) // tables : intervalles ≈ 4:18/km
  })
  it('désentraînement : 26 semaines d’arrêt → −20 % max', () => {
    expect(detrainedVdot(45, 1)).toBe(45)
    expect(detrainedVdot(45, 12)).toBeCloseTo(40.5, 5)
    expect(detrainedVdot(45, 26)).toBeCloseTo(36, 5)
  })
  it('format des temps', () => {
    expect(formatTime(6000)).toBe('1h40')
    expect(formatTime(1325)).toBe('22:05')
  })
})

import { parseTime } from './paces'
describe('saisie des temps', () => {
  it('formats courants', () => {
    expect(parseTime('45:00')).toBe(2700)
    expect(parseTime('1:45:00')).toBe(6300)
    expect(parseTime('1h45')).toBe(6300)
    expect(parseTime('3h34m10')).toBe(12850)
    expect(parseTime("23'30")).toBe(1410)
    expect(parseTime('50')).toBe(3000)
    expect(parseTime('abc')).toBeUndefined()
  })
})
