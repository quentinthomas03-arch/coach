import type { FoodItem } from '../data/types'

/** Normalise pour la recherche : minuscules, sans accents ni ponctuation. */
export function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Variantes simples singulier/pluriel (« pates » trouve « pâtes », « tomates » trouve « tomate »). */
function stem(t: string) {
  return t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t
}

/**
 * Recherche plein texte : tous les mots doivent apparaître (début de mot).
 * Classement : mes aliments utilisés/favoris d'abord, puis nom qui commence par la requête,
 * puis aliments « bruts / cuits » courants, puis noms courts.
 */
export function searchFoods(query: string, foods: FoodItem[], limit = 30): FoodItem[] {
  const tokens = norm(query).split(' ').filter(Boolean).map(stem)
  if (!tokens.length) return []
  const scored: { f: FoodItem; score: number }[] = []
  for (const f of foods) {
    const n = norm(f.name)
    const words = n.split(' ')
    if (!tokens.every((t) => words.some((w) => w.startsWith(t)))) continue
    let score = 0
    if (f.favorite) score += 1000
    score += Math.min(500, (f.usageCount ?? 0) * 50)
    if (stem(words[0]).startsWith(tokens[0])) score += 200
    if (/\b(cru|crue|cuit|cuite|nature|frais|fraiche)\b/.test(n)) score += 30
    if (/\b(aliment moyen)\b/.test(n)) score += 40
    score -= n.length * 0.5
    scored.push({ f, score })
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.f)
}

/** Valeurs nutritionnelles pour une quantité donnée. */
export function forGrams(f: Pick<FoodItem, 'kcal' | 'protein' | 'carbs' | 'fat'>, grams: number) {
  const k = grams / 100
  const r = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10
  return { kcal: Math.round(f.kcal * k), protein: r(f.protein * k), carbs: r(f.carbs * k), fat: r(f.fat * k) }
}
