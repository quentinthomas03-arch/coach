import type { FoodItem } from '../data/types'
import type { NutrientTable } from './menu'

/**
 * PLATS COURANTS ABSENTS DE CIQUAL, composés à partir d'ingrédients Ciqual.
 * Valeurs estimées pour une portion « type » de restauration ; à affiner avec Open Food Facts
 * si c'est un produit emballé.
 */
interface Dish {
  id: string
  name: string
  /** [code Ciqual, grammes] */
  parts: [number, number][]
}

export const DISHES: Dish[] = [
  { id: 'tacos', name: 'Tacos (galette, viande hachée, frites, sauce fromagère)', parts: [[7815, 90], [6255, 110], [4030, 120], [12118, 30], [19431, 40]] },
  { id: 'poke', name: 'Poke bowl (riz, poisson cru, avocat, légumes, sauce soja)', parts: [[9104, 160], [26053, 100], [13004, 50], [20901, 15], [20009, 40], [20019, 40], [11104, 15]] },
  { id: 'ramen', name: 'Ramen (bouillon, nouilles, porc, légumes)', parts: [[25948, 350], [25243, 150], [28203, 60], [20039, 30], [20009, 20]] },
  { id: 'pad-thai', name: 'Pad thaï aux crevettes', parts: [[25243, 220], [10061, 80], [20009, 30], [17270, 10], [15000, 10]] },
  { id: 'bibimbap', name: 'Bibimbap (riz, bœuf, légumes)', parts: [[9104, 180], [6253, 80], [20059, 50], [20009, 40], [17270, 10]] },
  { id: 'bagel', name: 'Bagel jambon-fromage', parts: [[7000, 90], [28900, 40], [12118, 20], [16400, 5]] },
  { id: 'burger-maison', name: 'Burger maison (pain, steak haché, cheddar, crudités)', parts: [[7259, 75], [6255, 125], [12726, 20], [20584, 30], [20031, 10], [11008, 15]] },
]

export function dishFoods(table: NutrientTable): FoodItem[] {
  return DISHES.flatMap((d) => {
    let kcal = 0, protein = 0, carbs = 0, fat = 0, g = 0
    for (const [code, grams] of d.parts) {
      const n = table.get(code)
      if (!n) return []
      const k = grams / 100
      kcal += n.kcal * k
      protein += n.protein * k
      carbs += n.carbs * k
      fat += n.fat * k
      g += grams
    }
    const per = (x: number) => Math.round((x / g) * 1000) / 10
    return [{ id: `plat-${d.id}`, source: 'perso' as const, name: d.name, group: 'Plat courant (estimé)', kcal: Math.round((kcal / g) * 100), protein: per(protein), carbs: per(carbs), fat: per(fat), portionG: g }]
  })
}
