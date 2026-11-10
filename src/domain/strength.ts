import type { EquipmentId } from '../data/types'

/**
 * RENFORCEMENT MUSCULAIRE orienté course.
 *
 * - Séances courtes (15-20 min), 5 exercices, en alternant deux séances (A et B).
 * - Chaque exercice a 5 niveaux ; le niveau global monte quand les séances
 *   sont faites sans difficulté excessive (même logique que la reprise).
 * - Ciblage : gainage, fessiers, mollets, stabilité (puis excentrique/proprio pour le trail).
 * - Si le matériel manque, l'exercice est remplacé par une alternative au poids du corps.
 * - Le tapis est un confort, pas une obligation : les exercices au sol se font aussi sans.
 */

export type StrengthFocus = 'gainage' | 'fessiers' | 'mollets' | 'stabilite' | 'jambes' | 'haut-du-corps'

export interface Prescription {
  sets: number
  reps?: number
  /** Durée d'effort par série (exercices tenus). */
  sec?: number
  restSec: number
  /** Précision de variante à ce niveau (« sur les genoux », « avec élastique »…). */
  variant?: string
}

export interface Exercise {
  id: string
  name: string
  /** Description en une phrase. */
  description: string
  focus: StrengthFocus
  equipment: EquipmentId[]
  /** Exercice d'un seul côté : séries faites à droite PUIS à gauche. */
  unilateral?: boolean
  levels: [Prescription, Prescription, Prescription, Prescription, Prescription]
  /** Remplacement si le matériel manque. */
  fallback?: string
}

const r = (sets: number, reps: number, restSec: number, variant?: string): Prescription => ({ sets, reps, restSec, variant })
const t = (sets: number, sec: number, restSec: number, variant?: string): Prescription => ({ sets, sec, restSec, variant })

