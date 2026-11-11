import { describe, expect, it } from 'vitest'
import { analyzeLaps, flattenSteps, parseLaps } from './laps'
import type { Workout } from './workout'

const w: Workout = {
  blocks: [
    { role: 'warmup', steps: [{ label: 'Footing', durationSec: 600, target: { kind: 'pace', fastSecPerKm: 400, slowSecPerKm: 440 } }] },
    { role: 'main', repeat: 3, steps: [{ label: 'Rapide', durationSec: 180, target: { kind: 'pace', fastSecPerKm: 280, slowSecPerKm: 290 } }, { label: 'Récup', durationSec: 120 }] },
    { role: 'cooldown', steps: [{ label: 'Retour au calme', durationSec: 300 }] },
  ],
}
const lap = (sec: number, pace: number) => ({ moving_time: sec, distance: (sec / pace) * 1000, average_speed: 1000 / pace, average_heartrate: 150 })

describe('tours de la montre', () => {
  it('lecture des deux formats Intervals.icu', () => {
    expect(parseLaps([lap(600, 420)])[0].pace).toBeCloseTo(420, 0)
    expect(parseLaps({ icu_intervals: [lap(600, 420)] })).toHaveLength(1)
    expect(parseLaps({ nope: 1 })).toEqual([])
  })
  it('étapes à plat', () => {
    expect(flattenSteps(w).map((s) => `${s.label}${s.rep ?? ''}`)).toEqual(['Footing', 'Rapide1', 'Récup1', 'Rapide2', 'Récup2', 'Rapide3', 'Récup3', 'Retour au calme'])
  })
  it('jugement étape par étape', () => {
    const laps = parseLaps([lap(600, 420), lap(180, 285), lap(120, 400), lap(180, 266), lap(120, 400), lap(180, 288), lap(120, 410), lap(300, 450)])
    const a = analyzeLaps(w, laps)
    expect(a.matched).toBe(true)
    expect(a.judged).toBe(4)
    expect(a.ok).toBe(3)
    expect(a.tooFast).toBe(1)
    expect(a.text).toMatch(/3\/4 étapes dans la fourchette\. 1 trop rapide \(jusqu’à 14 s\/km sous la fourchette, rapide n°2\)/)
  })
  it('séance non suivie en mode structuré : pas d’alignement', () => {
    expect(analyzeLaps(w, parseLaps([lap(2400, 420)])).matched).toBe(false)
  })
})
