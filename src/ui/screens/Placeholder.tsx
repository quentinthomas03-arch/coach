import { PageTitle } from '../Layout'

export function Placeholder({ title, phase, items }: { title: string; phase: string; items: string[] }) {
  return (
    <div>
      <PageTitle>{title}</PageTitle>
      <div className="card">
        <p className="text-sm text-muted mb-2">Arrive en {phase}</p>
        <ul className="list-disc pl-5 space-y-1">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
