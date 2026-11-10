import type { FoodItem } from '../data/types'
import { norm, searchFoods } from './foodSearch'

/**
 * « DÉCRIS TON REPAS » : une phrase → une liste d'aliments.
 * ex. « colin d'Alaska pané, écrasé de pommes de terre et fondue de poireaux »
 *   → Poisson pané · Purée de pomme de terre · Fondue de poireau
 *
 * 1. Découpage sur les virgules, « et », « avec », « + », retours à la ligne.
 * 2. Traduction des mots du quotidien vers le vocabulaire de la table Ciqual (synonymes).
 * 3. Recherche ; si rien ne correspond, on retire les mots les moins utiles un par un.
 * Le meilleur résultat est proposé, avec des alternatives à un tap.
 */

/** Expressions courantes → termes Ciqual (appliquées sur le texte normalisé, sans accents). */
const SYNONYMS: [RegExp, string][] = [
  [/\b(ecrase|ecrasee|ecrases)( de)?( pommes? de terre| patates?)?\b/, 'puree pomme de terre'],
  [/\bpuree( de)? (pommes? de terre|patates?)\b/, 'puree pomme de terre'],
  [/\bpatates?\b/, 'pomme de terre'],
  [/\b(pommes? de terre|patates?) (vapeur|a l eau)\b/, 'pomme de terre bouillie'],
  [/\bfondue de poireaux?\b/, 'fondue poireau'],
  [/\b(colin|lieu|cabillaud|merlu|poisson)( d alaska)? panes?\b/, 'poisson pane'],
  [/\bfish ?sticks?\b|\bbatonnets? de poisson\b/, 'poisson pane'],
  [/\bsteak hache\b|\bsteak\b(?! de)/, 'steak hache 15'],
  [/^(spaghettis?|tagliatelles?|pennes?|coquillettes?|macaronis?|fusillis?)$/, 'pates seches standard cuites'],
  [/^pates$/, 'pates seches standard cuites'],
  [/^riz$/, 'riz blanc cuit'],
  [/^semoule$/, 'semoule couscous cuite'],
  [/^quinoa$/, 'quinoa cuit'],
  [/^lentilles?$/, 'lentille verte cuite'],
  [/\bharicots verts\b/, 'haricot vert cuit'],
  [/^(carottes?)$/, 'carotte cuite'],
  [/^(courgettes?)$/, 'courgette cuite'],
  [/^(brocolis?)$/, 'brocoli cuit'],
  [/^(epinards?)$/, 'epinard cuit'],
  [/^(petits pois)$/, 'petits pois cuits'],
  [/^salade( verte)?$/, 'laitue crue'],
  [/^tomates?$/, 'tomate crue'],
  [/^(pomme|poire|banane|orange|kiwi|clementine|peche|abricot)s?$/, '$1 crue'],
  [/^yaourt$/, 'yaourt nature'],
  [/^yaourt nature$/, 'yaourt lait fermente nature'],
  [/^fromage$/, 'emmental'],
  [/^pain$/, 'pain aliment moyen'],
  [/^baguette$/, 'pain blanc baguette'],
  [/^cafe$/, 'cafe expresso'],
  [/^the$/, 'the infuse'],
  [/^jambon$/, 'jambon cuit superieur'],
  [/^poulet$/, 'poulet filet grille'],
  [/^(dinde)$/, 'dinde escalope'],
  [/^(saumon)$/, 'saumon cuit'],
  [/^thon$/, 'thon naturel'],
  [/^vinaigrette$/, 'sauce vinaigrette'],
  [/\bbeurre$/, 'beurre doux 80'],
  [/^(burger|hamburger|big mac|whopper)$/, 'hamburger restauration rapide'],
  [/^(coca|cola|soda|coca cola|pepsi|limonade)$/, 'boisson gazeuse aromatisee sans fruit sucree'],
  [/^(coca|soda|pepsi) (zero|light)$/, 'boisson gazeuse aromatisee sans fruit sans sucres ajoutes'],
  [/^(biere|pinte|demi)$/, 'biere coeur de marche'],
  [/^(verre de )?vin( rouge)?$/, 'vin rouge'],
  [/^poke( bowl)?$/, 'poke bowl'],
  [/^chips$/, 'chips pommes de terre nature'],
  [/^kebab$/, 'sandwich grec kebab'],
  [/^sushis?|makis?$/, 'sushi maki'],
]

const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'd', 'l', 'au', 'aux', 'a', 'en', 'mon', 'ma', 'mes', 'petit', 'petite', 'gros', 'grosse', 'bon', 'bonne', 'fait', 'maison', 'peu', 'plat', 'assiette'])

export function splitMeal(text: string): string[] {
  return text
    .split(/,|;|\n|\+|\bet\b|\bavec\b|\bpuis\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
}

export function translate(segment: string): string {
  let n = norm(segment)
  for (const [re, rep] of SYNONYMS) {
    if (re.test(n)) {
      n = n.replace(re, rep)
      break
    }
  }
  return n
}

export interface ParsedItem {
  input: string
  best?: FoodItem
  alternatives: FoodItem[]
}

/** Sous-ensembles de mots de taille k (ordre conservé), ceux qui gardent le 1er mot d'abord. */
function subsets(tokens: string[], k: number): string[][] {
  const out: string[][] = []
  const rec = (start: number, acc: string[]) => {
    if (acc.length === k) return void out.push(acc)
    for (let i = start; i < tokens.length; i++) rec(i + 1, [...acc, tokens[i]])
  }
  rec(0, [])
  return out.sort((a, b) => Number(b[0] === tokens[0]) - Number(a[0] === tokens[0]))
}

/** Recherche tolérante : tous les mots utiles, puis on en retire le moins possible jusqu'à trouver. */
export function findFood(segment: string, foods: FoodItem[]): FoodItem[] {
  const q = translate(segment)
  const tokens = q.split(' ').filter((t) => t && !STOP.has(t)).slice(0, 6)
  const ok = (f: FoodItem) => f.kcal > 0 || /eau|the|cafe|infus/.test(norm(f.name))
  for (let keep = tokens.length; keep >= 1; keep--) {
    for (const sub of subsets(tokens, keep)) {
      const r = searchFoods(sub.join(' '), foods, 8).filter(ok)
      if (r.length) return r
    }
  }
  return []
}

export function parseMeal(text: string, foods: FoodItem[]): ParsedItem[] {
  return splitMeal(text).map((input) => {
    const r = findFood(input, foods)
    return { input, best: r[0], alternatives: r.slice(1, 6) }
  })
}
