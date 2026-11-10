import { z } from 'zod'
import { CoachDB, SECRET_SETTINGS, SETTING, TABLE_NAMES, db as defaultDb, type TableName } from './db'

/**
 * Sauvegarde complète en un fichier JSON versionné.
 *
 * - `formatVersion` : version du format de fichier. Si le format change,
 *   on ajoute une étape dans `BACKUP_MIGRATIONS` pour relire les anciens fichiers.
 * - La clé d'API Intervals.icu n'est JAMAIS incluse (secret).
 */
export const BACKUP_FORMAT_VERSION = 1
export const BACKUP_APP_ID = 'coach-perso'

const backupSchema = z.object({
  app: z.literal(BACKUP_APP_ID),
  formatVersion: z.number().int().positive(),
  schemaVersion: z.number(),
  exportedAt: z.string(),
  tables: z.record(z.string(), z.array(z.unknown())),
})
export type BackupFile = z.infer<typeof backupSchema>

/** Migrations du format de fichier : clé = version source, renvoie version source + 1. */
export const BACKUP_MIGRATIONS: Record<number, (b: BackupFile) => BackupFile> = {}

export async function exportBackup(database: CoachDB = defaultDb, now = new Date()): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {}
  await database.transaction('r', TABLE_NAMES.map((t) => database.table(t)), async () => {
    for (const name of TABLE_NAMES) {
      let rows = await database.table(name).toArray()
      if (name === 'settings') {
        rows = rows.filter((r: { key: string }) => !SECRET_SETTINGS.includes(r.key))
      }
      tables[name] = rows
    }
  })
  return {
    app: BACKUP_APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: database.verno,
    exportedAt: now.toISOString(),
    tables,
  }
}

export class BackupError extends Error {}

export function parseBackup(json: string): BackupFile {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new BackupError("Ce fichier n'est pas un JSON valide.")
  }
  const parsed = backupSchema.safeParse(data)
  if (!parsed.success) throw new BackupError("Ce fichier n'est pas une sauvegarde de Coach.")
  let backup = parsed.data
  if (backup.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new BackupError("Sauvegarde créée par une version plus récente de l'appli : mets l'appli à jour.")
  }
  while (backup.formatVersion < BACKUP_FORMAT_VERSION) {
    const step = BACKUP_MIGRATIONS[backup.formatVersion]
    if (!step) throw new BackupError(`Format de sauvegarde ${backup.formatVersion} non pris en charge.`)
    backup = step(backup)
  }
  return backup
}

/**
 * Remplace TOUTES les données locales par celles de la sauvegarde.
 * Les secrets actuels (clé d'API) sont conservés.
 * Tout se fait dans une transaction : en cas d'erreur, rien n'est modifié.
 */
export async function importBackup(backup: BackupFile, database: CoachDB = defaultDb) {
  const keptSecrets = await database.settings.where('key').anyOf(SECRET_SETTINGS).toArray()
  await database.transaction('rw', TABLE_NAMES.map((t) => database.table(t)), async () => {
    for (const name of TABLE_NAMES) {
      const table = database.table(name)
      await table.clear()
      const rows = backup.tables[name as TableName] ?? []
      if (rows.length) await table.bulkAdd(rows)
    }
    if (keptSecrets.length) await database.settings.bulkPut(keptSecrets)
  })
}

export function backupFileName(now = new Date()) {
  const d = now.toISOString().slice(0, 10)
  return `coach-sauvegarde-${d}.json`
}

/** Vrai si aucune sauvegarde depuis plus de `days` jours (ou jamais). */
export function isBackupDue(lastBackupAt: string | undefined, now = new Date(), days = 30): boolean {
  if (!lastBackupAt) return true
  const last = new Date(lastBackupAt).getTime()
  if (Number.isNaN(last)) return true
  return now.getTime() - last > days * 24 * 3600 * 1000
}

/**
 * Partage le fichier via le menu de partage iOS (Enregistrer dans Fichiers, AirDrop…).
 * Repli : téléchargement classique si le partage de fichiers n'est pas disponible.
 */
export async function shareBackup(database: CoachDB = defaultDb): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const backup = await exportBackup(database)
  const name = backupFileName()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const file = new File([blob], name, { type: 'application/json' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  let result: 'shared' | 'downloaded' | 'cancelled'
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Sauvegarde Coach' })
      result = 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
      throw e
    }
  } else {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    result = 'downloaded'
  }
  await database.settings.put({ key: SETTING.lastBackupAt, value: new Date().toISOString() })
  return result
}
