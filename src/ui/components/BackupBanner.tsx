import { Link } from 'react-router-dom'
import { db, getSetting, SETTING } from '../../data/db'
import { isBackupDue } from '../../data/backup'
import { KEYS } from '../../app/config'
import { useDbQuery } from '../useDbQuery'

/**
 * Rappel de sauvegarde : si la dernière sauvegarde a plus de 30 jours,
 * ou si aucune sauvegarde n'a été faite après 7 jours d'utilisation.
 */
export function BackupBanner() {
  const state = useDbQuery(async () => {
    const last = await getSetting<string>(SETTING.lastBackupAt, db)
    const since = await getSetting<string>(KEYS.onboarded, db)
    if (last) return isBackupDue(last) ? 'old' : null
    if (since && isBackupDue(since, new Date(), 7)) return 'never'
    return null
  }, [])
  if (!state) return null
  return (
    <Link to="/reglages#sauvegarde" className="block mx-4 mt-3 rounded-card border border-warn/40 bg-warn/10 px-4 py-3 text-sm">
      <strong>Pense à sauvegarder</strong> :{' '}
      {state === 'old' ? 'ta dernière sauvegarde a plus de 30 jours.' : 'tu n’as encore jamais sauvegardé tes données.'} Touche ici.
    </Link>
  )
}
