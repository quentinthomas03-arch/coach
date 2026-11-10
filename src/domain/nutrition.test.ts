import { describe, expect, it } from 'vitest'
import { bmr, checkWeightGoal, dayTargets, fuelingTips, hydrationTarget, sessionKcal, type NutritionProfile } from './nutrition'

const me: NutritionProfile = { sex: 'homme', age: 34, heightCm: 175, weightKg: 75, activity: 'sedentaire', goal: 'maintien' }

describe('besoins', () => {
  it('Mifflin-St Jeor', () => {
    expect(bmr(me)).toBe(Math.round(750 + 1093.75 - 170 + 5))
    expect(bmr({ ...me, sex: 'femme' })).toBe(Math.round(750 + 1093.75 - 170 - 161))
  })
  it('dépense des séances', () => {
    expect(sessionKcal({ kind: 'course', minutes: 30, distanceKm: 5 }, 75)).toBe(375)
    expect(sessionKcal({ kind: 'marche-course', minutes: 31 }, 75)).toBe(Math.round((5 * 3.5 * 75 * 31) / 200))
  })
  it('jour de repos vs jour de sortie longue', () => {
    const rest = dayTargets(me, [])
    const long = dayTargets(me, [{ kind: 'course', minutes: 80, distanceKm: 11 }])
    expect(rest.dayType).toBe('repos')
    expect(long.dayType).toBe('soutenu')
    expect(long.kcal - rest.kcal).toBe(825)
    expect(long.carbs).toBeGreaterThan(rest.carbs)
    expect(rest.protein).toBe(120)
    // Les macros retombent sur les calories (±10 kcal d’arrondis).
    expect(Math.abs(rest.protein * 4 + rest.carbs * 4 + rest.fat * 9 - rest.kcal)).toBeLessThan(10)
  })
  it('perte : déficit plafonné et plancher de sécurité', () => {
    const t = dayTargets({ ...me, goal: 'perte' }, [])
    expect(t.tdee - t.kcal).toBeLessThanOrEqual(500)
    expect(t.kcal).toBeGreaterThanOrEqual(Math.max(t.bmr, 1500))
    const small = dayTargets({ sex: 'femme', age: 60, heightCm: 150, weightKg: 45, activity: 'sedentaire', goal: 'perte' }, [])
    expect(small.kcal).toBe(1200)
    expect(small.notes.join(' ')).toMatch(/plancher de sécurité/)
  })
})

describe('objectif de poids', () => {
  it('raisonnable : 75 → 72 kg en 12 semaines', () => {
    expect(checkWeightGoal(75, 72, 12, 175).verdict).toBe('raisonnable')
  })
  it('trop rapide et importante : 75 → 65 kg en 8 semaines', () => {
    const c = checkWeightGoal(75, 65, 8, 175)
    expect(c.verdict).toBe('trop-rapide')
    expect(c.earliestWeeks).toBe(18)
    expect(c.messages.join(' ')).toMatch(/médecin ou un diététicien/)
  })
  it('IMC visé trop bas → avis médical', () => {
    expect(checkWeightGoal(60, 55, 20, 175).messages.join(' ')).toMatch(/IMC inférieur à 18,5/)
  })
})

describe('hydratation et repères', () => {
  it('base + séance + chaleur', () => {
    expect(hydrationTarget(75, 0).ml).toBe(2250)
    expect(hydrationTarget(75, 60).ml).toBe(2750)
    expect(hydrationTarget(75, 60, 31).ml).toBe(2250 + 750 + 500)
  })
  it('repères selon la durée, sans les aliments que je n’aime pas', () => {
    const t = fuelingTips(100, false, 'course', ['banane'])
    expect(t.pendant[0]).toMatch(/30 à 60 g de glucides/)
    expect(t.avant.join(' ')).not.toMatch(/banane/)
    expect(fuelingTips(30, false, 'course').pendant[0]).toMatch(/Pas besoin de manger/)
  })
})
