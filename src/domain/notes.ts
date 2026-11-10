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

function excerpt(text: string, word: string): string {
  const n = norm(text)
  const i = n.indexOf(word.trim())
  if (i < 0) return text.slice(0, 60)
  const start = Math.max(0, i - 25)
  return (start > 0 ? '…' : '') + text.slice(start, i + 35).trim() + (i + 35 < text.length ? '…' : '')
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
