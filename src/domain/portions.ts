import type { FoodItem } from '../data/types'
import { norm } from './foodSearch'

/**
 * PORTIONS « NORMALES » SANS PESER.
 * Repères de portions courantes pour un adulte (inspirés des tailles de portions usuelles
 * en France : assiette, tranche, pot, verre…). Petite = ×0,7, grosse = ×1,4.
 * Si je règle une portion pour un aliment, elle remplace ce repère.
 */

export type PortionSize = 'petite' | 'normale' | 'grosse'
export const PORTION_FACTOR: Record<PortionSize, number> = { petite: 0.7, normale: 1, grosse: 1.4 }

interface Rule {
  test: RegExp
  g: number
  label: string
}

// Mots-clés dans le nom (prioritaires), puis famille Ciqual.
const NAME_RULES: Rule[] = [
  { test: /\b(huile|vinaigrette)\b/, g: 10, label: '1 cuillère à soupe' },
  { test: /\b(beurre|margarine)\b/, g: 10, label: '1 noisette' },
  { test: /\b(mayonnaise|ketchup|moutarde|sauce)\b/, g: 20, label: '1 cuillère à soupe' },
  { test: /\b(sucre|miel|confiture|pate a tartiner)\b/, g: 15, label: '1 cuillère' },
  { test: /\b(cafe|the|infusion|tisane)\b/, g: 150, label: '1 tasse' },
  { test: /\b(soupe|veloute|potage|bouillon)\b/, g: 300, label: '1 bol' },
  { test: /\b(yaourt|yogourt|petit suisse|skyr)\b/, g: 125, label: '1 pot' },
  { test: /\b(fromage blanc|faisselle)\b/, g: 150, label: '1 ramequin' },
  { test: /\b(compote)\b/, g: 100, label: '1 pot' },
  { test: /\b(baguette|pain)\b/, g: 50, label: '1 tranche ou ¼ de baguette' },
  { test: /\b(biscotte)\b/, g: 20, label: '2 biscottes' },
  { test: /\b(croissant|pain au chocolat|brioche|viennoiserie)\b/, g: 60, label: '1 pièce' },
  { test: /\b(pizza|quiche|tarte salee|tarte flambee)\b/, g: 200, label: '1 part' },
  { test: /\b(sandwich|croque|burger|wrap|kebab)\b/, g: 220, label: '1 pièce' },
  { test: /\b(steak hache)\b/, g: 100, label: '1 steak' },
  { test: /\b(jambon)\b/, g: 45, label: '1 tranche' },
  { test: /\b(saucisse|merguez|chipolata)\b/, g: 100, label: '2 pièces' },
  { test: /\b(poisson pane|nuggets|croquette)\b/, g: 120, label: '2 pièces' },
  { test: /\b(chocolat)\b/, g: 20, label: '2 carrés' },
  { test: /\b(amande|noix|noisette|cacahuete|pistache|graines)\b/, g: 25, label: '1 poignée' },
  { test: /^(?!.*\bcuit)(?=.*\b(pates|riz|semoule|quinoa|lentille|boulgour)\b)(?=.*\b(cru|crue|crus|crues|sec|seche|seches)\b)/, g: 80, label: 'poids sec' },
  { test: /\b(puree|ecrase)\b/, g: 200, label: '1 assiette' },
  { test: /\b(frites)\b/, g: 150, label: '1 barquette moyenne' },
  { test: /\b(salade)\b.*\b(laitue|verte|mache|batavia)\b|\b(laitue|mache|roquette)\b/, g: 60, label: '1 bol' },
]

const GROUP_RULES: { test: RegExp; g: number; label: string }[] = [
  { test: /^Viandes|^Charcuteries/, g: 120, label: '1 morceau' },
  { test: /^Poissons|^Produits à base de poissons|^Mollusques/, g: 130, label: '1 filet' },
  { test: /^Pâtes, riz et céréales|^Légumineuses/, g: 200, label: '1 assiette (cuit)' },
  { test: /^Pommes de terre/, g: 200, label: '1 assiette' },
  { test: /^Légumes|^Salades composées/, g: 150, label: '1 accompagnement' },
  { test: /^Fruits à coque/, g: 25, label: '1 poignée' },
  { test: /^Fruits/, g: 150, label: '1 fruit' },
  { test: /^Fromages/, g: 30, label: '1 portion' },
  { test: /^Produits laitiers frais/, g: 125, label: '1 pot' },
  { test: /^Laits/, g: 200, label: '1 verre' },
  { test: /^Plats composés|^Petits pots/, g: 300, label: '1 assiette' },
  { test: /^Pizzas, tartes/, g: 200, label: '1 part' },
  { test: /^Sandwichs/, g: 220, label: '1 pièce' },
  { test: /^Soupes/, g: 300, label: '1 bol' },
  { test: /^Boissons|^Eaux|^Boisson alcoolisées/, g: 250, label: '1 verre' },
  { test: /^Sauces|^Condiments|^Aides culinaires/, g: 20, label: '1 cuillère' },
  { test: /^Huiles|^Beurres|^Margarines|^Autres matières grasses|^Crèmes/, g: 15, label: '1 cuillère' },
  { test: /^Sucres|^Confitures|^Confiseries/, g: 15, label: '1 cuillère' },
  { test: /^Biscuits|^Barres/, g: 30, label: '3-4 biscuits' },
  { test: /^Gâteaux et pâtisseries|^Desserts|^Glaces|^Sorbets/, g: 100, label: '1 part' },
  { test: /^Céréales de petit-déjeuner/, g: 40, label: '1 bol' },
  { test: /^Chocolats/, g: 20, label: '2 carrés' },
  { test: /^Pains|^Viennoiseries/, g: 50, label: '1 tranche' },
  { test: /^Feuilletées/, g: 100, label: '1 pièce' },
  { test: /^Herbes|^Épices|^Sels/, g: 2, label: 'une pincée' },
]

export interface Portion {
  g: number
  label: string
}

/** Portion normale d'un aliment. Priorité : ma portion habituelle > produit (portion indiquée) > repères. */
export function normalPortion(f: Pick<FoodItem, 'name' | 'group' | 'portionG' | 'source'>): Portion {
  if (f.portionG && f.portionG > 0) return { g: Math.round(f.portionG), label: f.source === 'off' ? 'portion indiquée sur le paquet' : 'ta portion habituelle' }
  if (f.group === 'Recette') return { g: 350, label: '1 assiette' }
  const n = ` ${norm(f.name)} `
  const byName = NAME_RULES.find((r) => r.test.test(n))
  if (byName) return { g: byName.g, label: byName.label }
  const byGroup = GROUP_RULES.find((r) => r.test.test(f.group ?? ''))
  if (byGroup) return { g: byGroup.g, label: byGroup.label }
  return { g: 100, label: '1 portion' }
}

export function portionGrams(f: Pick<FoodItem, 'name' | 'group' | 'portionG' | 'source'>, size: PortionSize): number {
  return Math.round((normalPortion(f).g * PORTION_FACTOR[size]) / 5) * 5
}