export const EXERCISES: Exercise[] = [
  {
    id: 'squat',
    name: 'Squat',
    description: 'Pieds largeur de hanches, descends les fesses en arrière comme pour t’asseoir, dos droit, genoux dans l’axe des pieds.',
    focus: 'jambes',
    equipment: [],
    levels: [r(2, 10, 45), r(3, 10, 45), r(3, 12, 45), r(3, 15, 45), r(3, 12, 45, 'tempo lent : 3 s à la descente')],
  },
  {
    id: 'goblet-squat',
    name: 'Squat gobelet',
    description: 'Tiens la kettlebell contre la poitrine et fais un squat en gardant le buste haut.',
    focus: 'jambes',
    equipment: ['kettlebell'],
    fallback: 'squat',
    levels: [r(2, 10, 60), r(3, 10, 60), r(3, 12, 60), r(3, 15, 60), r(4, 12, 60)],
  },
  {
    id: 'pont-fessier',
    name: 'Pont fessier',
    description: 'Allongé sur le dos, genoux pliés, pousse dans les talons pour monter le bassin et serre les fesses 1 s en haut.',
    focus: 'fessiers',
    equipment: [],
    levels: [r(2, 12, 45), r(3, 12, 45), r(3, 15, 45), r(3, 10, 45, 'sur une jambe'), r(3, 12, 45, 'sur une jambe')],
  },
  {
    id: 'mollets-marche',
    name: 'Montées de mollets sur une marche',
    description: 'Avant des pieds sur le bord d’une marche, monte sur la pointe puis redescends lentement sous le niveau de la marche.',
    focus: 'mollets',
    equipment: ['escalier'],
    fallback: 'mollets-sol',
    levels: [r(2, 12, 45), r(3, 12, 45), r(3, 15, 45), r(3, 10, 45, 'sur une jambe'), r(3, 12, 45, 'sur une jambe, 3 s à la descente')],
  },
  {
    id: 'mollets-sol',
    name: 'Montées de mollets',
    description: 'Debout près d’un mur pour l’équilibre, monte sur la pointe des pieds puis redescends lentement.',
    focus: 'mollets',
    equipment: [],
    levels: [r(2, 15, 45), r(3, 15, 45), r(3, 20, 45), r(3, 12, 45, 'sur une jambe'), r(3, 15, 45, 'sur une jambe')],
  },
  {
    id: 'gainage-ventral',
    name: 'Gainage ventral (planche)',
    description: 'En appui sur les avant-bras, corps aligné de la tête aux pieds, ventre rentré, sans creuser le dos.',
    focus: 'gainage',
    equipment: [],
    levels: [t(3, 20, 30, 'sur les genoux'), t(3, 20, 30), t(3, 30, 30), t(3, 40, 30), t(3, 45, 30, 'en levant un pied à tour de rôle')],
  },
  {
    id: 'gainage-lateral',
    name: 'Gainage latéral',
    description: 'Sur le côté en appui sur un avant-bras, bassin haut et corps aligné ; fais les deux côtés.',
    focus: 'gainage',
    equipment: [],
    unilateral: true,
    levels: [t(2, 15, 30, 'sur les genoux'), t(3, 15, 30, 'sur les genoux'), t(3, 20, 30), t(3, 30, 30), t(3, 30, 30, 'jambe du dessus levée')],
  },
  {
    id: 'dead-bug',
    name: 'Dead bug',
    description: 'Sur le dos, bras et genoux levés, allonge un bras et la jambe opposée sans décoller le bas du dos du sol.',
    focus: 'gainage',
    equipment: [],
    levels: [r(2, 8, 30), r(3, 8, 30), r(3, 10, 30), r(3, 12, 30), r(3, 12, 30, 'mouvement très lent')],
  },
  {
    id: 'fente-arriere',
    name: 'Fente arrière',
    description: 'Fais un grand pas en arrière et descends le genou arrière près du sol, buste droit, puis reviens ; alterne les jambes.',
    focus: 'jambes',
    equipment: [],
    levels: [r(2, 6, 45, 'par jambe, main au mur'), r(3, 6, 45, 'par jambe'), r(3, 8, 45, 'par jambe'), r(3, 10, 45, 'par jambe'), r(3, 10, 45, 'par jambe, kettlebell en main si dispo')],
  },
  {
    id: 'step-up',
    name: 'Montée sur marche',
    description: 'Monte sur une marche en poussant sur la jambe d’appui sans t’aider de l’autre, puis redescends lentement.',
    focus: 'fessiers',
    equipment: ['escalier'],
    unilateral: true,
    fallback: 'fente-arriere',
    levels: [r(2, 8, 45), r(3, 8, 45), r(3, 10, 45), r(3, 12, 45), r(3, 10, 45, 'sur la 2e marche')],
  },
  {
    id: 'chaise',
    name: 'Chaise contre le mur',
    description: 'Dos plaqué au mur, cuisses parallèles au sol, genoux au-dessus des chevilles, et tiens la position.',
    focus: 'jambes',
    equipment: ['mur'],
    levels: [t(2, 20, 45), t(3, 25, 45), t(3, 30, 45), t(3, 40, 45), t(3, 45, 45)],
  },
  {
    id: 'equilibre',
    name: 'Équilibre sur une jambe',
    description: 'Debout sur une jambe, genou légèrement fléchi, garde l’équilibre sans poser l’autre pied ; fais les deux côtés.',
    focus: 'stabilite',
    equipment: [],
    unilateral: true,
    levels: [t(2, 20, 20), t(3, 30, 20), t(3, 30, 20, 'yeux fermés par moments'), t(3, 30, 20, 'sur un coussin ou le tapis plié'), t(3, 40, 20, 'sur le tapis plié, yeux fermés')],
  },
  {
    id: 'clamshell',
    name: 'Ouverture de hanche (clamshell)',
    description: 'Allongé sur le côté, genoux pliés, pieds joints, ouvre le genou du dessus sans bouger le bassin ; fais les deux côtés.',
    focus: 'stabilite',
    equipment: [],
    unilateral: true,
    levels: [r(2, 12, 30), r(3, 12, 30), r(3, 15, 30, 'élastique autour des genoux si dispo'), r(3, 15, 30, 'avec élastique'), r(3, 20, 30, 'avec élastique')],
  },
  {
    id: 'pompes-inclinees',
    name: 'Pompes inclinées',
    description: 'Mains sur une marche (ou contre le mur au début), corps gainé, descends la poitrine vers l’appui puis repousse.',
    focus: 'haut-du-corps',
    equipment: [],
    levels: [r(2, 8, 45, 'mains au mur'), r(3, 8, 45, 'mains sur la 3e marche'), r(3, 10, 45, 'mains sur la 2e marche'), r(3, 10, 45, 'mains sur la 1re marche'), r(3, 8, 60, 'au sol, sur les genoux si besoin')],
  },
  {
    id: 'kb-deadlift',
    name: 'Soulevé de terre kettlebell',
    description: 'Kettlebell entre les pieds, pousse les fesses en arrière dos plat, attrape-la et remonte en serrant les fesses.',
    focus: 'fessiers',
    equipment: ['kettlebell'],
    fallback: 'pont-fessier',
    levels: [r(2, 10, 45), r(3, 10, 45), r(3, 12, 45), r(3, 8, 45, 'sur une jambe, main au mur'), r(3, 10, 45, 'sur une jambe')],
  },
]

const byId = new Map(EXERCISES.map((e) => [e.id, e]))
export function getExercise(id: string): Exercise {
  const e = byId.get(id)
  if (!e) throw new Error(`Exercice inconnu : ${id}`)
  return e
}

/** Deux séances qui alternent, chacune couvre gainage, fessiers/jambes, mollets, stabilité. */
export const TEMPLATES: Record<'A' | 'B', string[]> = {
  A: ['goblet-squat', 'pont-fessier', 'mollets-marche', 'gainage-ventral', 'equilibre'],
  B: ['step-up', 'kb-deadlift', 'gainage-lateral', 'dead-bug', 'clamshell'],
}
/** Au niveau 3 et plus, un exercice du haut du corps s'ajoute (posture, bras en course). */
export const UPPER_FROM_LEVEL = 3

