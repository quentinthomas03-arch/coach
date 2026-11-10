import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db, SETTING } from '../../data/db'
import { isBackupDue } from '../../data/backup'

export function BackupBanner() {
  const row = useLiveQuery(() => db.settings.get(SETTING.lastBackupAt), [])
  const hasData = useLiveQuery(async () => (await db.sessions.count()) + (await db.checkins.count()) + (await db.foodLog.count()) > 0, [])
  if (row === undefined && hasData === undefined) return null
  if (!hasData || !isBackupDue(row?.value as string | undefined)) return null
  return (
    <Link to="/reglages#sauvegarde" className="block mx-4 mt-3 rounded-card border border-warn/40 bg-warn/10 px-4 py-3 text-sm">
      <strong>Sauvegarde conseillée</strong> : aucune sauvegarde depuis plus de 30 jours. Touchez pour sauvegarder.
    </Link>
  )
}
