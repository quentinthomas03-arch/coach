import { describe, expect, it } from 'vitest'
import type { FoodItem } from '../data/types'
import { forGrams, norm, searchFoods } from './foodSearch'

const f = (id: string, name: string, over: Partial<FoodItem> = {}): FoodItem => ({ id, source: 'ciqual', name, kcal: 100, protein: 1, carbs: 1, fat: 1, ...over })
const foods = [
  f('1', 'Pâtes sèches, cuites, sans sel ajouté'),
  f('2', 'Pâtes sèches, crues'),
  f('3', 'Pâte feuilletée, crue'),
  f('4', 'Tomate, crue'),
  f('5', 'Sauce tomate aux légumes'),
  f('6', 'Riz blanc, cuit, sans sel ajouté'),
  f('7', 'Pâtes fraîches maison', { source: 'perso', usageCount: 4 }),
]

describe('recherche d’aliments', () => {
  it('ignore accents et pluriels', () => {
    expect(norm('Pâtes Fraîches')).toBe('pates fraiches')
    expect(searchFoods('pates cuites', foods).map((x) => x.id)).toEqual(['1'])
    expect(searchFoods('tomates', foods).map((x) => x.id)[0]).toBe('4')
  })
  it('mes aliments fréquents passent devant', () => {
    expect(searchFoods('pates', foods)[0].id).toBe('7')
  })
  it('requête vide', () => {
    expect(searchFoods('  ', foods)).toEqual([])
  })
  it('quantités', () => {
    expect(forGrams({ kcal: 155, protein: 3.2, carbs: 33.2, fat: 0.7 }, 150)).toEqual({ kcal: 233, protein: 4.8, carbs: 49.8, fat: 1.1 })
  })
})