export interface StrengthItem {
  exerciseId: string
  name: string
  description: string
  sets: number
  reps?: number
  sec?: number
  restSec: number
  variant?: string
  unilateral: boolean
  /** Si l'exercice a été remplacé faute de matériel. */
  replaced?: string
}

export interface StrengthSession {
  template: 'A' | 'B'
  level: number
  items: StrengthItem[]
  durationMin: number
}

function hasEquipment(e: Exercise, available: Set<EquipmentId>) {
  return e.equipment.every((x) => available.has(x))
}

function resolve(id: string, available: Set<EquipmentId>): { ex: Exercise; replaced?: string } {
  let ex = getExercise(id)
  let replaced: string | undefined
  const seen = new Set<string>()
  while (!hasEquipment(ex, available)) {
    if (!ex.fallback || seen.has(ex.id)) throw new Error(`Pas d'alternative pour ${ex.id}`)
    seen.add(ex.id)
    replaced = replaced ?? ex.name
    ex = getExercise(ex.fallback)
  }
  return { ex, replaced }
}

/**
 * Durée estimée : ~3 s par répétition. Pour un exercice unilatéral, les deux
 * côtés s'enchaînent (+10 s de changement), le repos vient après les deux côtés.
 */
export function itemDurationSec(i: StrengthItem): number {
  const work = i.sec ?? (i.reps ?? 0) * 3
  const perSet = i.unilateral ? 2 * work + 10 : work
  return i.sets * perSet + Math.max(0, i.sets - 1) * i.restSec + 20 // + 20 s de mise en place
}

const WARMUP_SEC = 3 * 60
const TRANSITION_SEC = 20

export function sessionDurationSec(items: StrengthItem[]): number {
  return WARMUP_SEC + items.reduce((s, i) => s + itemDurationSec(i), 0) + Math.max(0, items.length - 1) * TRANSITION_SEC
}

/** Durée maximale par défaut d'une séance de renfo (brief : 15 à 25 min). */
export const DEFAULT_MAX_STRENGTH_MIN = 20

export function buildStrengthSession(opts: {
  template: 'A' | 'B'
  level: number
  equipment: EquipmentId[]
  /** Semaine allégée : une série de moins par exercice. */
  deload?: boolean
  /** Durée maximale (min) : si dépassée, on retire des séries aux exercices qui en ont le plus. */
  maxMinutes?: number
}): StrengthSession {
  const level = Math.min(5, Math.max(1, Math.round(opts.level)))
  const available = new Set(opts.equipment)
  const ids = [...TEMPLATES[opts.template]]
  if (level >= UPPER_FROM_LEVEL) ids.push('pompes-inclinees')
  const items = ids.map((id) => {
    const { ex, replaced } = resolve(id, available)
    const p = ex.levels[level - 1]
    return {
      exerciseId: ex.id,
      name: ex.name,
      description: ex.description,
      sets: opts.deload ? Math.max(1, p.sets - 1) : p.sets,
      reps: p.reps,
      sec: p.sec,
      restSec: p.restSec,
      variant: p.variant,
      unilateral: !!ex.unilateral,
      replaced,
    }
  })
  const maxSec = (opts.maxMinutes ?? DEFAULT_MAX_STRENGTH_MIN) * 60
  // Ajustement au temps disponible : on retire une série à la fois, en commençant
  // par l'exercice le plus long, sans jamais descendre sous 1 série.
  while (sessionDurationSec(items) > maxSec) {
    const candidates = items.filter((i) => i.sets > 1)
    if (!candidates.length) break
    const longest = candidates.reduce((a, b) => (itemDurationSec(b) > itemDurationSec(a) ? b : a))
    longest.sets -= 1
  }
  return { template: opts.template, level, items, durationMin: Math.round(sessionDurationSec(items) / 60) }
}

export function formatPrescription(i: StrengthItem): string {
  const amount = i.sec ? `${i.sets} × ${i.sec} s` : `${i.sets} × ${i.reps}`
  const side = i.unilateral ? ' par côté' : ''
  const v = i.variant ? ` (${i.variant})` : ''
  return `${amount}${side}${v}, repos ${i.restSec} s`
}

/** Texte envoyé dans la description de l'événement Intervals.icu / Garmin. */
export function strengthDescription(s: StrengthSession): string {
  return [
    `Renfo ${s.template} · niveau ${s.level} · ~${s.durationMin} min. Chrono et explications dans l’appli Coach.`,
    'Échauffement : 3 min (montées de genoux, rotations de hanches, squats légers).',
    '',
    ...s.items.map((i, n) => `${n + 1}. ${i.name} : ${formatPrescription(i)}`),
  ].join('\n')
}
