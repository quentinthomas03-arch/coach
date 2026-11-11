import { useState } from 'react'
import { buildWeeklyReview } from '../../app/review'
import { buildMonthlyReview } from '../../app/progress'
import { addDays, mondayOf, todayISO } from '../../domain/dates'
import { reviewText } from '../../domain/weeklyReview'
import { useDbQuery } from '../useDbQuery'
import { PageTitle } from '../Layout'

/** Bilan de la semaine, à lire le dimanche soir (ou à tout moment), partageable. */
export function Bilan() {
  const today = todayISO()
  const [offset, setOffset] = useState(0)
  const [mode, setMode] = useState<'semaine' | 'mois'>('semaine')
  const monday = addDays(mondayOf(today), -7 * offset)
  const [y, m] = today.split('-').map(Number)
  const month = offset === 0 ? today.slice(0, 7) : m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
  const r = useDbQuery(() => (mode === 'mois' ? buildMonthlyReview(month, today) : buildWeeklyReview(monday, today)), [mode, month, monday, today])
  const [msg, setMsg] = useState('')
  if (!r) return null
  return (
    <div className="space-y-4">
      <PageTitle>{r.title}</PageTitle>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Période">
        <button className={`pill ${mode === 'semaine' ? 'pill-on' : ''}`} aria-pressed={mode === 'semaine'} onClick={() => setMode('semaine')}>
          Semaine
        </button>
        <button className={`pill ${mode === 'mois' ? 'pill-on' : ''}`} aria-pressed={mode === 'mois'} onClick={() => setMode('mois')}>
          Mois
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className={offset === 0 ? 'btn-primary' : 'btn-secondary'} onClick={() => setOffset(0)}>
          {mode === 'mois' ? 'Ce mois-ci' : 'Cette semaine'}
        </button>
        <button className={offset === 1 ? 'btn-primary' : 'btn-secondary'} onClick={() => setOffset(1)}>
          {mode === 'mois' ? 'Le précédent' : 'La précédente'}
        </button>
      </div>
      <section className="card">
        <h2 className="display text-lg mb-1">{mode === 'mois' ? 'Ton mois' : 'Ta semaine'}</h2>
        <ul className="list-disc pl-5 space-y-1 text-[15px]">
          {r.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2 className="display text-lg mb-1">Le coach</h2>
        <ul className="space-y-2 text-[15px]">
          {r.coach.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>
      {r.nextWeek.length > 0 && offset === 0 && (
        <section className="card">
          <h2 className="display text-lg mb-1">Semaine prochaine</h2>
          <ul className="space-y-1 text-[15px]">
            {r.nextWeek.map((f) => (
              <li key={f} className="first-letter:uppercase">{f}</li>
            ))}
          </ul>
        </section>
      )}
      <button
        className="btn-primary w-full"
        onClick={async () => {
          const text = reviewText(r)
          try {
            if (navigator.share) await navigator.share({ title: r.title, text })
            else {
              await navigator.clipboard.writeText(text)
              setMsg('Bilan copié.')
            }
          } catch {
            /* partage annulé */
          }
        }}
      >
        Partager le bilan
      </button>
      {msg && <p role="status" className="text-sm text-ok">{msg}</p>}
    </div>
  )
}
