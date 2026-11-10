import type { DayAvailability, EquipmentId, ISODate } from '../data/types'
import { db, getSetting, setSetting, type CoachDB } from '../data/db'
import type { Tone } from '../domain/coach'
import type { TabacSettings } from '../domain/tabac'

/** Réglages du plan, modifiables à tout moment dans l'appli. */
export interface PlanConfig {
  /** Date de début du plan, choisie par moi. */
  startDate: ISODate
  runsPerWeek: number
  strengthPerWeek: number
  /** 0 = lundi … 6 = dimanche */
  longRunWeekday: number
  repriseLevel: number
  strengthLevel: number
  /** reprise (par défaut) puis forme continue, une fois la reprise validée. */
  mode?: 'reprise' | 'forme'
  /** Forme continue : volume de course d'une semaine de charge (min). */
  formeBaseMinutes?: number
  /** Dernière semaine (lundi) dont le bilan a été appliqué. */
  lastReviewedWeek?: ISODate
  /** auto = changements appliqués avec possibilité d'annuler ; valider = je valide d'abord. */
  recalcMode: 'auto' | 'valider'
  tone: Tone
}

export const KEYS = {
  plan: 'plan.config',
  tabac: 'tabac.config',
  onboarded: 'onboarding.doneAt',
  pendingDeletes: 'sync.pendingDeletes',
  lastDecisions: 'plan.lastDecisions',
  dismissedProposal: 'proposal.dismissed',
} as const

export const DEFAULT_TEMPLATE: DayAvailability[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  available: true,
  maxMinutes: weekday >= 5 ? 90 : 60,
  slot: weekday >= 5 ? 'matin' : 'soir',
}))

export async function getPlanConfig(database: CoachDB = db) {
  return getSetting<PlanConfig>(KEYS.plan, database)
}
export async function savePlanConfig(c: PlanConfig, database: CoachDB = db) {
  await setSetting(KEYS.plan, c, database)
}
export async function getTabac(database: CoachDB = db) {
  return getSetting<TabacSettings>(KEYS.tabac, database)
}

export async function getEquipment(database: CoachDB = db): Promise<EquipmentId[]> {
  return (await database.equipment.toArray()).filter((e) => e.available).map((e) => e.id)
}

/** Dispos de la semaine : celles saisies pour cette semaine, sinon ma semaine type. */
export async function getAvailability(weekStart: ISODate, database: CoachDB = db): Promise<{ days: DayAvailability[]; specific: boolean }> {
  const w = await database.availability.get(weekStart)
  if (w) return { days: w.days, specific: true }
  const t = await database.availability.get('template')
  return { days: t?.days ?? DEFAULT_TEMPLATE, specific: false }
}
