/** Groupe de gros boutons à choix unique. */
export function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
  cols = 2,
}: {
  label?: string
  options: { value: T; label: string; hint?: string }[]
  value: T | undefined
  onChange: (v: T) => void
  cols?: number
}) {
  return (
    <fieldset>
      {label && <legend className="text-sm font-medium mb-1.5">{label}</legend>}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`min-h-[48px] px-3 py-2 rounded-btn border text-left ${
              value === o.value ? 'bg-accent text-on-accent border-transparent font-semibold' : 'bg-surface2 border-line'
            }`}
          >
            <span className="block">{o.label}</span>
            {o.hint && <span className={`block text-xs ${value === o.value ? '' : 'text-muted'}`}>{o.hint}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 min-h-[52px] text-left"
    >
      <span>
        <span className="block">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span className={`shrink-0 w-12 h-7 rounded-full p-0.5 transition-colors ${checked ? 'bg-accent-ink' : 'bg-line'}`}>
        <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  )
}

export function Stepper({ label, value, onChange, min, max, step = 1, unit }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-[52px]">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" className="w-11 h-11 rounded-btn bg-surface2 border border-line text-xl" aria-label={`${label} : moins`} onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}>
          −
        </button>
        <span className="num w-20 text-center font-semibold">
          {String(value).replace('.', ',')} {unit}
        </span>
        <button type="button" className="w-11 h-11 rounded-btn bg-surface2 border border-line text-xl" aria-label={`${label} : plus`} onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))}>
          +
        </button>
      </div>
    </div>
  )
}
