/**
 * Base de recettes simples (1 portion), pensées pour un coureur :
 * rapides en semaine, quelques plats à cuisiner en avance, féculents la veille des séances longues.
 * Valeurs nutritionnelles calculées depuis la table Ciqual (codes des ingrédients).
 * Aucune recette à base d'œufs entiers, de saumon ni de fruits exotiques.
 */

export type Rayon = 'Fruits et légumes' | 'Boucherie / poissonnerie' | 'Crèmerie' | 'Épicerie' | 'Boulangerie'
export type RecipeTag = 'rapide' | 'batch' | 'feculents' | 'proteines' | 'vegetarien' | 'leger' | 'petit-dej'

export interface Ingredient {
  name: string
  /** Code Ciqual. */
  code: number
  /** Grammes par portion. */
  g: number
  rayon: Rayon
  /** Fruit/légume de saison correspondant (voir seasons.ts). */
  produce?: string
  /** Placard (huile, épices…) : pas ajouté automatiquement à la liste de courses. */
  pantry?: boolean
  /** Pour la liste de courses : nom et facteur d'achat (ex. pâtes : poids cuit → poids sec). */
  buy?: { name: string; factor: number }
}

export interface Recipe {
  id: string
  name: string
  minutes: number
  tags: RecipeTag[]
  /** Nombre de portions préparées d'un coup (batch : se garde 2-3 jours). */
  portions: number
  ingredients: Ingredient[]
  steps: string[]
}

const FL: Rayon = 'Fruits et légumes'
const BP: Rayon = 'Boucherie / poissonnerie'
const CR: Rayon = 'Crèmerie'
const EP: Rayon = 'Épicerie'
const BO: Rayon = 'Boulangerie'

