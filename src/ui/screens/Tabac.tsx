import { useEffect, useState } from 'react'
import { useDbQuery } from '../useDbQuery'
import { db, setSetting } from '../../data/db'
import { getTabac, KEYS } from '../../app/config'
import { addDays, formatLongFr, todayISO } from '../../domain/dates'
import { MILESTONES, PREP_STEPS, TABAC_HELP, TRIGGERS, rhrTrend, tabacStatus, yearlyCost, type TabacSettings } from '../../domain/tabac'
import { getCravings, logCraving } from '../../app/tabac'
import { LineChart } from '../components/Charts'
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
    const well = s ? await db.wellness.where('date').between(addDays(s.quitDate, -14), today, true, true).toArray() : []
    return { s, status: s ? tabacStatus(s, logs, today, await getCravings()) : undefined, rhr: s ? rhrTrend(well, s.quitDate, today) : undefined }
  }, [today])
  if (!data) return null
  const { s, status, rhr } = data

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
          <SosEnd triggers={s.triggers ?? []} onDone={() => setSos(false)} />
        </section>
      ) : (
        <button className="btn-primary w-full text-lg" onClick={() => setSos(true)}>
          Envie de fumer
        </button>
      )}

      {status?.phase === 'preparation' && <PrepCard s={s} daysUntil={status.daysUntilQuit!} target={status.target} />}

      {status?.cravings && (
        <section className="card tint tint-tabac">
          <h2 className="display text-lg">Tes envies</h2>
          <p>
            Cette semaine : <strong className="num">{status.cravings.last7}</strong> envie{status.cravings.last7 > 1 ? 's' : ''}, dont <strong className="num">{status.cravings.resisted7}</strong> tenue{status.cravings.resisted7 > 1 ? 's' : ''}
            {status.cravings.prev7 > 0 && <span className="text-muted"> (semaine d’avant : {status.cravings.prev7})</span>}.
          </p>
          {status.cravings.peakHour != null && <p className="text-sm">Ton heure la plus difficile : vers <strong>{status.cravings.peakHour} h</strong>. Prévois quelque chose à ce moment-là.</p>}
          {status.cravings.topTrigger && <p className="text-sm">Moment le plus fréquent : <strong>{TRIGGERS.find((t) => t.id === status.cravings!.topTrigger)?.label}</strong>. Plan B : {TRIGGERS.find((t) => t.id === status.cravings!.topTrigger)?.planB}</p>}
          <p className="text-sm text-muted mt-1">Depuis le début : {status.cravings.totalResisted} envies tenues sur {status.cravings.total}.</p>
        </section>
      )}

      <TriggersCard s={s} />

      <section className="card space-y-2" aria-label="Ton cœur et la course">
        <h2 className="display text-lg">Ton cœur et la course</h2>
        {rhr?.baseline == null ? (
          <p className="text-sm text-muted">
            {status?.phase === 'preparation'
              ? 'Porte ta montre la nuit : ta fréquence cardiaque de repos des 2 semaines avant l’arrêt servira de référence.'
              : 'Pas assez de mesures de FC de repos autour de ta date d’arrêt (montre portée la nuit nécessaire).'}
          </p>
        ) : (
          <>
            <p>
              FC de repos avant l’arrêt : <strong className="num">{Math.round(rhr.baseline)} bpm</strong>
              {rhr.current != null && (
                <>
                  {' '}· maintenant : <strong className="num">{Math.round(rhr.current)} bpm</strong>{' '}
                  {rhr.delta! < 0 ? <span className="text-ok font-semibold">({rhr.delta} bpm)</span> : <span className="text-muted">({rhr.delta! > 0 ? '+' : ''}{rhr.delta} bpm)</span>}
                </>
              )}
            </p>
            {rhr.weekly.length >= 2 && <LineChart title="FC de repos (moyenne par semaine)" unit="bpm" data={rhr.weekly.map((w) => ({ label: `${Number(w.weekStart.slice(8))}/${Number(w.weekStart.slice(5, 7))}`, value: w.avg }))} />}
            <p className="text-xs text-muted">Une FC de repos qui baisse = un cœur qui travaille moins pour le même effort. L’arrêt du tabac et la course s’additionnent.</p>
          </>
        )}
      </section>

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

