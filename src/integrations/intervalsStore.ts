import { db, getSetting, SETTING } from '../data/db'
import { IntervalsClient, type IntervalsCredentials } from './intervals'

export const SETTING_RELAY_URL = 'intervals.relayUrl'

export async function loadCredentials(): Promise<IntervalsCredentials | undefined> {
  const athleteId = await getSetting<string>(SETTING.intervalsAthleteId)
  const apiKey = await getSetting<string>(SETTING.intervalsApiKey)
  const baseUrl = await getSetting<string>(SETTING_RELAY_URL)
  if (!athleteId || !apiKey) return undefined
  return { athleteId, apiKey, baseUrl: baseUrl || undefined }
}

export async function getClient(): Promise<IntervalsClient | undefined> {
  const c = await loadCredentials()
  return c ? new IntervalsClient(c) : undefined
}

export async function logSync(action: string, ok: boolean, detail: string) {
  await db.syncLog.add({ at: new Date().toISOString(), action, ok, detail })
  // On garde les 200 dernières lignes.
  const count = await db.syncLog.count()
  if (count > 200) {
    const old = await db.syncLog.orderBy('id').limit(count - 200).primaryKeys()
    await db.syncLog.bulkDelete(old)
  }
}
