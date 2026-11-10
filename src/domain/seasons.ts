/**
 * Fruits et légumes de saison en France métropolitaine (pleine saison, production locale).
 * Repères tirés des calendriers de saison usuels (Interfel, ADEME « Impact CO2 – fruits et légumes de saison »).
 * Mois : 1 = janvier … 12 = décembre.
 */
export interface Produce {
  id: string
  name: string
  kind: 'legume' | 'fruit'
  months: number[]
  /** Se conserve peu : à cuisiner en priorité. */
  fragile?: boolean
}

const range = (a: number, b: number): number[] => (a <= b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [...range(a, 12), ...range(1, b)])

export const PRODUCE: Produce[] = [
  { id: 'asperge', name: 'Asperges', kind: 'legume', months: range(4, 6), fragile: true },
  { id: 'aubergine', name: 'Aubergines', kind: 'legume', months: range(6, 9) },
  { id: 'betterave', name: 'Betteraves', kind: 'legume', months: range(7, 3) },
  { id: 'brocoli', name: 'Brocolis', kind: 'legume', months: range(6, 11), fragile: true },
  { id: 'butternut', name: 'Courges butternut', kind: 'legume', months: range(9, 2) },
  { id: 'carotte', name: 'Carottes', kind: 'legume', months: range(1, 12) },
  { id: 'celeri', name: 'Céleri-rave', kind: 'legume', months: range(9, 3) },
  { id: 'champignon', name: 'Champignons', kind: 'legume', months: range(9, 11), fragile: true },
  { id: 'chou', name: 'Chou vert', kind: 'legume', months: range(10, 3) },
  { id: 'chou-bruxelles', name: 'Choux de Bruxelles', kind: 'legume', months: range(10, 2) },
  { id: 'chou-fleur', name: 'Chou-fleur', kind: 'legume', months: range(9, 4) },
  { id: 'concombre', name: 'Concombres', kind: 'legume', months: range(5, 9) },
  { id: 'courgette', name: 'Courgettes', kind: 'legume', months: range(6, 9), fragile: true },
  { id: 'endive', name: 'Endives', kind: 'legume', months: range(10, 4) },
  { id: 'epinard', name: 'Épinards', kind: 'legume', months: [...range(3, 5), ...range(9, 11)], fragile: true },
  { id: 'fenouil', name: 'Fenouil', kind: 'legume', months: range(6, 11) },
  { id: 'haricot-vert', name: 'Haricots verts', kind: 'legume', months: range(6, 9), fragile: true },
  { id: 'mache', name: 'Mâche', kind: 'legume', months: range(10, 3), fragile: true },
  { id: 'navet', name: 'Navets', kind: 'legume', months: range(10, 3) },
  { id: 'oignon', name: 'Oignons', kind: 'legume', months: range(1, 12) },
  { id: 'panais', name: 'Panais', kind: 'legume', months: range(10, 3) },
  { id: 'petits-pois', name: 'Petits pois', kind: 'legume', months: range(5, 7), fragile: true },
  { id: 'poireau', name: 'Poireaux', kind: 'legume', months: range(9, 4) },
  { id: 'poivron', name: 'Poivrons', kind: 'legume', months: range(7, 9) },
  { id: 'pomme-de-terre', name: 'Pommes de terre', kind: 'legume', months: range(1, 12) },
  { id: 'potiron', name: 'Potiron', kind: 'legume', months: range(9, 1) },
  { id: 'radis', name: 'Radis', kind: 'legume', months: range(4, 7), fragile: true },
  { id: 'salade', name: 'Salade (laitue)', kind: 'legume', months: range(4, 10), fragile: true },
  { id: 'tomate', name: 'Tomates', kind: 'legume', months: range(7, 9) },
  { id: 'abricot', name: 'Abricots', kind: 'fruit', months: range(6, 8), fragile: true },
  { id: 'cerise', name: 'Cerises', kind: 'fruit', months: range(6, 7), fragile: true },
  { id: 'clementine', name: 'Clémentines', kind: 'fruit', months: range(11, 2) },
  { id: 'figue', name: 'Figues', kind: 'fruit', months: range(8, 10), fragile: true },
  { id: 'fraise', name: 'Fraises', kind: 'fruit', months: range(5, 7), fragile: true },
  { id: 'kiwi', name: 'Kiwis', kind: 'fruit', months: range(11, 3) },
  { id: 'melon', name: 'Melons', kind: 'fruit', months: range(6, 9) },
  { id: 'peche', name: 'Pêches', kind: 'fruit', months: range(7, 9), fragile: true },
  { id: 'poire', name: 'Poires', kind: 'fruit', months: range(8, 1) },
  { id: 'pomme', name: 'Pommes', kind: 'fruit', months: range(8, 4) },
  { id: 'prune', name: 'Prunes', kind: 'fruit', months: range(7, 9) },
  { id: 'raisin', name: 'Raisin', kind: 'fruit', months: range(8, 10) },
]

export const produceById = (id: string) => PRODUCE.find((p) => p.id === id)

export function inSeason(month: number, kind?: Produce['kind']): Produce[] {
  return PRODUCE.filter((p) => p.months.includes(month) && (!kind || p.kind === kind))
}
