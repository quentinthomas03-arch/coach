import { useEffect, useState } from 'react'
import { getCalendarOptions, openCalendar, saveCalendarOptions, type CalendarOptions } from '../../app/calendar'
import { todayISO } from '../../domain/dates'

const SLOT_LABEL = { matin: 'Matin', midi: 'Midi', soir: 'Soir' } as const

/** Ajouter les séances des 14 prochains jours à l'agenda de l'iPhone, avec une alerte. */
export function CalendarCard() {
  const [o, setO] = useState<CalendarOptions>()
  const [msg, setMsg] = useState('')
  useEffect(() => {
    getCalendarOptions().then(setO)
  }, [])
  if (!o) return null
  const update = (n: CalendarOptions) => {
    setO(n)
    saveCalendarOptions(n)
  }
  const go = async (mode: 'open' | 'share') => {
    const n = await openCalendar(todayISO(), mode)
    setMsg(n ? `${n} séance${n > 1 ? 's' : ''} dans le fichier. Sur l’iPhone, choisis « Tout ajouter ».` : 'Aucune séance prévue dans les 14 prochains jours.')
  }
  return (
    <section className="card space-y-2">
      <h2 className="display text-lg">📅 Dans mon agenda</h2>
      <p className="text-sm text-muted">Les séances des 14 prochains jours dans l’agenda de l’iPhone, avec une alerte {o.alarmMin >= 60 ? `${o.alarmMin / 60} h` : `${o.alarmMin} min`} avant. Si le plan change, ajoute-les à nouveau.</p>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-primary" onClick={() => go('open')}>
          Ajouter à l’agenda
        </button>
        <button className="btn-secondary" onClick={() => go('share')}>
          Partager le fichier
        </button>
      </div>
      {msg && <p className="text-sm" role="status">{msg}</p>}
      <details>
        <summary className="text-sm min-h-[40px] flex items-center">Heures et alerte</summary>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {(['matin', 'midi', 'soir'] as const).map((s) => (
            <div key={s}>
              <label className="label" htmlFor={`cal-${s}`}>{SLOT_LABEL[s]}</label>
              <input id={`cal-${s}`} type="time" className="field" value={o.times[s]} onChange={(e) => e.target.value && update({ ...o, times: { ...o.times, [s]: e.target.value } })} />
            </div>
          ))}
        </div>
        <label className="label mt-2" htmlFor="cal-alarm">Alerte avant la séance</label>
        <select id="cal-alarm" className="field" value={o.alarmMin} onChange={(e) => update({ ...o, alarmMin: Number(e.target.value) })}>
          {[15, 30, 60, 120, 180].map((m) => (
            <option key={m} value={m}>{m >= 60 ? `${m / 60} h` : `${m} min`}</option>
          ))}
        </select>
        <p className="text-xs text-muted mt-1">Le créneau de chaque jour (matin, midi, soir) vient de ta semaine type, dans Réglages › Plan.</p>
      </details>
    </section>
  )
}
