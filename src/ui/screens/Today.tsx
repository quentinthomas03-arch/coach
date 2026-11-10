import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db, SETTING } from '../../data/db'
import { isStandalone } from '../../data/storage'
import { formatLongFr, todayISO } from '../../domain/dates'
import { PageTitle } from '../Layout'

function Step({ done, children, to }: { done: boolean; children: React.ReactNode; to?: string }) {
  const content = (
    <div className="flex items-center gap-3 min-h-[52px]">
      <span
        aria-hidden
        className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
          done ? 'bg-ok text-white' : 'border-2 border-line'
        }`}
      >
        {done ? '✓' : ''}
      </span>
      <span className={done ? 'text-muted line-through' : ''}>{children}</span>
      {to && !done && <span className="ml-auto text-muted">›</span>}
    </div>
  )
  return <li>{to && !done ? <Link to={to}>{content}</Link> : content}</li>
}

/** Phase 0 : l'écran Aujourd'hui sert de check-list de mise en route. */
export function Today() {
  const settings = useLiveQuery(() => db.settings.toArray(), [])
  const get = (k: string) => settings?.find((s) => s.key === k)?.value
  const lastTest = useLiveQuery(() => db.syncLog.where('action').equals('upsert-test-course').last(), [])
  const connected = !!get(SETTING.intervalsAthleteId) && !!get(SETTING.intervalsApiKey)

  return (
    <div>
      <PageTitle sub={formatLongFr(todayISO())}>Aujourd'hui</PageTitle>
      <section className="card">
        <h2 className="display text-base mb-1">Mise en route (Phase 0)</h2>
        <p className="text-sm text-muted mb-2">Le plan d'entraînement arrive en Phase 1. D'ici là, on valide la chaîne jusqu'à ta montre.</p>
        <ol className="divide-y divide-line">
          <Step done={isStandalone()}>Installer l'appli sur l'écran d'accueil (Partager › Sur l'écran d'accueil)</Step>
          <Step done={connected} to="/reglages#intervals">
            Connecter Intervals.icu
          </Step>
          <Step done={!!lastTest?.ok} to="/diagnostic">
            Envoyer la séance test sur la montre
          </Step>
        </ol>
      </section>
    </div>
  )
}
