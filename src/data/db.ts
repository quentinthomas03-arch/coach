import Dexie, { type Table } from 'dexie'
import type {
  Activity,
  BodyMetric,
  Equipment,
  FoodItem,
  FoodLogEntry,
  HydrationEntry,
  MorningCheckin,
  PlanVersion,
  PlannedSession,
  Profile,
  SessionFeedback,
  Setting,
  SyncLogEntry,
  WeekAvailability,
  Wellness,
} from './types'

/**
 * Base locale. Chaque évolution du schéma = un nouveau `this.version(n)`
 * avec, si besoin, une fonction `.upgrade()` qui transforme les données.
 * Ne jamais modifier une version déjà publiée : toujours en ajouter une.
 */
export class CoachDB extends Dexie {
  settings!: Table<Setting, string>
  profile!: Table<Profile, string>
  equipment!: Table<Equipment, string>
  availability!: Table<WeekAvailability, string>
  sessions!: Table<PlannedSession, string>
  activities!: Table<Activity, string>
  checkins!: Table<MorningCheckin, string>
  feedback!: Table<SessionFeedback, string>
  wellness!: Table<Wellness, string>
  foods!: Table<FoodItem, string>
  foodLog!: Table<FoodLogEntry, number>
  hydration!: Table<HydrationEntry, number>
  bodyMetrics!: Table<BodyMetric, string>
  planVersions!: Table<PlanVersion, number>
  syncLog!: Table<SyncLogEntry, number>

  constructor(name = 'coach') {
    super(name)
    this.version(1).stores({
      settings: 'key',
      profile: 'id',
      equipment: 'id',
      availability: 'weekStart',
      sessions: 'id, date, kind, status, externalId',
      activities: 'id, date, type',
      checkins: 'date',
      feedback: 'id, date, sessionId',
      wellness: 'date',
      foods: 'id, source, name, barcode, favorite, lastUsedAt',
      foodLog: '++id, date, foodId',
      hydration: '++id, date',
      bodyMetrics: 'date',
      planVersions: '++id, createdAt',
      syncLog: '++id, at, action',
    })
  }
}

export const TABLE_NAMES = [
  'settings',
  'profile',
  'equipment',
  'availability',
  'sessions',
  'activities',
  'checkins',
  'feedback',
  'wellness',
  'foods',
  'foodLog',
  'hydration',
  'bodyMetrics',
  'planVersions',
  'syncLog',
] as const
export type TableName = (typeof TABLE_NAMES)[number]

export const db = new CoachDB()

/** Réglages (clé/valeur) */
export const SETTING = {
  intervalsAthleteId: 'intervals.athleteId',
  intervalsApiKey: 'intervals.apiKey',
  disclaimerAcceptedAt: 'disclaimer.acceptedAt',
  lastBackupAt: 'backup.lastAt',
  persistGranted: 'storage.persistGranted',
} as const

/** Réglages jamais inclus dans une sauvegarde (secrets). */
export const SECRET_SETTINGS: string[] = [SETTING.intervalsApiKey]

export async function getSetting<T>(key: string, database: CoachDB = db): Promise<T | undefined> {
  const row = await database.settings.get(key)
  return row?.value as T | undefined
}

export async function setSetting(key: string, value: unknown, database: CoachDB = db) {
  await database.settings.put({ key, value })
}
