import { useState } from 'react'
import { db } from '../../data/db'
import { formatLongFr, todayISO } from '../../domain/dates'
import { analyzeNote, zoneLabel } from '../../domain/notes'
import { useDbQuery } from '../useDbQuery'
import { PageTitle } from '../Layout'

/** Notes libres : sensations, contexte, petits bobos. Le coach les lit (mots-clés) et réagit. */
export function Notes() {
  const today = todayISO()
  const [text, setText] = useState('')
  const notes = useDbQuery(() => db.notes.orderBy('date').reverse().limit(60).toArray(), [])
  return (
    <div className="space-y-4">
      <PageTitle sub="Sensations, contexte, petits bobos : le coach les lit.">Mes notes</PageTitle>
      <section className="card space-y-2">
        <label className="label" htmlFor="note">
          Note du jour
        </label>
        <textarea id="note" className="field py-2 min-h-[110px]" placeholder="ex. Bonnes sensations mais léger mal au mollet gauche en fin de sortie." value={text} onChange={(e) => setText(e.target.value)} />
        <button
          className="btn-primary w-full"
          disabled={!text.trim()}
          onClick={async () => {
            await db.notes.add({ date: today, text: text.trim(), at: new Date().toISOString() })
            setText('')
          }}
        >
          Enregistrer
        </button>
        <p className="text-xs text-muted">Le coach repère douleurs, fatigue et bonnes sensations. Une douleur n’adapte le plan que si tu la signales aussi dans le check du matin.</p>
      </section>
      <ul className="space-y-2">
        {(notes ?? []).map((n) => {
          const ins = analyzeNote(n)
          return (
            <li key={n.id} className="card">
              <div className="flex justify-between gap-2">
                <p className="text-sm text-muted first-letter:uppercase">{formatLongFr(n.date)}</p>
                <button className="text-sm text-muted underline min-h-[32px]" onClick={() => confirm('Supprimer cette note ?') && db.notes.delete(n.id!)}>
                  Supprimer
                </button>
              </div>
              <p className="whitespace-pre-wrap">{n.text}</p>
              {ins.length > 0 && (
                <p className="text-xs text-muted mt-1">
                  Le coach a retenu :{' '}
                  {ins.map((i) => (i.kind === 'douleur' ? `douleur${i.zone ? ` (${zoneLabel(i.zone)})` : ''}` : i.kind === 'fatigue' ? 'fatigue' : 'bonnes sensations')).join(', ')}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
