import type { Workout } from './workout'

/**
 * ÉCHAUFFEMENT ET ÉTIREMENTS : obligatoires dans chaque séance de course.
 *
 * - Avant : mobilité articulaire et gammes (≈ 4 min), puis le footing ou la marche
 *   d'échauffement prévus par la séance. On ne part jamais « à froid ».
 * - Après : étirements doux (≈ 5 min), sans forcer, 30 s par position.
 * Les deux sont des étapes de la séance envoyée sur la montre, et guidés dans l'appli avec chrono.
 * Les zones fragiles ajoutent des exercices ciblés (voir ZONE_ROUTINE_EXTRAS).
 */

export interface RoutineItem {
  name: string
  description: string
  sec: number
  /** Exercice fait des deux côtés : la durée s'applique à chaque côté. */
  sides?: boolean
}

export interface Routine {
  id: 'echauffement' | 'etirements'
  name: string
  items: RoutineItem[]
}

export type FragileZone = 'genou' | 'achille' | 'mollet' | 'cheville' | 'hanche' | 'dos' | 'pied' | 'ischios'
export const ZONE_LABEL: Record<FragileZone, string> = {
  genou: 'Genou',
  achille: 'Tendon d’Achille',
  mollet: 'Mollet',
  cheville: 'Cheville',
  hanche: 'Hanche',
  dos: 'Dos',
  pied: 'Pied (voûte, aponévrose)',
  ischios: 'Arrière de cuisse',
}

const WARMUP: RoutineItem[] = [
  { name: 'Rotations de chevilles', description: 'Pointe au sol, dessine de grands cercles avec la cheville, dans les deux sens.', sec: 20, sides: true },
  { name: 'Cercles de hanches', description: 'Mains sur les hanches, grands cercles du bassin dans les deux sens.', sec: 20 },
  { name: 'Balancés de jambe', description: 'Main au mur, balance la jambe tendue d’avant en arrière, amplitude progressive.', sec: 20, sides: true },
  { name: 'Montées de genoux', description: 'Sur place, monte les genoux à hauteur de hanche, sur l’avant du pied, bras actifs.', sec: 20 },
  { name: 'Talons-fesses', description: 'Sur place, ramène les talons vers les fesses, rythme léger.', sec: 20 },
  { name: 'Fentes dynamiques', description: 'Grand pas en avant, genou arrière vers le sol, remonte et alterne, buste droit.', sec: 30 },
  { name: 'Pas chassés', description: 'Petits pas chassés latéraux, quelques mètres de chaque côté.', sec: 20 },
]

const STRETCH: RoutineItem[] = [
  { name: 'Mollets', description: 'Mains au mur, jambe arrière tendue talon au sol, avance le bassin doucement.', sec: 30, sides: true },
  { name: 'Arrière de cuisse', description: 'Talon posé sur une marche, jambe tendue, penche le buste dos droit jusqu’à sentir l’étirement.', sec: 30, sides: true },
  { name: 'Avant de cuisse', description: 'Debout, main au mur, attrape ton pied et ramène le talon vers la fesse, genoux serrés.', sec: 30, sides: true },
  { name: 'Fessiers', description: 'Allongé, cheville posée sur le genou opposé, tire la cuisse vers toi.', sec: 30, sides: true },
  { name: 'Psoas (avant de hanche)', description: 'Un genou au sol, l’autre pied devant, avance le bassin sans cambrer.', sec: 30, sides: true },
]

