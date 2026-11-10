import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CoachDB } from '../data/db'
import type { FoodItem } from '../data/types'
import { addFood, addSavedMeal, copyMeal, getSavedMeals, nutritionDay, saveMeal, toggleFavorite } from './nutrition'

let n = 0
let database: CoachDB
const riz: FoodItem = { id: 'ciqual-9104', source: 'ciqual', name: 'Riz blanc, cuit', kcal: 155, protein: 3.2, carbs: 33.2, fat: 0.7 }
const poulet: FoodItem = { id: 'ciqual-36018', source: 'ciqual', name: 'Poulet, filet, cuit', kcal: 150, protein: 30, carbs: 0, fat: 3 }
beforeEach(async () => {
  database = new CoachDB(`nut-${n++}`)
  await database.open()
  await database.profile.put({ id: 'me', sex: 'homme', birthYear: 1992, heightCm: 175, weightKg: 75, injuries: [], foodDislikes: ['banane'], updatedAt: '' })
})
afterEach(() => database.delete())

describe('journal alimentaire', () => {
  it('ajout, favoris, totaux, objectifs du jour', async () => {
    await addFood('2026-11-17', 'dejeuner', riz, 150, database)
    await addFood('2026-11-17', 'dejeuner', poulet, 120, database)
    await toggleFavorite(riz, database)
    const d = await nutritionDay('2026-11-17', undefined, database)
    expect(d.eaten).toEqual({ kcal: 233 + 180, protein: 41, carbs: 50, fat: 5 })
    expect(d.targets!.dayType).toBe('repos')
    expect(d.hydration.ml).toBe(2250)
    const r = await database.foods.get('ciqual-9104')
    expect(r).toMatchObject({ favorite: true, usageCount: 1, portionG: 150 })
  })
  it('copier le repas d’hier et repas mémorisé', async () => {
    await addFood('2026-11-16', 'petit-dej', riz, 100, database)
    expect(await copyMeal('2026-11-16', '2026-11-17', 'petit-dej', database)).toBe(1)
    await saveMeal('2026-11-16', 'petit-dej', 'Mon petit-déj', database)
    const [saved] = await getSavedMeals(database)
    await addSavedMeal('2026-11-18', 'petit-dej', saved, database)
    expect(await database.foodLog.where('date').equals('2026-11-18').count()).toBe(1)
  })
  it('jour de séance : plus de calories, repères sans aliments exclus', async () => {
    await database.sessions.put({ id: 's', date: '2026-11-17', kind: 'sortie-longue', title: '', durationMin: 90, reasons: [], status: 'planned', externalId: '', sync: { status: 'sent' }, key: true })
    const d = await nutritionDay('2026-11-17', 28, database)
    expect(d.targets!.exerciseKcal).toBeGreaterThan(500)
    expect(d.hydration.ml).toBeGreaterThan(3000)
    expect(JSON.stringify(d.tips)).not.toMatch(/banane/)
  })
})
