import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting, SETTING } from '../../data/db'
import { BackupError, importBackup, parseBackup, shareBackup } from '../../data/backup'
import { isStandalone, requestPersistence, storageEstimate } from '../../data/storage'
import { explainError, IntervalsClient, validateCredentials } from '../../integrations/intervals'
import { logSync, SETTING_RELAY_URL } from '../../integrations/intervalsStore'
import { DisclaimerText } from '../components/Disclaimer'
import { PageTitle } from '../Layout'
import { PlanSettings } from './PlanSettings'
import { NutritionSettings } from './NutritionSettings'
import { SessionPrefsCard } from './SessionPrefsCard'

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card mb-4 scroll-mt-16">
      <h2 className="display text-base mb-3">{title}</h2>
      {children}
    </section>
  )
}

function IntervalsSection() {
  const [athleteId, setAthleteId] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [relay, setRelay] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    ;(async () => {
      setAthleteId((await getSetting<string>(SETTING.intervalsAthleteId)) ?? '')
      setRelay((await getSetting<string>(SETTING_RELAY_URL)) ?? '')
      setHasKey(!!(await getSetting<string>(SETTING.intervalsApiKey)))
    })()
  }, [])

  const save = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const key = apiKey.trim() || (await getSetting<string>(SETTING.intervalsApiKey)) || ''
      const creds = { athleteId: athleteId.trim(), apiKey: key, baseUrl: relay.trim() || undefined }
      validateCredentials(creds)
      const athlete = await new IntervalsClient(creds).getAthlete()
      await setSetting(SETTING.intervalsAthleteId, creds.athleteId)
      await setSetting(SETTING.intervalsApiKey, key)
      await setSetting(SETTING_RELAY_URL, creds.baseUrl ?? '')
      setHasKey(true)
      setApiKey('')
      await logSync('connexion', true, `Connecté à l'athlète ${athlete.id}`)
      setMsg({ ok: true, text: `Connecté (athlète ${athlete.id}${athlete.name ? ` · ${athlete.name}` : ''}).` })
    } catch (e) {
      await logSync('connexion', false, explainError(e))
      setMsg({ ok: false, text: explainError(e) })
    } finally {
      setBusy(false)
    }
  }

  const forget = async () => {
    if (!confirm("Supprimer la clé d'API de ce téléphone ?")) return
    await db.settings.delete(SETTING.intervalsApiKey)
    setHasKey(false)
    setMsg({ ok: true, text: 'Clé supprimée de ce téléphone.' })
  }

  return (
    <Section id="intervals" title="Intervals.icu (montre Garmin)">
      <div className="space-y-3">
        <div>
          <label className="label" htmlFor="athlete">
            Identifiant athlète
          </label>
          <input
            id="athlete"
            className="field"
            inputMode="text"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="i123456"
            value={athleteId}
            onChange={(e) => setAthleteId(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="apikey">
            Clé d'API {hasKey && <span className="text-ok">(enregistrée)</span>}
          </label>
          <input
            id="apikey"
            className="field"
            type="password"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder={hasKey ? '•••••••• (laisser vide pour garder)' : 'Colle ta clé ici'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        <details>
          <summary className="text-sm text-muted py-2">Avancé : relais (seulement si le test CORS échoue)</summary>
          <input
            className="field mt-1"
            inputMode="url"
            autoCapitalize="none"
            placeholder="https://coach-relais.xxx.workers.dev"
            value={relay}
            onChange={(e) => setRelay(e.target.value)}
          />
        </details>
        <button className="btn-primary w-full" onClick={save} disabled={busy || !athleteId}>
          {busy ? 'Test en cours…' : 'Enregistrer et tester'}
        </button>
        {msg && (
          <p role="status" className={`text-sm ${msg.ok ? 'text-ok' : 'text-danger'}`}>
            {msg.text}
          </p>
        )}
        <details className="text-sm">
          <summary className="py-2 font-medium">Sécurité de la clé : à lire</summary>
          <div className="space-y-2 text-muted">
            <p>La clé est enregistrée uniquement sur ce téléphone, dans le stockage de l'appli. Elle n'est jamais dans le code, ni dans le dépôt GitHub, ni dans les sauvegardes.</p>
            <p>
              Avec cette clé, quelqu'un pourrait lire et modifier ton compte Intervals.icu (activités, calendrier). Elle ne donne
              pas accès à ton mot de passe Garmin.
            </p>
            <p>
              Pour la révoquer : intervals.icu › Settings › Developer Settings › régénérer la clé. L'ancienne cesse aussitôt de
              fonctionner ; colle la nouvelle ici.
            </p>
          </div>
        </details>
        {hasKey && (
          <button className="btn-secondary w-full text-danger" onClick={forget}>
            Supprimer la clé de ce téléphone
          </button>
        )}
        <Link to="/diagnostic" className="btn-secondary w-full">
          Diagnostic montre
        </Link>
      </div>
    </Section>
  )
}

function BackupSection() {
  const last = useLiveQuery(() => db.settings.get(SETTING.lastBackupAt), [])
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const doExport = async () => {
    try {
      const r = await shareBackup()
      if (r !== 'cancelled') setMsg({ ok: true, text: 'Sauvegarde créée.' })
    } catch (e) {
      setMsg({ ok: false, text: `Échec : ${String(e)}` })
    }
  }
  const doImport = async (file: File) => {
    try {
      const backup = parseBackup(await file.text())
      const when = new Date(backup.exportedAt).toLocaleString('fr-FR')
      if (!confirm(`Remplacer toutes les données de ce téléphone par la sauvegarde du ${when} ?`)) return
      await importBackup(backup)
      setMsg({ ok: true, text: 'Données restaurées.' })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof BackupError ? e.message : `Échec : ${String(e)}` })
    }
  }
  const lastTxt = last?.value ? new Date(last.value as string).toLocaleDateString('fr-FR') : 'jamais'

  return (
    <Section id="sauvegarde" title="Sauvegarde">
      <p className="text-sm text-muted mb-3">
        Dernière sauvegarde : <strong className="text-ink">{lastTxt}</strong>. Enregistre le fichier dans « Fichiers » (iCloud
        Drive). La clé d'API n'est pas incluse.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-primary" onClick={doExport}>
          Sauvegarder
        </button>
        <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
          Restaurer
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) doImport(f)
          e.target.value = ''
        }}
      />
      {msg && (
        <p role="status" className={`text-sm mt-3 ${msg.ok ? 'text-ok' : 'text-danger'}`}>
          {msg.text}
        </p>
      )}
    </Section>
  )
}

