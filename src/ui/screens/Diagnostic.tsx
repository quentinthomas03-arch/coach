import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../../data/db'
import { addDays, todayISO } from '../../domain/dates'
import {
  TEST_RUN_EXTERNAL_ID,
  TEST_STRENGTH_EXTERNAL_ID,
  testRunEvent,
  testStrengthEvent,
} from '../../domain/diagnostic'
import { explainError, IntervalsError } from '../../integrations/intervals'
import { getClient, logSync } from '../../integrations/intervalsStore'
import { PageTitle } from '../Layout'

type Result = { ok: boolean; text: string }

/**
 * Page de diagnostic Phase 0 : valide la chaîne appli → Intervals.icu → Garmin.
 * Chaque test est journalisé ; « Copier le rapport » permet de me le transmettre.
 */
export function Diagnostic() {
  const [day, setDay] = useState<'today' | 'tomorrow'>('today')
  const [results, setResults] = useState<Record<string, Result>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const log = useLiveQuery(() => db.syncLog.orderBy('id').reverse().limit(30).toArray(), [])
  const date = day === 'today' ? todayISO() : addDays(todayISO(), 1)

  const run = async (key: string, fn: () => Promise<string>) => {
    setBusy(key)
    try {
      const client = await getClient()
      if (!client) throw new IntervalsError('invalid-input', "Connecte d'abord Intervals.icu dans Réglages.")
      const text = await fn()
      setResults((r) => ({ ...r, [key]: { ok: true, text } }))
      await logSync(key, true, text)
    } catch (e) {
      const text = explainError(e) + (e instanceof IntervalsError && e.kind === 'network-or-cors' ? ` [${e.message}]` : '')
      setResults((r) => ({ ...r, [key]: { ok: false, text } }))
      await logSync(key, false, text)
    } finally {
      setBusy(null)
    }
  }

  const tests: { key: string; title: string; help: string; fn: () => Promise<string> }[] = [
    {
      key: 'cors',
      title: '1. Appel direct depuis l’iPhone (CORS)',
      help: 'Vérifie que le navigateur peut parler à Intervals.icu sans serveur intermédiaire.',
      fn: async () => {
        const a = await (await getClient())!.getAthlete()
        return `OK : appel direct autorisé (athlète ${a.id}). Pas besoin de relais.`
      },
    },
    {
      key: 'upsert-test-course',
      title: '2. Envoyer la course test',
      help: '5 min marche, 5 × (2 min course facile + 1 min marche), 5 min marche. Cibles en zones cardio.',
      fn: async () => {
        const c = (await getClient())!
        const res = await c.upsertEvents([testRunEvent(date)])
        return `Envoyée pour le ${date} (événement ${res[0]?.id ?? '?'}). Renvoyer met à jour la même séance.`
      },
    },
    {
      key: 'upsert-test-renfo',
      title: '3. Envoyer le renfo test',
      help: 'Séance de type WeightTraining avec la liste des exercices en description.',
      fn: async () => {
        const c = (await getClient())!
        const res = await c.upsertEvents([testStrengthEvent(date)])
        return `Envoyé pour le ${date} (événement ${res[0]?.id ?? '?'}).`
      },
    },
    {
      key: 'check-doublons',
      title: '4. Vérifier : pas de doublon',
      help: 'Relis le calendrier Intervals.icu et compte les séances test.',
      fn: async () => {
        const c = (await getClient())!
        const evs = await c.listEvents(addDays(todayISO(), -1), addDays(todayISO(), 2))
        const run = evs.filter((e) => e.external_id === TEST_RUN_EXTERNAL_ID).length
        const str = evs.filter((e) => e.external_id === TEST_STRENGTH_EXTERNAL_ID).length
        return `Course test : ${run} · Renfo test : ${str} (attendu : 1 chacun au maximum).`
      },
    },
    {
      key: 'lecture',
      title: '5. Lire mes données Garmin',
      help: 'Activités et bien-être des 30 derniers jours (sommeil, FC repos, HRV si dispo).',
      fn: async () => {
        const c = (await getClient())!
        const oldest = addDays(todayISO(), -30)
        const [acts, well] = await Promise.all([c.listActivities(oldest, todayISO()), c.listWellness(oldest, todayISO())])
        const has = (k: string) => well.filter((w) => w[k] != null).length
        return (
          `${acts.length} activité(s). Bien-être : ${well.length} jour(s) ; ` +
          `sommeil ${has('sleepSecs')}, FC repos ${has('restingHR')}, HRV ${has('hrv')}, poids ${has('weight')}, ` +
          `Body Battery ${has('bodyBattery')}.`
        )
      },
    },
    {
      key: 'nettoyage',
      title: '6. Supprimer les séances test',
      help: 'À faire une fois les tests terminés.',
      fn: async () => {
        await (await getClient())!.deleteEventsByExternalId([TEST_RUN_EXTERNAL_ID, TEST_STRENGTH_EXTERNAL_ID])
        return 'Séances test supprimées d’Intervals.icu (Garmin les retire à la prochaine synchro).'
      },
    },
  ]

  const copyReport = async () => {
    const lines = (log ?? []).map((l) => `${l.at.slice(0, 16)} ${l.ok ? 'OK ' : 'ERR'} ${l.action} : ${l.detail}`)
    const txt = [`Rapport diagnostic Coach v${__APP_VERSION__}`, navigator.userAgent, ...lines].join('\n')
    try {
      await navigator.clipboard.writeText(txt)
      alert('Rapport copié. Colle-le dans la conversation.')
    } catch {
      prompt('Copie ce rapport :', txt)
    }
  }

  return (
    <div>
      <PageTitle sub="Appli → Intervals.icu → Garmin Connect → montre">Diagnostic montre</PageTitle>

      <div className="card mb-4">
        <p className="text-sm font-medium mb-2">Date des séances test</p>
        <div className="grid grid-cols-2 gap-2">
          <button className={day === 'today' ? 'btn-primary' : 'btn-secondary'} onClick={() => setDay('today')}>
            Aujourd'hui
          </button>
          <button className={day === 'tomorrow' ? 'btn-primary' : 'btn-secondary'} onClick={() => setDay('tomorrow')}>
            Demain
          </button>
        </div>
      </div>

      <ol className="space-y-3">
        {tests.map((t) => (
          <li key={t.key} className="card">
            <h2 className="font-semibold">{t.title}</h2>
            <p className="text-sm text-muted mt-1">{t.help}</p>
            <button className="btn-secondary w-full mt-3" disabled={!!busy} onClick={() => run(t.key, t.fn)}>
              {busy === t.key ? 'En cours…' : 'Lancer'}
            </button>
            {results[t.key] && (
              <p role="status" className={`text-sm mt-2 ${results[t.key].ok ? 'text-ok' : 'text-danger'}`}>
                {results[t.key].text}
              </p>
            )}
          </li>
        ))}
      </ol>

      <section className="card mt-4">
        <h2 className="display text-base mb-2">Faire arriver la séance sur la montre</h2>
        <ol className="list-decimal pl-5 space-y-1.5 text-sm">
          <li>Ouvre l'app Garmin Connect sur l'iPhone et tire l'écran d'accueil vers le bas (synchro).</li>
          <li>Vérifie dans Garmin Connect › Entraînement › Entraînements (ou Calendrier) que « Coach - test course » est là.</li>
          <li>Sur la Fenix 6 : bouton START › Course, puis appui long sur MENU (bouton du milieu à gauche) › Entraînement › Mes entraînements (ou Calendrier) › choisis « Coach - test course » › Faire l'entraînement.</li>
          <li>Si rien après 15 min : dans Garmin Connect, synchronise manuellement la montre (icône montre › Synchroniser).</li>
        </ol>
      </section>

      <section className="card mt-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="display text-base">Journal</h2>
          <button className="text-sm font-semibold text-ink underline-offset-2 underline min-h-[44px] px-2" onClick={copyReport}>
            Copier le rapport
          </button>
        </div>
        <ul className="text-xs space-y-1.5 num">
          {(log ?? []).map((l) => (
            <li key={l.id} className={l.ok ? '' : 'text-danger'}>
              {new Date(l.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · {l.action} · {l.detail}
            </li>
          ))}
          {!log?.length && <li className="text-muted">Aucun test pour l'instant.</li>}
        </ul>
      </section>
      <Link to="/reglages#intervals" className="btn-secondary w-full mt-4">
        Réglages Intervals.icu
      </Link>
    </div>
  )
}