function SosEnd({ triggers, onDone }: { triggers: string[]; onDone: () => void }) {
  const [trigger, setTrigger] = useState<string>()
  const list = TRIGGERS.filter((t) => triggers.length === 0 || triggers.includes(t.id))
  const save = async (resisted: boolean) => {
    await logCraving({ resisted, trigger })
    onDone()
  }
  return (
    <div className="mt-3 space-y-2">
      <p className="text-sm font-semibold">C’était à quel moment ? (facultatif)</p>
      <div className="flex flex-wrap gap-2">
        {list.map((t) => (
          <button key={t.id} className={`pill ${trigger === t.id ? 'pill-on' : ''}`} aria-pressed={trigger === t.id} onClick={() => setTrigger(trigger === t.id ? undefined : t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <button className="btn-primary w-full" onClick={() => save(true)}>
        Envie passée, je n’ai pas fumé
      </button>
      <button className="btn-secondary w-full" onClick={() => save(false)}>
        J’ai fumé
      </button>
    </div>
  )
}

function PrepCard({ s, daysUntil, target }: { s: TabacSettings; daysUntil: number; target?: number }) {
  const current = Math.ceil(daysUntil / 7)
  return (
    <section className="card space-y-2" id="preparation">
      <h2 className="display text-lg">Préparation à l’arrêt</h2>
      {daysUntil > 49 ? (
        <p className="text-sm">Le programme commence 7 semaines avant ton jour J, le {formatLongFr(addDays(s.quitDate, -49))}. D’ici là, écris tes raisons et coche tes moments à cigarette.</p>
      ) : (
        target != null && (
          <p>
            Repère du jour : <strong className="num">{target} cigarette{target > 1 ? 's' : ''}</strong> au maximum <span className="text-sm text-muted">(au lieu de {s.cigsPerDayBefore}). Une baisse progressive prépare le jour J.</span>
          </p>
        )
      )}
      <ol className="space-y-2">
        {PREP_STEPS.map((p) => {
          const now = daysUntil <= 49 && p.weeksBefore === current
          const done = daysUntil <= 49 && p.weeksBefore > current
          return (
            <li key={p.weeksBefore} className={`rounded-card p-3 ${now ? 'bg-surface2 border-2 border-accent' : done ? 'opacity-60' : ''}`}>
              <p className="font-semibold">
                {done ? '✓ ' : ''}Semaine −{p.weeksBefore} · {p.title}
                {now && <span className="ml-2 text-xs rounded-full bg-accent text-on-accent px-2 py-0.5">cette semaine</span>}
              </p>
              {(now || daysUntil > 49) && (
                <ul className="list-disc pl-5 text-[15px] mt-1">
                  {p.todo.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function TriggersCard({ s }: { s: TabacSettings }) {
  const sel = new Set(s.triggers ?? [])
  const toggle = (id: string) => {
    const next = new Set(sel)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return setSetting(KEYS.tabac, { ...s, triggers: [...next] })
  }
  return (
    <section className="card space-y-2">
      <h2 className="display text-lg">Mes moments à cigarette</h2>
      <p className="text-sm text-muted">Coche les tiens : chacun a son plan B.</p>
      <div className="flex flex-wrap gap-2">
        {TRIGGERS.map((t) => (
          <button key={t.id} className={`pill ${sel.has(t.id) ? 'pill-on' : ''}`} aria-pressed={sel.has(t.id)} onClick={() => toggle(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {sel.size > 0 && (
        <ul className="space-y-1 text-[15px]">
          {TRIGGERS.filter((t) => sel.has(t.id)).map((t) => (
            <li key={t.id}>
              <strong>{t.label}</strong> → {t.planB}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
