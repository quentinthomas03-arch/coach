import { useState } from 'react'

/**
 * Graphiques simples, une seule série (pas de légende : le titre la nomme).
 * Barres fines à extrémité arrondie posées sur la ligne de base, 2 px d'écart,
 * valeur affichée au toucher, et tableau des chiffres en dessous.
 * Couleur : accent-ink (vert lisible en clair comme en sombre) ; textes en encre neutre.
 */

export interface Point {
  label: string
  value: number
  /** Texte du tooltip (sinon la valeur). */
  detail?: string
  /** Barre « en cours » (semaine actuelle) : hachurée. */
  current?: boolean
}

export function BarChart({ title, unit, data, height = 140 }: { title: string; unit: string; data: Point[]; height?: number }) {
  const [sel, setSel] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  const w = 320
  const pad = 4
  const slot = (w - pad * 2) / data.length
  const bw = Math.max(6, slot - 8)
  const shown = sel ?? data.length - 1
  return (
    <figure className="card">
      <figcaption className="mb-2">
        <span className="block font-semibold">{title}</span>
        {data[shown] && (
          <span className="block num text-sm text-muted" aria-live="polite">
            {data[shown].label} : <strong className="text-ink">{data[shown].detail ?? `${data[shown].value} ${unit}`}</strong>
          </span>
        )}
      </figcaption>
      <svg viewBox={`0 0 ${w} ${height + 20}`} className="w-full" role="img" aria-label={`${title} : ${data.map((d) => `${d.label} ${d.value} ${unit}`).join(', ')}`}>
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="rgb(var(--accent-ink) / 0.35)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgb(var(--accent-ink))" strokeWidth="2" />
          </pattern>
        </defs>
        <line x1={0} x2={w} y1={height} y2={height} stroke="rgb(var(--line))" strokeWidth={1} />
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 8)
          const x = pad + i * slot + (slot - bw) / 2
          const r = Math.min(4, h / 2)
          const y = height - h
          // Barre : haut arrondi (4 px), base carrée posée sur la ligne de base.
          const path = h > 0 ? `M${x},${height} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${height} Z` : ''
          return (
            <g key={i} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
              <rect x={pad + i * slot} y={0} width={slot} height={height + 20} fill="transparent" />
              {path && <path d={path} fill={d.current ? 'url(#hatch)' : 'rgb(var(--accent-ink))'} opacity={sel == null || sel === i ? 1 : 0.45} />}
              <text x={pad + i * slot + slot / 2} y={height + 15} textAnchor="middle" fontSize="10" fill="rgb(var(--muted))">
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
      <details className="mt-1">
        <summary className="text-xs text-muted min-h-[32px] flex items-center">Voir les chiffres</summary>
        <table className="w-full text-sm num">
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-t border-line">
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-right">{d.detail ?? `${d.value} ${unit}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

export function LineChart({ title, unit, data, height = 120 }: { title: string; unit: string; data: Point[]; height?: number }) {
  const [sel, setSel] = useState<number | null>(null)
  if (data.length < 2) return null
  const vals = data.map((d) => d.value)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = Math.max(1, max - min)
  const w = 320
  const xs = (i: number) => 8 + (i * (w - 16)) / (data.length - 1)
  const ys = (v: number) => 8 + (1 - (v - min) / span) * (height - 16)
  const shown = sel ?? data.length - 1
  return (
    <figure className="card">
      <figcaption className="mb-2">
        <span className="block font-semibold">{title}</span>
        <span className="block num text-sm text-muted" aria-live="polite">
          {data[shown].label} : <strong className="text-ink">{String(data[shown].value).replace('.', ',')} {unit}</strong>
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" role="img" aria-label={`${title}, de ${min} à ${max} ${unit}`}>
        <polyline fill="none" stroke="rgb(var(--accent-ink))" strokeWidth={2} strokeLinejoin="round" points={data.map((d, i) => `${xs(i)},${ys(d.value)}`).join(' ')} />
        {data.map((d, i) => (
          <g key={i} onClick={() => setSel(i)}>
            <circle cx={xs(i)} cy={ys(d.value)} r={14} fill="transparent" />
            <circle cx={xs(i)} cy={ys(d.value)} r={i === shown ? 5 : 4} fill="rgb(var(--accent-ink))" stroke="rgb(var(--surface))" strokeWidth={2} />
          </g>
        ))}
      </svg>
    </figure>
  )
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-card bg-surface border border-line p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="num text-2xl font-bold leading-tight">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  )
}
