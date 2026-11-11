import { useState } from 'react'
import { addRace, assessRace, getArea, getRaces, getWindows, launchRace, removeRace, saveArea } from '../../app/races'
import { formatLongFr, todayISO } from '../../domain/dates'
import type { GoalAssessment } from '../../domain/goals'
import { DISTANCE_LABEL, formatTime, type RoadDistance } from '../../domain/paces'
import { raceSearchLinks, type PlannedRace } from '../../domain/races'
import { reverseArea } from '../../integrations/geo'
import { currentPosition } from '../../integrations/weather'
import { Choice } from '../components/Choice'
import { useDbQuery } from '../useDbQuery'
import { AssessmentCard } from './PlanScreen'

const ROAD: RoadDistance[] = ['5k', '10k', 'semi', 'marathon']

/** Courses à venir : fenêtres réalistes, recherches près de chez moi, courses envisagées. */
export function RacesCard({ hasGoal }: { hasGoal: boolean }) {
  const today = todayISO()
  const data = useDbQuery(async () => ({ windows: await getWindows(today), races: await getRaces(), area: await getArea() }), [today])
  const [dist, setDist] = useState<RoadDistance>('10k')
  const [locating, setLocating] = useState(false)
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<{ id: string; a: GoalAssessment } | null>(null)
  if (!data) return null
  const { windows, races, area } = data
  const win = windows.find((w) => w.distance === dist)
  const year = Number((win?.earliest ?? today).slice(0, 4))

  const locate = async () => {
    setLocating(true)
    const pos = await currentPosition()
    const a = pos ? await reverseArea(pos.lat, pos.lon) : undefined
    if (a) await saveArea(a)
    setLocating(false)
    if (!a) alert('Position ou département introuvable. Les recherches restent possibles sans.')
  }

  return (
    <section className="card space-y-3" id="courses">
      <h2 className="display text-lg">Courses à venir</h2>
      <p className="text-sm text-muted">Quand chaque distance devient réaliste pour toi, d’après ta forme et ton volume actuels.</p>
      <ul className="space-y-1 text-[15px]">
        {windows.map((w) => (
          <li key={w.distance} className="flex justify-between gap-2">
            <span className="font-semibold">{w.label}</span>
            <span className="text-right">
              dès le {formatLongFr(w.earliest).split(' ').slice(1, 3).join(' ')} {w.earliest.slice(0, 4)}
              {w.timeSec ? <span className="text-muted"> · ~{formatTime(w.timeSec)}</span> : null}
            </span>
          </li>
        ))}
      </ul>

      <Choice label="Chercher une course" options={ROAD.map((d) => ({ value: d, label: DISTANCE_LABEL[d] }))} value={dist} onChange={setDist} />
      <p className="text-sm">
        {area?.department ? (
          <>Près de chez toi : <b>{area.department}</b>{area.departmentCode ? ` (${area.departmentCode})` : ''}. </>
        ) : (
          'Département inconnu. '
        )}
        <button className="underline min-h-[40px]" onClick={locate} disabled={locating}>
          {locating ? 'Localisation…' : area ? 'Actualiser' : 'Me localiser'}
        </button>
      </p>
      <ul className="space-y-1">
        {raceSearchLinks(area, win?.label ?? '', year).map((l) => (
          <li key={l.url}>
            <a className="underline min-h-[40px] inline-flex items-center" href={l.url} target="_blank" rel="noreferrer">
              {l.label} ↗
            </a>
          </li>
        ))}
      </ul>

      <h3 className="font-semibold pt-1">Courses envisagées</h3>
      {races.length === 0 && <p className="text-sm text-muted">Note ici les courses qui te tentent : le coach en fait le bilan en un tap.</p>}
      <ul className="space-y-3">
        {races.map((r) => (
          <li key={r.id} className="border-t border-line pt-2 space-y-2">
            <p>
              <b>{r.name}</b> · {formatLongFr(r.date)} {r.date.slice(0, 4)} · {r.type === 'trail' ? `trail ${r.trailKm ?? '?'} km ${r.elevationGainM ?? 0} m D+` : DISTANCE_LABEL[r.distance ?? '10k']}
              {r.date < today && <span className="text-muted"> (passée)</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={async () => setOpen(open?.id === r.id ? null : { id: r.id, a: await assessRace(r, today) })}>
                {open?.id === r.id ? 'Masquer le bilan' : 'Faire le bilan'}
              </button>
              <button
                className="btn-primary"
                onClick={async () => {
                  if (hasGoal && !confirm('Remplacer ton objectif actuel par cette course ?')) return
                  await launchRace(r, today)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                Lancer comme objectif
              </button>
              <button className="btn-secondary" aria-label={`Retirer ${r.name}`} onClick={() => confirm(`Retirer ${r.name} ?`) && removeRace(r.id)}>
                Retirer
              </button>
            </div>
            {open?.id === r.id && <AssessmentCard a={open.a} />}
          </li>
        ))}
      </ul>
      {adding ? <RaceForm onDone={() => setAdding(false)} /> : (
        <button className="btn-secondary w-full" onClick={() => setAdding(true)}>
          + Ajouter une course envisagée
        </button>
      )}
    </section>
  )
}

function RaceForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [type, setType] = useState<PlannedRace['type']>('route')
  const [distance, setDistance] = useState<RoadDistance>('10k')
  const [km, setKm] = useState('')
  const [dplus, setDplus] = useState('')
  const ok = name.trim() && date >= todayISO() && (type === 'route' || Number(km.replace(',', '.')) > 0)
  return (
    <form
      className="space-y-3 border-t border-line pt-3"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!ok) return
        await addRace(type === 'route' ? { name: name.trim(), date, type, distance } : { name: name.trim(), date, type, trailKm: Number(km.replace(',', '.')), elevationGainM: Number(dplus) || 0 })
        onDone()
      }}
    >
      <div>
        <label className="label" htmlFor="rname">Nom de la course</label>
        <input id="rname" className="field" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="rdate">Date</label>
        <input id="rdate" type="date" className="field" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <Choice options={[{ value: 'route', label: 'Route' }, { value: 'trail', label: 'Trail' }]} value={type} onChange={setType} />
      {type === 'route' ? (
        <Choice options={ROAD.map((d) => ({ value: d, label: DISTANCE_LABEL[d] }))} value={distance} onChange={setDistance} />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="rkm">Distance (km)</label>
            <input id="rkm" className="field" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="rdp">D+ (m)</label>
            <input id="rdp" className="field" inputMode="numeric" value={dplus} onChange={(e) => setDplus(e.target.value)} />
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" className="btn-secondary flex-1" onClick={onDone}>Annuler</button>
        <button className="btn-primary flex-1" disabled={!ok}>Ajouter</button>
      </div>
    </form>
  )
}