/** Exercices ajoutés selon les zones fragiles déclarées. */
export const ZONE_ROUTINE_EXTRAS: Record<FragileZone, { warmup?: RoutineItem; stretch?: RoutineItem }> = {
  genou: { warmup: { name: 'Mini-squats', description: 'Squats lents sur une faible amplitude, genoux dans l’axe des pieds.', sec: 30 } },
  achille: {
    warmup: { name: 'Montées sur pointes', description: 'Monte lentement sur la pointe des pieds et redescends en 3 s.', sec: 30 },
    stretch: { name: 'Mollet genou fléchi (soléaire)', description: 'Comme l’étirement des mollets mais genou arrière légèrement plié.', sec: 30, sides: true },
  },
  mollet: { warmup: { name: 'Montées sur pointes', description: 'Monte lentement sur la pointe des pieds et redescends en 3 s.', sec: 30 } },
  cheville: { warmup: { name: 'Équilibre sur un pied', description: 'Sur une jambe, genou souple, garde l’équilibre.', sec: 20, sides: true } },
  hanche: { warmup: { name: 'Ouvertures de hanche debout', description: 'Genou levé, ouvre-le vers l’extérieur puis ramène-le, comme pour enjamber une barrière.', sec: 20, sides: true } },
  dos: { stretch: { name: 'Posture de l’enfant', description: 'À genoux, fesses sur les talons, bras allongés devant, relâche le dos.', sec: 40 } },
  pied: {
    warmup: { name: 'Marche sur les talons puis sur les pointes', description: 'Quelques pas sur les talons, puis sur les pointes.', sec: 30 },
    stretch: { name: 'Voûte plantaire', description: 'Assis, fais rouler une balle ou une bouteille sous le pied, pression douce.', sec: 30, sides: true },
  },
  ischios: { warmup: { name: 'Bonjours (charnière de hanche)', description: 'Mains sur les hanches, penche le buste dos plat en poussant les fesses en arrière, remonte.', sec: 30 } },
}

export function routineFor(id: Routine['id'], zones: FragileZone[] = []): Routine {
  const base = id === 'echauffement' ? WARMUP : STRETCH
  const extras: RoutineItem[] = []
  for (const z of zones) {
    const e = ZONE_ROUTINE_EXTRAS[z]?.[id === 'echauffement' ? 'warmup' : 'stretch']
    if (e && !extras.some((x) => x.name === e.name) && !base.some((x) => x.name === e.name)) extras.push(e)
  }
  return { id, name: id === 'echauffement' ? 'Échauffement : mobilité et gammes' : 'Étirements doux', items: [...base, ...extras] }
}

export function routineSec(r: Routine): number {
  return r.items.reduce((a, i) => a + i.sec * (i.sides ? 2 : 1) + 5, 0)
}

export const WARMUP_LABEL = 'Mobilité et gammes (guidé dans l’appli)'
export const STRETCH_LABEL = 'Étirements doux (guidé dans l’appli)'

/**
 * Ajoute à une séance de course l'échauffement (au début) et les étirements (à la fin).
 * Idempotent : n'ajoute rien si c'est déjà fait.
 */
export function withRoutines(w: Workout, zones: FragileZone[] = [], opts: { stretch?: boolean } = {}): Workout {
  if (w.blocks.some((b) => b.steps.some((s) => s.label === WARMUP_LABEL))) return w
  const warmSec = Math.round(routineSec(routineFor('echauffement', zones)) / 60) * 60
  const stretchSec = Math.round(routineSec(routineFor('etirements', zones)) / 60) * 60
  const blocks = w.blocks.map((b) => ({ ...b, steps: [...b.steps] }))
  const warm = blocks.find((b) => b.role === 'warmup' && !(b.repeat && b.repeat > 1))
  const warmStep = { label: WARMUP_LABEL, durationSec: warmSec }
  if (warm) warm.steps.unshift(warmStep)
  else blocks.unshift({ role: 'warmup', steps: [warmStep] })
  if (opts.stretch !== false) {
    const stretchStep = { label: STRETCH_LABEL, durationSec: stretchSec }
    const cool = [...blocks].reverse().find((b) => b.role === 'cooldown' && !(b.repeat && b.repeat > 1))
    if (cool) cool.steps.push(stretchStep)
    else blocks.push({ role: 'cooldown', steps: [stretchStep] })
  }
  return { blocks }
}
