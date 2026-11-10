import { describe, expect, it } from 'vitest'
import type { EquipmentId } from '../data/types'
import { EXERCISES, buildStrengthSession, formatPrescription, strengthDescription } from './strength'

const HOME: EquipmentId[] = ['tapis', 'kettlebell', 'elastiques', 'roue-abdos', 'escalier', 'mur']

describe('bibliothèque', () => {
  it('chaque exercice a une description d’une phrase et 5 niveaux', () => {
    for (const e of EXERCISES) {
      expect(e.levels).toHaveLength(5)
      expect(e.description.length).toBeGreaterThan(20)
      expect(e.description.trim().endsWith('.')).toBe(true)
    }
  })
  it('les fallbacks existent et ne demandent pas plus de matériel', () => {
    for (const e of EXERCISES.filter((x) => x.fallback)) {
      const f = EXERCISES.find((x) => x.id === e.fallback)!
      expect(f).toBeDefined()
      expect(f.equipment.length).toBeLessThanOrEqual(e.equipment.length)
    }
  })
})

describe('séances de renfo', () => {
  it('niveau 1 avec mon matériel : 5 exercices, entre 12 et 20 min', () => {
    for (const tpl of ['A', 'B'] as const) {
      const s = buildStrengthSession({ template: tpl, level: 1, equipment: HOME })
      expect(s.items).toHaveLength(5)
      expect(s.durationMin).toBeGreaterThanOrEqual(12)
      expect(s.durationMin).toBeLessThanOrEqual(20)
    }
  })
  it('les niveaux 3+ ajoutent le haut du corps et restent ≤ 25 min', () => {
    for (let l = 3; l <= 5; l++) {
      for (const tpl of ['A', 'B'] as const) {
        const s = buildStrengthSession({ template: tpl, level: l, equipment: HOME })
        expect(s.items.map((i) => i.exerciseId)).toContain('pompes-inclinees')
        expect(s.durationMin).toBeLessThanOrEqual(25)
      }
    }
  })
  it('remplace les exercices si le matériel manque', () => {
    const s = buildStrengthSession({ template: 'A', level: 2, equipment: ['tapis'] })
    const ids = s.items.map((i) => i.exerciseId)
    expect(ids).toContain('squat')
    expect(ids).toContain('mollets-sol')
    expect(s.items.find((i) => i.exerciseId === 'squat')?.replaced).toBe('Squat gobelet')
  })
  it('respecte le temps disponible en retirant des séries', () => {
    const s = buildStrengthSession({ template: 'B', level: 5, equipment: HOME, maxMinutes: 15 })
    expect(s.durationMin).toBeLessThanOrEqual(15)
    expect(s.items.every((i) => i.sets >= 1)).toBe(true)
  })
  it('trail : excentrique et équilibre', () => {
    const s = buildStrengthSession({ template: 'B', level: 2, equipment: HOME, trail: true })
    const ids = s.items.map((i) => i.exerciseId)
    expect(ids).toContain('descente-marche')
    expect(ids).toContain('equilibre')
    expect(s.durationMin).toBeLessThanOrEqual(20)
  })
  it('zones fragiles : exercice de prévention en premier, durée tenue', () => {
    const s = buildStrengthSession({ template: 'A', level: 2, equipment: HOME, zones: ['achille', 'dos'] })
    const ids = s.items.map((i) => i.exerciseId)
    expect(ids.slice(0, 2)).toEqual(['mollets-excentriques', 'bird-dog'])
    expect(s.durationMin).toBeLessThanOrEqual(20)
    // Sans escalier : version au sol.
    expect(buildStrengthSession({ template: 'A', level: 2, equipment: [], zones: ['achille'] }).items[0].exerciseId).toBe('mollets-sol')
  })
  it('fonctionne sans aucun matériel', () => {
    for (const tpl of ['A', 'B'] as const)
      for (let l = 1; l <= 5; l++) expect(buildStrengthSession({ template: tpl, level: l, equipment: [] }).items.length).toBeGreaterThanOrEqual(5)
  })
  it('semaine allégée : une série de moins', () => {
    const n = buildStrengthSession({ template: 'A', level: 2, equipment: HOME, maxMinutes: 60 })
    const d = buildStrengthSession({ template: 'A', level: 2, equipment: HOME, maxMinutes: 60, deload: true })
    d.items.forEach((it, k) => expect(it.sets).toBe(Math.max(1, n.items[k].sets - 1)))
    expect(d.durationMin).toBeLessThan(n.durationMin)
  })
  it('texte lisible', () => {
    const s = buildStrengthSession({ template: 'B', level: 1, equipment: HOME })
    expect(formatPrescription(s.items.find((i) => i.exerciseId === 'gainage-lateral')!)).toBe(
      '2 × 15 s par côté (sur les genoux), repos 30 s',
    )
    expect(strengthDescription(s)).toMatch(/^Renfo B · niveau 1/)
  })
})