// Ingrédients courants (codes Ciqual 2025)
const I = {
  pates: (g = 90): Ingredient => ({ name: 'Pâtes (poids cuit)', code: 9811, g: g * 2.4, rayon: EP, buy: { name: 'Pâtes', factor: 1 / 2.4 } }),
  pates_cplt: (g = 90): Ingredient => ({ name: 'Pâtes complètes (poids cuit)', code: 9871, g: g * 2.4, rayon: EP, buy: { name: 'Pâtes complètes', factor: 1 / 2.4 } }),
  riz: (g = 75): Ingredient => ({ name: 'Riz (poids cuit)', code: 9104, g: g * 2.6, rayon: EP, buy: { name: 'Riz', factor: 1 / 2.6 } }),
  riz_cplt: (g = 75): Ingredient => ({ name: 'Riz complet (poids cuit)', code: 9103, g: g * 2.5, rayon: EP, buy: { name: 'Riz complet', factor: 1 / 2.5 } }),
  quinoa: (g = 70): Ingredient => ({ name: 'Quinoa (poids cuit)', code: 9341, g: g * 2.7, rayon: EP, buy: { name: 'Quinoa', factor: 1 / 2.7 } }),
  semoule: (g = 70): Ingredient => ({ name: 'Semoule (poids cuit)', code: 9683, g: g * 2.5, rayon: EP, buy: { name: 'Semoule', factor: 1 / 2.5 } }),
  pdt: (g = 250): Ingredient => ({ name: 'Pommes de terre', code: 4048, g, rayon: FL, produce: 'pomme-de-terre' }),
  lentilles: (g = 200): Ingredient => ({ name: 'Lentilles vertes (poids cuit)', code: 20587, g, rayon: EP, buy: { name: 'Lentilles vertes', factor: 1 / 2.5 } }),
  corail: (g = 180): Ingredient => ({ name: 'Lentilles corail (poids cuit)', code: 20589, g, rayon: EP, buy: { name: 'Lentilles corail', factor: 1 / 2.5 } }),
  pois_chiches: (g = 150): Ingredient => ({ name: 'Pois chiches (boîte, égouttés)', code: 20532, g, rayon: EP }),
  haricots_rouges: (g = 150): Ingredient => ({ name: 'Haricots rouges (boîte, égouttés)', code: 20524, g, rayon: EP }),
  poulet: (g = 130): Ingredient => ({ name: 'Filet de poulet', code: 36018, g, rayon: BP }),
  dinde: (g = 130): Ingredient => ({ name: 'Escalope de dinde', code: 36306, g, rayon: BP }),
  hache: (g = 125): Ingredient => ({ name: 'Bœuf haché 5 %', code: 6251, g, rayon: BP }),
  porc: (g = 130): Ingredient => ({ name: 'Filet mignon de porc', code: 28203, g, rayon: BP }),
  jambon: (g = 80): Ingredient => ({ name: 'Jambon blanc', code: 28900, g, rayon: CR }),
  thon: (g = 110): Ingredient => ({ name: 'Thon au naturel (boîte)', code: 26039, g, rayon: EP }),
  cabillaud: (g = 150): Ingredient => ({ name: 'Cabillaud', code: 26025, g, rayon: BP }),
  colin: (g = 150): Ingredient => ({ name: 'Colin / lieu', code: 26192, g, rayon: BP }),
  maquereau: (g = 100): Ingredient => ({ name: 'Maquereau (boîte, filets)', code: 26123, g, rayon: EP }),
  tofu: (g = 150): Ingredient => ({ name: 'Tofu nature', code: 20904, g, rayon: CR }),
  feta: (g = 40): Ingredient => ({ name: 'Feta', code: 12066, g, rayon: CR }),
  mozza: (g = 60): Ingredient => ({ name: 'Mozzarella', code: 19590, g, rayon: CR }),
  parmesan: (g = 15): Ingredient => ({ name: 'Parmesan', code: 12120, g, rayon: CR }),
  emmental: (g = 25): Ingredient => ({ name: 'Emmental râpé', code: 12118, g, rayon: CR }),
  chevre: (g = 40): Ingredient => ({ name: 'Fromage de chèvre', code: 12820, g, rayon: CR }),
  creme: (g = 30): Ingredient => ({ name: 'Crème légère', code: 19431, g, rayon: CR }),
  fromage_blanc: (g = 150): Ingredient => ({ name: 'Fromage blanc 3 %', code: 19646, g, rayon: CR }),
  yaourt_grec: (g = 125): Ingredient => ({ name: 'Yaourt à la grecque nature', code: 19860, g, rayon: CR }),
  lait: (g = 200): Ingredient => ({ name: 'Lait demi-écrémé', code: 19033, g, rayon: CR }),
  avoine: (g = 50): Ingredient => ({ name: 'Flocons d’avoine', code: 32140, g, rayon: EP }),
  muesli: (g = 50): Ingredient => ({ name: 'Muesli', code: 32004, g, rayon: EP }),
  pain: (g = 80): Ingredient => ({ name: 'Pain complet', code: 7110, g, rayon: BO }),
  galette: (g = 2 * 50): Ingredient => ({ name: 'Galettes de sarrasin', code: 23801, g, rayon: EP }),
  tortilla: (g = 2 * 40): Ingredient => ({ name: 'Tortillas de blé', code: 7815, g, rayon: EP }),
  huile: (g = 10): Ingredient => ({ name: 'Huile d’olive', code: 17270, g, rayon: EP, pantry: true }),
  ail: (g = 3): Ingredient => ({ name: 'Ail', code: 11000, g, rayon: FL, pantry: true }),
  curry: (g = 3): Ingredient => ({ name: 'Curry en poudre', code: 11005, g, rayon: EP, pantry: true }),
  miel: (g = 10): Ingredient => ({ name: 'Miel', code: 31008, g, rayon: EP, pantry: true }),
  amandes: (g = 15): Ingredient => ({ name: 'Amandes', code: 15000, g, rayon: EP }),
  raisins_secs: (g = 15): Ingredient => ({ name: 'Raisins secs', code: 13046, g, rayon: EP }),
  sauce_tomate: (g = 120): Ingredient => ({ name: 'Sauce tomate', code: 11207, g, rayon: EP }),
  bouillon: (g = 300): Ingredient => ({ name: 'Bouillon de légumes', code: 25948, g, rayon: EP, pantry: true }),
  basilic: (g = 3): Ingredient => ({ name: 'Basilic frais', code: 11033, g, rayon: FL, pantry: true }),
  persil: (g = 3): Ingredient => ({ name: 'Persil frais', code: 11014, g, rayon: FL, pantry: true }),
  citron: (g = 20): Ingredient => ({ name: 'Citron', code: 13009, g, rayon: FL }),
  // Légumes et fruits de saison
  courgette: (g = 200): Ingredient => ({ name: 'Courgette', code: 20020, g, rayon: FL, produce: 'courgette' }),
  tomate: (g = 150): Ingredient => ({ name: 'Tomates', code: 20584, g, rayon: FL, produce: 'tomate' }),
  aubergine: (g = 200): Ingredient => ({ name: 'Aubergine', code: 20053, g, rayon: FL, produce: 'aubergine' }),
  poivron: (g = 120): Ingredient => ({ name: 'Poivron', code: 20087, g, rayon: FL, produce: 'poivron' }),
  haricots_verts: (g = 200): Ingredient => ({ name: 'Haricots verts', code: 20061, g, rayon: FL, produce: 'haricot-vert' }),
  carotte: (g = 150): Ingredient => ({ name: 'Carottes', code: 20009, g, rayon: FL, produce: 'carotte' }),
  poireau: (g = 200): Ingredient => ({ name: 'Poireaux', code: 20039, g, rayon: FL, produce: 'poireau' }),
  oignon: (g = 60): Ingredient => ({ name: 'Oignon', code: 20034, g, rayon: FL, produce: 'oignon' }),
  epinard: (g = 150): Ingredient => ({ name: 'Épinards', code: 20059, g, rayon: FL, produce: 'epinard' }),
  brocoli: (g = 200): Ingredient => ({ name: 'Brocoli', code: 20057, g, rayon: FL, produce: 'brocoli' }),
  chou_fleur: (g = 200): Ingredient => ({ name: 'Chou-fleur', code: 20016, g, rayon: FL, produce: 'chou-fleur' }),
  potiron: (g = 250): Ingredient => ({ name: 'Potiron', code: 20044, g, rayon: FL, produce: 'potiron' }),
  butternut: (g = 250): Ingredient => ({ name: 'Courge butternut', code: 20138, g, rayon: FL, produce: 'butternut' }),
  champignon: (g = 150): Ingredient => ({ name: 'Champignons de Paris', code: 20056, g, rayon: FL, produce: 'champignon' }),
  betterave: (g = 120): Ingredient => ({ name: 'Betterave cuite', code: 20003, g, rayon: FL, produce: 'betterave' }),
  navet: (g = 150): Ingredient => ({ name: 'Navets', code: 20064, g, rayon: FL, produce: 'navet' }),
  celeri: (g = 150): Ingredient => ({ name: 'Céleri-rave', code: 20055, g, rayon: FL, produce: 'celeri' }),
  endive: (g = 150): Ingredient => ({ name: 'Endives', code: 20026, g, rayon: FL, produce: 'endive' }),
  mache: (g = 60): Ingredient => ({ name: 'Mâche', code: 20099, g, rayon: FL, produce: 'mache' }),
  salade: (g = 60): Ingredient => ({ name: 'Salade', code: 20031, g, rayon: FL, produce: 'salade' }),
  concombre: (g = 150): Ingredient => ({ name: 'Concombre', code: 20019, g, rayon: FL, produce: 'concombre' }),
  fenouil: (g = 150): Ingredient => ({ name: 'Fenouil', code: 20028, g, rayon: FL, produce: 'fenouil' }),
  panais: (g = 150): Ingredient => ({ name: 'Panais', code: 20181, g, rayon: FL, produce: 'panais' }),
  chou: (g = 200): Ingredient => ({ name: 'Chou vert', code: 20069, g, rayon: FL, produce: 'chou' }),
  bruxelles: (g = 180): Ingredient => ({ name: 'Choux de Bruxelles', code: 20058, g, rayon: FL, produce: 'chou-bruxelles' }),
  petits_pois: (g = 120): Ingredient => ({ name: 'Petits pois', code: 20072, g, rayon: FL, produce: 'petits-pois' }),
  asperge: (g = 200): Ingredient => ({ name: 'Asperges', code: 20299, g, rayon: FL, produce: 'asperge' }),
  radis: (g = 80): Ingredient => ({ name: 'Radis', code: 20045, g, rayon: FL, produce: 'radis' }),
  pomme: (g = 150): Ingredient => ({ name: 'Pomme', code: 13039, g, rayon: FL, produce: 'pomme' }),
  poire: (g = 150): Ingredient => ({ name: 'Poire', code: 13037, g, rayon: FL, produce: 'poire' }),
  fraise: (g = 150): Ingredient => ({ name: 'Fraises', code: 13014, g, rayon: FL, produce: 'fraise' }),
  kiwi: (g = 100): Ingredient => ({ name: 'Kiwi', code: 13021, g, rayon: FL, produce: 'kiwi' }),
  clementine: (g = 150): Ingredient => ({ name: 'Clémentines', code: 13024, g, rayon: FL, produce: 'clementine' }),
  peche: (g = 150): Ingredient => ({ name: 'Pêche', code: 13043, g, rayon: FL, produce: 'peche' }),
  boulgour: (g = 70): Ingredient => ({ name: 'Boulgour (poids cuit)', code: 9691, g: g * 2.5, rayon: EP, buy: { name: 'Boulgour', factor: 1 / 2.5 } }),
  gnocchi: (g = 220): Ingredient => ({ name: 'Gnocchis', code: 25510, g, rayon: CR }),
  hache15: (g = 125): Ingredient => ({ name: 'Bœuf haché 15 %', code: 6255, g, rayon: BP }),
  onglet: (g = 150): Ingredient => ({ name: 'Onglet de bœuf', code: 6205, g, rayon: BP }),
  lardons: (g = 40): Ingredient => ({ name: 'Lardons', code: 28720, g, rayon: CR }),
  crevettes: (g = 120): Ingredient => ({ name: 'Crevettes cuites', code: 10061, g, rayon: BP }),
  reblochon: (g = 50): Ingredient => ({ name: 'Reblochon', code: 12045, g, rayon: CR }),
  cheddar: (g = 20): Ingredient => ({ name: 'Cheddar', code: 12726, g, rayon: CR }),
  bun: (g = 75): Ingredient => ({ name: 'Pain à burger', code: 7259, g, rayon: BO }),
  pate_pizza: (g = 120): Ingredient => ({ name: 'Pâte à pizza', code: 37001, g, rayon: CR }),
  chou_rouge: (g = 120): Ingredient => ({ name: 'Chou rouge', code: 20014, g, rayon: FL, produce: 'chou' }),
  frites_four: (g = 180): Ingredient => ({ name: 'Frites au four', code: 4030, g, rayon: EP }),
  saucisse: (g = 100): Ingredient => ({ name: 'Saucisse', code: 30051, g, rayon: BP }),
  comte: (g = 30): Ingredient => ({ name: 'Comté', code: 12110, g, rayon: CR }),
  moutarde: (g = 10): Ingredient => ({ name: 'Moutarde', code: 11013, g, rayon: EP, pantry: true }),
  sauce_soja: (g = 15): Ingredient => ({ name: 'Sauce soja', code: 11104, g, rayon: EP, pantry: true }),
}

