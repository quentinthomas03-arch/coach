import { describe, expect, it } from 'vitest'
import { mapProduct, productByBarcode } from './openfoodfacts'

describe('Open Food Facts', () => {
  it('lit un produit', () => {
    expect(mapProduct({ code: '3017620422003', product_name_fr: 'Pâte à tartiner', brands: 'Marque, Autre', nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 }, serving_quantity: 15 })).toEqual({
      id: 'off-3017620422003', source: 'off', name: 'Pâte à tartiner', group: 'Marque', barcode: '3017620422003', kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9, portionG: 15,
    })
  })
  it('kJ seulement → kcal', () => {
    expect(mapProduct({ code: '1', product_name: 'X', nutriments: { energy_100g: 418.4 } })!.kcal).toBe(100)
  })
  it('produit inconnu ou incomplet', async () => {
    const f = async () => new Response(JSON.stringify({ status: 0 }), { status: 200 })
    expect(await productByBarcode('123', f as unknown as typeof fetch)).toBeUndefined()
    expect(mapProduct({ code: '1', product_name: 'Sans valeurs' })).toBeUndefined()
  })
})
