import type { FoodItem } from '../data/types'

/**
 * Open Food Facts (base collaborative et gratuite des produits emballés).
 * API publique, sans clé. On n'envoie que le code-barres ou le texte recherché.
 */
const BASE = 'https://world.openfoodfacts.org'
const FIELDS = 'code,product_name,product_name_fr,brands,nutriments,serving_quantity'

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined)

export function mapProduct(p: Record<string, unknown>): FoodItem | undefined {
  const nut = (p.nutriments ?? {}) as Record<string, unknown>
  const kcal = n(nut['energy-kcal_100g']) ?? (n(nut['energy_100g']) != null ? n(nut['energy_100g'])! / 4.184 : undefined)
  const name = (p.product_name_fr || p.product_name) as string | undefined
  const code = p.code as string | undefined
  if (!name || kcal == null || !code) return undefined
  return {
    id: `off-${code}`,
    source: 'off',
    name: String(name).trim(),
    group: typeof p.brands === 'string' ? p.brands.split(',')[0].trim() : undefined,
    barcode: code,
    kcal: Math.round(kcal),
    protein: Math.round((n(nut['proteins_100g']) ?? 0) * 10) / 10,
    carbs: Math.round((n(nut['carbohydrates_100g']) ?? 0) * 10) / 10,
    fat: Math.round((n(nut['fat_100g']) ?? 0) * 10) / 10,
    portionG: n(p.serving_quantity),
  }
}

export class OffError extends Error {}

export async function productByBarcode(code: string, fetchFn: typeof fetch = fetch): Promise<FoodItem | undefined> {
  let res: Response
  try {
    res = await fetchFn(`${BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`)
  } catch {
    throw new OffError('Open Food Facts injoignable (réseau).')
  }
  if (res.status === 404) return undefined
  if (!res.ok) throw new OffError(`Open Food Facts : erreur ${res.status}.`)
  const data = (await res.json()) as { status?: number; product?: Record<string, unknown> }
  if (!data.product || data.status === 0) return undefined
  return mapProduct({ ...data.product, code })
}

export async function searchProducts(q: string, fetchFn: typeof fetch = fetch): Promise<FoodItem[]> {
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&json=1&page_size=20&fields=${FIELDS}&countries_tags_en=france`
  let res: Response
  try {
    res = await fetchFn(url)
  } catch {
    throw new OffError('Open Food Facts injoignable (réseau).')
  }
  if (!res.ok) throw new OffError(`Open Food Facts : erreur ${res.status}.`)
  const data = (await res.json()) as { products?: Record<string, unknown>[] }
  return (data.products ?? []).map(mapProduct).filter((x): x is FoodItem => !!x)
}
