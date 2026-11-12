/**
 * Anneaux du jour (inspirés d'Apple Fitness) : un anneau par objectif, couleur de l'univers.
 * La valeur est toujours écrite à côté (l'anneau n'est jamais la seule information).
 */
export interface Ring {
  label: string
  value: number
  target: number
  /** Variable CSS de couleur, ex. '--c-course'. */
  color: string
  text: string
}

function Circle({ r, pct, color, size }: { r: Ring; pct: number; color: string; size: number }) {
  const stroke = 7
  const rad = (size - stroke) / 2
  const c = 2 * Math.PI * rad
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={`rgb(var(${color}) / 0.2)`} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={rad}
        fill="none"
        stroke={`rgb(var(${color}))`}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {pct >= 1 && (
        <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fontSize="16" fill={`rgb(var(${color}))`}>
          ✓
        </text>
      )}
      <title>{r.label}</title>
    </svg>
  )
}

export function Rings({ rings }: { rings: Ring[] }) {
  return (
    <ul className="grid gap-1 mt-3" style={{ gridTemplateColumns: `repeat(${rings.length}, minmax(0, 1fr))` }} aria-label="Objectifs du jour">
      {rings.map((r) => {
        const pct = r.target > 0 ? Math.min(1, r.value / r.target) : 0
        return (
          <li key={r.label} className="flex flex-col items-center text-center">
            <Circle r={r} pct={pct} color={r.color} size={52} />
            <span className="text-xs font-semibold mt-1">{r.label}</span>
            <span className="text-[11px] num">{r.text}</span>
          </li>
        )
      })}
    </ul>
  )
}
