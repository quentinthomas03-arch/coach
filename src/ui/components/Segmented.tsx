/** Sélecteur 1-5 en un tap, gros boutons. */
export function Scale5({
  label,
  value,
  onChange,
  low,
  high,
}: {
  label: string
  value?: number
  onChange: (v: number) => void
  low: string
  high: string
}) {
  return (
    <fieldset>
      <legend className="flex justify-between w-full text-sm font-medium mb-1.5">
        <span>{label}</span>
        <span className="text-muted font-normal">
          {low} → {high}
        </span>
      </legend>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            aria-label={`${label} : ${n} sur 5`}
            onClick={() => onChange(n)}
            style={{
              background: `rgb(var(--s${n}) / ${value === n ? 1 : 0.22})`,
              borderColor: `rgb(var(--s${n}) / ${value === n ? 1 : 0.5})`,
              color: value === n ? 'rgb(14 17 12)' : undefined,
            }}
            className={`h-11 rounded-btn font-semibold num border-2 ${value === n ? 'scale-105 shadow-sm' : ''} transition-transform`}
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function Gauge({ label, value, target, unit, color = 'accent-ink' }: { label: string; value: number; target: number; unit: string; color?: 'accent-ink' | 'eau' | 'nutri' | 'renfo' }) {
  const pct = Math.min(100, Math.round((value / target) * 100))
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium">{label}</span>
        <span className="num text-muted">
          {value.toLocaleString('fr-FR')} / {target.toLocaleString('fr-FR')} {unit}
        </span>
      </div>
      <div
        className="h-2.5 rounded-full bg-surface2 overflow-hidden"
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={target}
      >
        <div className={`h-full rounded-full ${{ 'accent-ink': 'bg-accent-ink', eau: 'bg-eau', nutri: 'bg-nutri', renfo: 'bg-renfo' }[color]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
