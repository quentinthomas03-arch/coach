import type { ISODate } from '../data/types'
import { addDays } from './dates'
import type { FitnessEstimate } from './fitness'
import { assessGoal, vdotAfter, type Goal } from './goals'
import { DISTANCES, DISTANCE_LABEL, predictTimeSec, type RoadDistance } from './paces'

/**
 * COURSES : quand une course devient-elle réaliste pour moi ?
 * Pour chaque distance, le coach utilise le même bilan que pour un objectif (reprise restante,
 * volume à construire, progression de la forme) et donne la date au plus tôt et le chrono
 * raisonnable à cette date.
 */

export interface RaceWindow {
  distance: RoadDistance
  label: string
  earliest: ISODate
  weeks: number
  /** Chrono raisonnable à cette date (si forme connue). */
  timeSec?: number
}

export function realisticWindows(today: ISODate, fitness: FitnessEstimate, recentWeeklyMin: number, canRun30: boolean, repriseLevel: number): RaceWindow[] {
  return (['5k', '10k', 'semi', 'marathon'] as const).map((d) => {
    const goal: Goal = { id: 'w', type: 'route', distance: d, date: addDays(today, 7 * 104), createdAt: '' }
    const a = assessGoal({ goal, today, fitness, recentWeeklyMin, canRun30, repriseLevel })
    const repriseLeft = canRun30 ? 0 : Math.max(0, 9 - repriseLevel + 1)
    const timeSec = fitness.vdot != null ? predictTimeSec(vdotAfter(fitness.vdot, Math.max(0, a.weeksNeeded - repriseLeft), fitness.pastBest), DISTANCES[d]) : undefined
    return { distance: d, label: DISTANCE_LABEL[d], earliest: a.earliestDate, weeks: a.weeksNeeded, timeSec }
  })
}

export interface Area {
  city?: string
  postcode?: string
  department?: string
  departmentCode?: string
}

/** Lecture de la réponse de l'API adresse.data.gouv.fr (/reverse). */
export function parseArea(raw: unknown): Area | undefined {
  const f = (raw as { features?: { properties?: Record<string, unknown> }[] })?.features?.[0]?.properties
  if (!f) return undefined
  const context = typeof f.context === 'string' ? f.context.split(',').map((x) => x.trim()) : []
  return {
    city: typeof f.city === 'string' ? f.city : undefined,
    postcode: typeof f.postcode === 'string' ? f.postcode : undefined,
    departmentCode: context[0],
    department: context[1],
  }
}

/** Recherches toutes faites pour trouver des courses près de chez moi. */
export function raceSearchLinks(area: Area | undefined, distanceLabel: string, year: number): { label: string; url: string }[] {
  const where = area?.department ?? area?.city ?? ''
  const q = encodeURIComponent(`calendrier course ${distanceLabel} ${where} ${year}`.replace(/\s+/g, ' ').trim())
  return [
    { label: `Rechercher « ${distanceLabel} ${where} ${year} »`.replace(/\s+/g, ' '), url: `https://www.google.com/search?q=${q}` },
    { label: 'Calendrier Kikourou', url: 'https://www.kikourou.net/calendrier/' },
    { label: 'Calendrier de la Fédération française d’athlétisme', url: 'https://bases.athle.fr/asp.net/liste.aspx?frmbase=calendrier' },
  ]
}

export interface PlannedRace {
  id: string
  name: string
  date: ISODate
  type: 'route' | 'trail'
  distance?: RoadDistance
  trailKm?: number
  elevationGainM?: number
  url?: string
}

export function raceToGoal(r: PlannedRace): Goal {
  return r.type === 'trail'
    ? { id: `goal-${r.id}`, type: 'trail', trailKm: r.trailKm, elevationGainM: r.elevationGainM, date: r.date, createdAt: new Date().toISOString(), name: r.name }
    : { id: `goal-${r.id}`, type: 'route', distance: r.distance, date: r.date, createdAt: new Date().toISOString(), name: r.name }
}
