import type { ISODate } from '../data/types'
import { norm } from './foodSearch'
import { ZONE_LABEL, type FragileZone } from './routines'

/**
 * NOTES LIBRES : ce que le coach en retient.
 * Lecture par mots-clés (pas d'IA) : douleur + zone du corps, grosse fatigue, sensations positives.
 * Le coach réagit, mais ne modifie jamais le plan à partir d'une note seule :
 * pour qu'une douleur soit prise en compte, elle doit être signalée dans le check du matin.
 */
export interface Note {
  id?: number
  date: ISODate
  text: string
  at: string
}

const PAIN = ['douleur', 'mal ', 'mal au', 'mal a ', 'gene', 'tendu', 'contracture', 'tendinite', 'ampoule', 'claquage', 'elongation', 'entorse', 'raide', 'courbature']
const TIRED = ['creve', 'epuise', 'fatigue', 'vide', 'a plat', 'lessive', 'mort']
const GOOD = ['super', 'genial', 'facile', 'en forme', 'top', 'bonnes sensations', 'bonne sensation', 'leger', 'plaisir']
const ZONE_WORDS: Record<FragileZone, string[]> = {
  genou: ['genou', 'rotule'],
  achille: ['achille', 'tendon'],
  mollet: ['mollet'],
  cheville: ['cheville'],
  hanche: ['hanche', 'bassin', 'psoas'],
  dos: ['dos', 'lombaire'],
  pied: ['pied', 'voute', 'plantaire', 'talon', 'orteil', 'aponevrose'],
  ischios: ['ischio', 'arriere de cuisse', 'arriere de la cuisse'],
}

export interface NoteInsight {
  date: ISODate
  kind: 'douleur' | 'fatigue' | 'positif'
  zone?: FragileZone
  excerpt: string
}

/** Extrait autour du mot repéré, coupé sur des mots entiers (norm() garde les positions des lettres). */
function excerpt(text: string, word: string): string {
  const words = text.split(/\s+/)
  const target = norm(word.trim())
  let idx = words.findIndex((w) => norm(w).startsWith(target.split(' ')[0]))
  if (idx < 0) idx = 0
  const from = Math.max(0, idx - 4)
  const to = Math.min(words.length, idx + 5)
  return (from > 0 ? '…' : '') + words.slice(from, to).join(' ') + (to < words.length ? '…' : '')
}

export function analyzeNote(n: Note): NoteInsight[] {
  const t = ` ${norm(n.text)} `
  const out: NoteInsight[] = []
  const pain = PAIN.find((w) => t.includes(w))
  if (pain) {
    const zone = (Object.keys(ZONE_WORDS) as FragileZone[]).find((z) => ZONE_WORDS[z].some((w) => t.includes(w)))
    out.push({ date: n.date, kind: 'douleur', zone, excerpt: excerpt(n.text, zone ? ZONE_WORDS[zone].find((w) => t.includes(w))! : pain) })
  }
  const tired = TIRED.find((w) => t.includes(` ${w}`))
  if (tired) out.push({ date: n.date, kind: 'fatigue', excerpt: excerpt(n.text, tired) })
  const good = GOOD.find((w) => t.includes(w))
  if (good && !pain) out.push({ date: n.date, kind: 'positif', excerpt: excerpt(n.text, good) })
  return out
}

export function zoneLabel(z?: FragileZone) {
  return z ? ZONE_LABEL[z].toLowerCase() : undefined
}