const R = (id: string, name: string, minutes: number, tags: RecipeTag[], ingredients: Ingredient[], steps: string[], portions = 1): Recipe => ({
  id, name, minutes, tags, portions, ingredients, steps,
})

export const RECIPES: Recipe[] = [
  // --- Petits-déjeuners ---
  R('porridge-pomme', 'Porridge pomme-cannelle', 8, ['petit-dej', 'rapide', 'vegetarien', 'feculents'], [I.avoine(60), I.lait(250), I.pomme(), I.miel(10), I.amandes(10)], ['Cuire les flocons dans le lait 4 min en remuant.', 'Ajouter la pomme en dés, la cannelle et le miel.', 'Parsemer d’amandes concassées.']),
  R('fromage-blanc-muesli', 'Fromage blanc, muesli et fruit de saison', 3, ['petit-dej', 'rapide', 'vegetarien', 'proteines'], [I.fromage_blanc(200), I.muesli(40), I.kiwi()], ['Verser le fromage blanc dans un bol.', 'Ajouter le muesli et le fruit coupé.']),
  R('tartines-jambon', 'Tartines complètes jambon-fromage', 5, ['petit-dej', 'rapide', 'proteines'], [I.pain(90), I.jambon(50), I.emmental(20), I.clementine()], ['Toaster le pain.', 'Garnir de jambon et de fromage.', 'Un fruit de saison à côté.']),
  // --- Rapides (≤ 20 min) ---
  R('pates-thon-tomate', 'Pâtes au thon et à la tomate', 15, ['rapide', 'feculents', 'proteines'], [I.pates(100), I.thon(100), I.sauce_tomate(), I.oignon(40), I.huile(5), I.basilic()], ['Cuire les pâtes.', 'Faire revenir l’oignon, ajouter la sauce tomate et le thon émietté 5 min.', 'Mélanger aux pâtes, basilic frais.']),
  R('wok-poulet-legumes', 'Wok de poulet aux légumes et riz', 20, ['rapide', 'feculents', 'proteines'], [I.riz(75), I.poulet(), I.carotte(100), I.brocoli(150), I.oignon(40), I.huile(10), I.ail()], ['Cuire le riz.', 'Saisir le poulet en lamelles 5 min, réserver.', 'Faire sauter les légumes 6 à 8 min, remettre le poulet, un trait de sauce soja.']),
  R('galette-jambon-champi', 'Galettes de sarrasin jambon-champignons-fromage', 15, ['rapide', 'proteines'], [I.galette(), I.jambon(60), I.champignon(), I.emmental(25), I.salade(50)], ['Poêler les champignons émincés 5 min.', 'Réchauffer les galettes, garnir de jambon, champignons et fromage, plier.', 'Servir avec la salade.']),
  R('salade-pois-chiches', 'Salade de pois chiches, concombre et feta', 10, ['rapide', 'vegetarien', 'leger'], [I.pois_chiches(), I.concombre(), I.tomate(120), I.feta(40), I.huile(10), I.citron(10), I.pain(50)], ['Rincer les pois chiches.', 'Couper concombre et tomates en dés, émietter la feta.', 'Assaisonner huile-citron.']),
  R('quesadilla-haricots', 'Quesadillas haricots rouges et poivron', 15, ['rapide', 'vegetarien', 'feculents'], [I.tortilla(), I.haricots_rouges(120), I.poivron(), I.emmental(30), I.salade(40)], ['Écraser grossièrement les haricots avec un peu d’épices.', 'Garnir les tortillas de haricots, poivron en lamelles et fromage.', 'Dorer 2 à 3 min de chaque côté à la poêle.']),
  R('cabillaud-pdt-haricots', 'Cabillaud, pommes de terre vapeur et haricots verts', 20, ['rapide', 'proteines', 'leger'], [I.cabillaud(), I.pdt(220), I.haricots_verts(), I.huile(10), I.citron(15), I.persil()], ['Cuire pommes de terre et haricots à la vapeur 15 min.', 'Cuire le cabillaud à la poêle ou au four 8 min.', 'Huile, citron, persil.']),
  R('dinde-moutarde-semoule', 'Dinde à la moutarde, semoule et courgettes', 20, ['rapide', 'proteines', 'feculents'], [I.dinde(), I.semoule(70), I.courgette(), I.creme(25), I.huile(5)], ['Préparer la semoule à l’eau bouillante.', 'Poêler la dinde, ajouter crème + 1 c. à café de moutarde.', 'Courgettes en rondelles poêlées 8 min.']),
  R('tartines-maquereau', 'Tartines de maquereau et salade de mâche-betterave', 10, ['rapide', 'proteines', 'leger'], [I.pain(100), I.maquereau(), I.mache(), I.betterave(), I.huile(5)], ['Toaster le pain, écraser le maquereau dessus.', 'Salade de mâche et betterave en dés, vinaigrette légère.']),
  R('poelee-tofu-epinards', 'Tofu poêlé, épinards et riz complet', 20, ['rapide', 'vegetarien', 'proteines'], [I.tofu(), I.epinard(), I.riz_cplt(70), I.ail(), I.huile(10)], ['Cuire le riz.', 'Dorer le tofu en cubes 8 min.', 'Ajouter ail et épinards 3 min, servir sur le riz.']),
  R('salade-asperges-jambon', 'Asperges, pommes de terre et jambon', 20, ['rapide', 'proteines', 'leger'], [I.asperge(), I.pdt(200), I.jambon(70), I.huile(10)], ['Cuire asperges et pommes de terre à la vapeur.', 'Servir tiède avec le jambon et une vinaigrette.']),
  R('salade-tomate-mozza', 'Tomates-mozzarella, pâtes au pesto maison', 15, ['rapide', 'vegetarien', 'feculents'], [I.pates(90), I.tomate(200), I.mozza(80), I.basilic(5), I.huile(10), I.parmesan(10)], ['Cuire les pâtes.', 'Mixer basilic, huile, parmesan (pesto rapide).', 'Mélanger pâtes et pesto, tomates-mozzarella à côté.']),
  // --- À cuisiner en avance (3 portions) ---
  R('bolognaise', 'Bolognaise aux légumes (×3)', 35, ['batch', 'feculents', 'proteines'], [I.pates(100), I.hache(110), I.sauce_tomate(130), I.carotte(80), I.oignon(40), I.courgette(100), I.huile(5)], ['Faire revenir oignon et carotte râpée.', 'Ajouter la viande, puis la sauce tomate et la courgette en dés.', 'Mijoter 20 min. Se garde 3 jours au frais (cuire les pâtes au moment).'], 3),
  R('curry-corail', 'Dhal de lentilles corail à la tomate (×3)', 30, ['batch', 'vegetarien', 'feculents', 'proteines'], [I.corail(180), I.riz(60), I.tomate(100), I.oignon(40), I.carotte(80), I.curry(), I.huile(5)], ['Faire revenir oignon, curry et carotte.', 'Ajouter lentilles (sèches), tomates et 3 fois leur volume d’eau, 20 min.', 'Servir avec du riz. Se garde 3 jours.'], 3),
  R('chili', 'Chili con carne doux (×3)', 40, ['batch', 'feculents', 'proteines'], [I.hache(100), I.haricots_rouges(130), I.sauce_tomate(120), I.poivron(80), I.oignon(40), I.riz(60), I.huile(5)], ['Faire revenir oignon et poivron, puis la viande.', 'Ajouter sauce tomate, haricots, épices douces, 25 min.', 'Servir avec du riz. Encore meilleur réchauffé.'], 3),
  R('soupe-potiron', 'Velouté de potiron et pain-fromage (×3)', 35, ['batch', 'vegetarien', 'leger'], [I.potiron(300), I.pdt(100), I.oignon(30), I.bouillon(250), I.creme(20), I.pain(70), I.chevre(30)], ['Cuire potiron, pomme de terre et oignon dans le bouillon 25 min.', 'Mixer avec la crème.', 'Tartines de chèvre grillées à côté. Le velouté se garde 3 jours.'], 3),
  R('soupe-poireaux', 'Soupe poireaux-pommes de terre et jambon (×3)', 35, ['batch', 'leger'], [I.poireau(), I.pdt(180), I.bouillon(250), I.creme(15), I.jambon(60), I.pain(60)], ['Émincer poireaux et pommes de terre, cuire 25 min dans le bouillon.', 'Mixer ou laisser en morceaux, un peu de crème.', 'Jambon et pain à côté.'], 3),
  R('poulet-legumes-four', 'Poulet et légumes rôtis au four (×2)', 45, ['batch', 'proteines'], [I.poulet(140), I.pdt(200), I.carotte(100), I.panais(100), I.oignon(40), I.huile(10)], ['Couper légumes et pommes de terre, mélanger à l’huile et aux herbes.', 'Enfourner 25 min à 200 °C, ajouter le poulet 20 min.', 'Se garde 2 jours.'], 2),
  R('gratin-chou-fleur', 'Gratin de chou-fleur au jambon (×2)', 40, ['batch', 'proteines'], [I.chou_fleur(250), I.jambon(70), I.lait(120), I.emmental(30), I.pdt(150)], ['Cuire chou-fleur et pommes de terre à la vapeur 12 min.', 'Disposer avec le jambon, napper de lait épaissi (béchamel légère), fromage.', 'Gratiner 20 min à 200 °C.'], 2),
  R('ratatouille', 'Ratatouille et quinoa (×3)', 45, ['batch', 'vegetarien', 'feculents'], [I.aubergine(150), I.courgette(150), I.poivron(80), I.tomate(150), I.oignon(40), I.quinoa(60), I.huile(10), I.feta(30)], ['Faire revenir chaque légume séparément, puis réunir avec les tomates.', 'Mijoter 25 min.', 'Servir avec le quinoa et un peu de feta. Se garde 3 jours.'], 3),
  R('lentilles-carottes', 'Lentilles aux carottes et filet mignon (×2)', 40, ['batch', 'proteines', 'feculents'], [I.lentilles(200), I.carotte(120), I.oignon(40), I.porc(110), I.huile(5)], ['Cuire lentilles, carottes et oignon 25 min.', 'Saisir le filet mignon en médaillons.', 'Se garde 2 jours.'], 2),
  // --- Soirs ---
  R('pates-veille-sortie', 'Pâtes complètes, poulet et légumes (veille de sortie longue)', 20, ['feculents', 'proteines'], [I.pates_cplt(120), I.poulet(110), I.courgette(150), I.parmesan(10), I.huile(10)], ['Cuire les pâtes (bonne portion : réserve d’énergie pour demain).', 'Poêler poulet et légumes.', 'Mélanger, parmesan.']),
  R('colin-poireaux-riz', 'Colin à la fondue de poireaux et riz', 25, ['proteines', 'leger'], [I.colin(), I.poireau(), I.riz(65), I.creme(20), I.huile(5)], ['Faire fondre les poireaux 15 min avec un peu d’eau.', 'Cuire le riz et le poisson (vapeur ou poêle).', 'Servir le poisson sur la fondue.']),
  R('endives-jambon', 'Endives braisées, jambon et purée', 30, ['proteines'], [I.endive(250), I.jambon(80), I.pdt(220), I.lait(80), I.emmental(20)], ['Braiser les endives 20 min à couvert.', 'Préparer une purée maison.', 'Servir avec le jambon, gratiner si envie.']),
  R('poelee-bruxelles', 'Poêlée de choux de Bruxelles, pommes de terre et dinde', 30, ['proteines'], [I.bruxelles(), I.pdt(200), I.dinde(120), I.huile(10)], ['Blanchir les choux 8 min.', 'Poêler avec les pommes de terre en dés 12 min.', 'Ajouter la dinde en lanières 6 min.']),
  R('salade-recup', 'Bol récup : quinoa, poulet, légumes croquants et yaourt', 15, ['proteines', 'rapide'], [I.quinoa(70), I.poulet(120), I.carotte(80), I.radis(60), I.yaourt_grec(60), I.citron(10)], ['Cuire le quinoa (ou le prendre en avance).', 'Ajouter poulet émincé, carottes râpées, radis.', 'Sauce yaourt-citron.']),
  R('celeri-puree-porc', 'Purée céleri-pommes de terre et filet mignon', 30, ['proteines'], [I.celeri(), I.pdt(150), I.porc(), I.lait(60), I.huile(5)], ['Cuire céleri et pommes de terre 20 min, écraser avec le lait.', 'Saisir le filet mignon en médaillons 8 min.']),
  // --- Hiver ---
  R('salade-endives-chevre', 'Salade d’endives, pomme et chèvre chaud', 15, ['rapide', 'vegetarien', 'leger'], [I.endive(150), I.pomme(100), I.chevre(50), I.pain(80), I.huile(10), I.miel(5)], ['Émincer endives et pomme.', 'Toaster le pain avec le chèvre et un filet de miel.', 'Vinaigrette légère.']),
  R('veloute-carotte-corail', 'Velouté carottes-lentilles corail (×3)', 30, ['batch', 'vegetarien', 'proteines'], [I.carotte(200), I.corail(120), I.oignon(30), I.bouillon(250), I.pain(70), I.emmental(20)], ['Faire revenir l’oignon, ajouter carottes et lentilles sèches avec le bouillon.', 'Cuire 20 min, mixer.', 'Tartines gratinées à côté. Se garde 3 jours.'], 3),
  R('poelee-panais-poulet', 'Poêlée de panais et carottes au poulet, semoule', 25, ['proteines', 'feculents'], [I.panais(150), I.carotte(100), I.poulet(120), I.semoule(60), I.huile(10)], ['Couper panais et carottes en bâtonnets, poêler 15 min.', 'Ajouter le poulet en morceaux 8 min.', 'Servir avec la semoule.']),
  R('pates-butternut', 'Pâtes à la crème de butternut et jambon', 25, ['feculents', 'rapide'], [I.pates(100), I.butternut(200), I.creme(30), I.jambon(60), I.parmesan(10)], ['Cuire la butternut en dés 15 min, mixer avec la crème.', 'Cuire les pâtes, mélanger avec la sauce et le jambon en lanières.', 'Parmesan.']),
  // --- Plus de choix (plats du quotidien et plaisir) ---
  R('burger-maison', 'Burger maison et frites au four', 30, ['proteines', 'feculents'], [I.bun(), I.hache15(), I.cheddar(), I.tomate(40), I.salade(20), I.oignon(20), I.frites_four()], ['Cuire les frites au four (20-25 min).', 'Saisir le steak 3 min de chaque côté, cheddar dessus à la fin.', 'Monter le burger avec tomate, salade, oignon.']),
  R('onglet-echalote', 'Onglet de bœuf, pommes de terre sautées et haricots verts', 25, ['proteines', 'rapide'], [I.onglet(), I.pdt(220), I.haricots_verts(150), I.huile(10), I.oignon(30)], ['Pommes de terre en dés sautées 15 min.', 'Haricots verts à la vapeur.', 'Onglet saisi 2-3 min par face, oignon fondu dans la poêle.']),
  R('pizza-maison', 'Pizza maison jambon-champignons', 30, ['feculents'], [I.pate_pizza(), I.sauce_tomate(60), I.jambon(50), I.champignon(60), I.mozza(60), I.salade(40)], ['Étaler la pâte, sauce tomate.', 'Jambon, champignons, mozzarella.', '12-15 min à 230 °C, salade à côté.']),
  R('tartiflette-legere', 'Tartiflette allégée et salade', 40, ['feculents'], [I.pdt(250), I.lardons(30), I.oignon(40), I.reblochon(40), I.creme(20), I.salade(60)], ['Cuire les pommes de terre 15 min, les couper en rondelles.', 'Faire revenir lardons et oignons, mélanger.', 'Reblochon dessus, 20 min à 200 °C. Salade verte à côté.']),
  R('gnocchis-poelees', 'Gnocchis poêlés, épinards et parmesan', 15, ['rapide', 'vegetarien', 'feculents'], [I.gnocchi(), I.epinard(120), I.creme(20), I.parmesan(15), I.ail()], ['Dorer les gnocchis 6-8 min à la poêle.', 'Ajouter ail et épinards 2 min, un peu de crème.', 'Parmesan.']),
  R('crevettes-riz-ail', 'Crevettes sautées à l’ail, riz et brocoli', 20, ['rapide', 'proteines', 'feculents'], [I.crevettes(), I.riz(75), I.brocoli(150), I.ail(), I.huile(10), I.sauce_soja()], ['Cuire le riz et le brocoli.', 'Sauter les crevettes avec l’ail 3 min.', 'Un trait de sauce soja.']),
  R('saucisse-lentilles', 'Saucisse et lentilles aux carottes', 30, ['proteines', 'feculents'], [I.saucisse(), I.lentilles(180), I.carotte(100), I.oignon(30)], ['Cuire lentilles, carottes et oignon 25 min.', 'Dorer la saucisse à la poêle.', 'Moutarde à côté.']),
  R('fajitas-poulet', 'Fajitas de poulet aux poivrons', 25, ['proteines', 'feculents'], [I.tortilla(), I.poulet(120), I.poivron(120), I.oignon(40), I.yaourt_grec(40), I.huile(5)], ['Saisir poulet, poivrons et oignon en lanières avec des épices.', 'Garnir les tortillas, sauce yaourt.']),
  R('chou-rouge-saucisse', 'Chou rouge braisé aux pommes et saucisse', 40, ['proteines'], [I.chou_rouge(200), I.pomme(80), I.saucisse(), I.pdt(180)], ['Braiser le chou émincé avec la pomme 30 min à couvert.', 'Cuire saucisse et pommes de terre.']),
  R('boulgour-legumes', 'Boulgour aux légumes rôtis et feta', 30, ['vegetarien', 'feculents'], [I.boulgour(70), I.courgette(100), I.carotte(80), I.oignon(30), I.feta(40), I.huile(10)], ['Rôtir les légumes 20 min au four.', 'Cuire le boulgour 10 min.', 'Mélanger, feta émiettée.']),
  R('soupe-pistou', 'Soupe de légumes, haricots blancs et emmental (×3)', 40, ['batch', 'vegetarien', 'leger'], [I.carotte(80), I.courgette(80), I.poireau(80), I.pdt(80), I.haricots_rouges(60), I.bouillon(300), I.emmental(20), I.pain(50)], ['Couper tous les légumes en dés, cuire 30 min dans le bouillon.', 'Ajouter les haricots 5 min.', 'Emmental râpé et pain. Se garde 3 jours.'], 3),
  R('hachis-parmentier', 'Hachis parmentier maison (×3)', 50, ['batch', 'proteines', 'feculents'], [I.hache(110), I.pdt(250), I.oignon(40), I.lait(60), I.emmental(20), I.salade(50)], ['Purée de pommes de terre avec le lait.', 'Faire revenir oignon et viande.', 'Viande puis purée en couches, fromage, 20 min à 200 °C.'], 3),
  R('croque-salade', 'Croque-monsieur maison et salade', 15, ['rapide'], [I.pain(100), I.jambon(45), I.emmental(30), I.salade(60), I.huile(5)], ['Monter les croques (pain, jambon, fromage).', '10 min au four ou à la poêle.', 'Salade verte.']),
  R('wrap-thon', 'Wrap thon-crudités', 10, ['rapide', 'proteines'], [I.tortilla(), I.thon(100), I.carotte(60), I.salade(30), I.yaourt_grec(40)], ['Mélanger thon et yaourt.', 'Garnir les tortillas avec carottes râpées et salade.']),
  R('pates-carbo-legere', 'Pâtes aux lardons, champignons et crème légère', 20, ['rapide', 'feculents'], [I.pates(100), I.lardons(40), I.champignon(100), I.creme(40), I.parmesan(10)], ['Cuire les pâtes.', 'Faire revenir lardons et champignons, ajouter la crème.', 'Mélanger, parmesan.']),
  R('poulet-curry-riz', 'Poulet au curry doux, riz et carottes', 25, ['proteines', 'feculents'], [I.poulet(), I.riz(75), I.carotte(100), I.creme(30), I.curry(), I.oignon(30)], ['Faire revenir oignon et curry, ajouter le poulet en dés.', 'Carottes en rondelles et un peu d’eau, 15 min.', 'Crème à la fin, riz à côté.']),
  R('salade-lentilles-chevre', 'Salade tiède de lentilles, chèvre et betterave', 15, ['rapide', 'vegetarien', 'proteines'], [I.lentilles(180), I.betterave(), I.chevre(40), I.mache(), I.huile(10)], ['Réchauffer les lentilles.', 'Ajouter betterave en dés, mâche et chèvre.', 'Vinaigrette à la moutarde.']),
  R('steak-puree-carottes', 'Steak haché, purée maison et carottes', 25, ['proteines'], [I.hache15(), I.pdt(220), I.lait(60), I.carotte(150)], ['Purée de pommes de terre au lait.', 'Carottes à la vapeur.', 'Steak saisi 3 min par face.']),
  R('poisson-pane-maison', 'Colin pané maison, écrasé de pommes de terre et poireaux', 30, ['proteines'], [I.colin(), I.pain(30), I.pdt(220), I.poireau(150), I.huile(10)], ['Paner le colin (chapelure de pain), cuire 10 min au four.', 'Écraser les pommes de terre cuites avec un filet d’huile.', 'Fondue de poireaux 15 min.']),
  R('risotto-champi', 'Risotto aux champignons et parmesan', 35, ['vegetarien', 'feculents'], [I.riz(80), I.champignon(150), I.oignon(30), I.bouillon(300), I.parmesan(20), I.creme(15)], ['Nacrer le riz avec l’oignon.', 'Ajouter le bouillon louche par louche 18 min, champignons à mi-cuisson.', 'Parmesan et crème à la fin.']),
  R('panais-veloute', 'Velouté de panais et carottes, tartines au comté (×3)', 35, ['batch', 'vegetarien', 'leger'], [I.panais(150), I.carotte(100), I.oignon(30), I.bouillon(250), I.pain(70), I.comte(30)], ['Cuire les légumes 25 min dans le bouillon, mixer.', 'Tartines au comté gratinées.'], 3),
  // --- Desserts / collations ---
  R('yaourt-fruits', 'Yaourt grec, fruit de saison et miel', 3, ['rapide', 'vegetarien', 'petit-dej'], [I.yaourt_grec(150), I.poire(), I.miel(8)], ['Couper le fruit, ajouter au yaourt, filet de miel.']),
]

export const recipeById = (id: string) => RECIPES.find((r) => r.id === id)
