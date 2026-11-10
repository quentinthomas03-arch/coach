import type { DayAvailability } from '../../data/types'

export const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const DURATIONS = [30, 45, 60, 90, 120]

/** Saisie des dispos en quelques taps : un bouton par jour, puis la durée. */
export function WeekEditor({ days, onChange }: { days: DayAvailability[]; onChange: (d: DayAvailability[]) => void }) {
  const set = (wd: number, patch: Partial<DayAvailability>) => onChange(days.map((d) => (d.weekday === wd ? { ...d, ...patch } : d)))
  return (
    <ul className="divide-y divide-line">
      {days.map((d) => (
        <li key={d.weekday} className="py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={d.available}
              onClick={() => set(d.weekday, { available: !d.available })}
              className={`w-28 shrink-0 min-h-[44px] rounded-btn border font-medium ${d.available ? 'bg-accent text-on-accent border-transparent' : 'bg-surface2 border-line text-muted line-through'}`}
            >
              {DAY_NAMES[d.weekday]}
            </button>
            {d.available ? (
              <div className="flex gap-1 overflow-x-auto" role="group" aria-label={`Durée le ${DAY_NAMES[d.weekday]}`}>
                {DURATIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={d.maxMinutes === m}
                    onClick={() => set(d.weekday, { maxMinutes: m })}
                    className={`num min-w-[44px] min-h-[44px] px-1.5 rounded-btn border text-sm ${d.maxMinutes === m ? 'bg-ink text-bg border-transparent font-semibold' : 'bg-surface2 border-line'}`}
                  >
                    {m < 60 ? `${m}′` : `${m / 60}h${m % 60 ? '30' : ''}`}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-sm text-muted">Pas dispo</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
