import { useEffect, useState } from 'react'
import { useDbQuery } from '../useDbQuery'
import { db, setSetting } from '../../data/db'
import { getTabac, KEYS } from '../../app/config'
import { addDays, formatLongFr, todayISO } from '../../domain/dates'
import { MILESTONES, TABAC_HELP, tabacStatus, yearlyCost, type TabacSettings } from '../../domain/tabac'
import { Stepper } from '../components/Choice'
import { PageTitle } from '../Layout'

/** Respiration guidée 2 min : 4 s inspiration, 6 s expiration (repère courant de cohérence). */
function Breathing({ onEnd }: { onEnd: () => void }) {
  const [t, setT] = useState(0)
  useEffect(() => {
    if (t >= 120) {
      onEnd()
      return
    }
    const id = setTimeout(() => setT(t + 1), 1000)
    return () => clearTimeout(id)
  }, [t, onEnd])
  const inCycle = t % 10
  const inhale = inCycle < 4
  return (
    <div className="text-center py-6">
      <div
        className="mx-auto rounded-full bg-accent transition-transform ease-in-out"
        style={{ width: 160, height: 160, transform: `scale(${inhale ? 1 : 0.55})`, transitionDuration: inhale ? '4s' : '6s' }}
        aria-hidden
      />
      <p className="display text-2xl mt-6" aria-live="polite">
        {inhale ? 'Inspire…' : 'Expire lentement…'}
      </p>
      <p className="num text-muted mt-1">{120 - t} s</p>
    </div>
  )
}

function Settings({ s, onSave }: { s?: TabacSettings; onSave: () => void }) {
  const [d, setD] = useState<TabacSettings>(s ?? { quitDate: '2027-01-01', cigsPerDayBefore: 10, packPrice: 12.5, cigsPerPack: 20, reasons: [] })
  return (
    <section className="card space-y-2">
      <label className="label" htmlFor="qd">
        Date d’arrêt
      </label>
      <input id="qd" type="date" className="field" value={d.quitDate} onChange={(e) => setD({ ...d, quitDate: e.target.value })} />
      <Stepper label="Cigarettes par jour (avant)" value={d.cigsPerDayBefore} onChange={(v) => setD({ ...d, cigsPerDayBefore: v })} min={1} max={60} />
      <Stepper label="Prix du paquet" value={d.packPrice} onChange={(v) => setD({ ...d, packPrice: v })} min={5} max={25} step={0.1} unit="€" />
      <label className="label" htmlFor="rs">
        Mes raisons (une par ligne)
      </label>
      <textarea id="rs" className="field py-2 min-h-[96px]" value={d.reasons.join('\n')} onChange={(e) => setD({ ...d, reasons: e.target.value.split('\n') })} />
      <button
        className="btn-primary w-full"
        onClick={async () => {
          await setSetting(KEYS.tabac, { ...d, reasons: d.reasons.map((r) => r.trim()).filter(Boolean) })
          onSave()
        }}
      >
        Enregistrer
      </button>
    </section>
  )
}

export function Tabac() {
  const today = todayISO()
  const [sos, setSos] = useState(false)
  const [edit, setEdit] = useState(false)
  const data = useDbQuery(async () => {
    const s = await getTabac()
    const logs = (await db.checkins.toArray()).filter((c) => c.cigarettes != null).map((c) => ({ date: addDays(c.date, -1), count: c.cigarettes! }))
    return { s, status: s ? tabacStatus(s, logs, today) : undefined }
  }, [today])
  if (!data) return null
  const { s, status } = data

  if (!s || edit)
    return (
      <div className="space-y-4">
        <PageTitle sub="Le coach t’accompagne avant et après la date.">Arrêt du tabac</PageTitle>
        <Settings s={s} onSave={() => setEdit(false)} />
      </div>
    )

  return (
    <div className="space-y-4">
      <PageTitle>Arrêt du tabac</PageTitle>

      <section className="card">
        {status?.phase === 'preparation' ? (
          <>
            <p className="text-muted">Jour J : {formatLongFr(s.quitDate)}</p>
            <p className="display text-5xl num">J−{status.daysUntilQuit}</p>
            <p className="text-sm text-muted mt-2">
              Au rythme actuel, le tabac te coûte environ <strong className="text-ink">{yearlyCost(s)} € par an</strong>.
            </p>
          </>
        ) : (
          <>
            <p className="display text-5xl num">{status?.daysSmokeFree} j</p>
            <p className="text-muted">sans tabac{status?.relapsed ? ' (depuis ta dernière cigarette)' : ''}</p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="rounded-card bg-surface2 p-3">
                <p className="num text-2xl font-bold">{status?.cigarettesAvoided}</p>
                <p className="text-xs text-muted">cigarettes évitées</p>
              </div>
              <div className="rounded-card bg-surface2 p-3">
                <p className="num text-2xl font-bold">{Math.round(status?.moneySaved ?? 0)} €</p>
                <p className="text-xs text-muted">économisés</p>
              </div>
            </div>
          </>
        )}
      </section>

      {sos ? (
        <section className="card">
          <Breathing onEnd={() => setSos(false)} />
          {s.reasons.length > 0 && (
            <div className="mt-2">
              <p className="font-semibold">Tes raisons :</p>
              <ul className="list-disc pl-5">
                {s.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm text-muted mt-3">Une envie dure en général quelques minutes. Bois un grand verre d’eau, bouge, change de pièce.</p>
          <button className="btn-secondary w-full mt-3" onClick={() => setSos(false)}>
            Ça va mieux
          </button>
        </section>
      ) : (
        <button className="btn-primary w-full text-lg" onClick={() => setSos(true)}>
          SOS envie de fumer
        </button>
      )}

      <section className="card">
        <h2 className="display text-lg mb-2">Ce que ton corps gagne</h2>
        <ol className="space-y-2">
          {MILESTONES.map((m) => {
            const reached = status?.phase === 'sans-tabac' && status.reached.includes(m)
            return (
              <li key={m.label} className={`flex gap-3 ${reached ? '' : 'opacity-60'}`}>
                <span aria-hidden className={`mt-1 w-3 h-3 rounded-full shrink-0 ${reached ? 'bg-ok' : 'border-2 border-line'}`} />
                <span>
                  <strong>{m.label}</strong> — {m.text}
                </span>
              </li>
            )
          })}
        </ol>
        <p className="text-xs text-muted mt-3">Repères moyens publiés par Tabac info service, pas des garanties individuelles.</p>
      </section>

      <section className="card">
        <h2 className="display text-lg mb-1">Se faire aider</h2>
        <p className="text-sm">{TABAC_HELP.text}</p>
        <a href="tel:3989" className="btn-secondary w-full mt-3">
          Appeler le 39 89
        </a>
      </section>

      <button className="btn-secondary w-full" onClick={() => setEdit(true)}>
        Modifier mes réglages tabac
      </button>
    </div>
  )
}