function StorageSection() {
  const [persist, setPersist] = useState<boolean | undefined>()
  const [est, setEst] = useState<{ usageMb: number; quotaMb: number }>()
  useEffect(() => {
    requestPersistence().then(setPersist)
    storageEstimate().then(setEst)
  }, [])
  return (
    <Section title="Stockage sur le téléphone">
      <ul className="text-sm space-y-1">
        <li>Appli installée sur l'écran d'accueil : {isStandalone() ? 'oui' : 'non (ouverte dans Safari)'}</li>
        <li>Stockage persistant : {persist === undefined ? 'inconnu' : persist ? 'accordé' : 'non accordé'}</li>
        {est && (
          <li className="num">
            Utilisé : {est.usageMb.toFixed(1)} Mo
          </li>
        )}
      </ul>
      <p className="text-sm text-muted mt-3">
        Les données de l'appli installée sont séparées de celles de Safari. Supprimer l'icône de l'écran d'accueil efface les
        données : sauvegarde d'abord.
      </p>
    </Section>
  )
}

export function Settings() {
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])
  return (
    <div>
      <PageTitle>Réglages</PageTitle>
      <PlanSettings />
      <SessionPrefsCard />
      <NutritionSettings />
      <IntervalsSection />
      <BackupSection />
      <StorageSection />
      <Section title="Avertissement">
        <DisclaimerText />
      </Section>
      <p className="text-center text-xs text-muted pb-4">Coach v{__APP_VERSION__}</p>
    </div>
  )
}
