import { db, getSetting, setSetting, type CoachDB } from '../data/db'
import type { CravingLog } from '../domain/tabac'

const CRAVINGS_KEY = 'tabac.cravings'

export const getCravings = async (database: CoachDB = db) => (await getSetting<CravingLog[]>(CRAVINGS_KEY, database)) ?? []

export async function logCraving(c: Omit<CravingLog, 'at'> & { at?: string }, database: CoachDB = db) {
  const list = await getCravings(database)
  // On garde un an d'historique au maximum.
  await setSetting(CRAVINGS_KEY, [...list, { ...c, at: c.at ?? new Date().toISOString() }].slice(-2000), database)
}
