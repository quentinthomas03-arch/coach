import { useEffect, useState } from 'react'
import { addWater, nutritionDay, todayMaxTemp, undoLastWater } from '../../app/nutrition'
import { todayISO } from '../../domain/dates'
import { Gauge } from '../components/Segmented'
import { useDbQuery } from '../useDbQuery'
import { PageTitle } from '../Layout'
import { MenuTab, PanierTab } from './NutritionPlanning'
import { getMenu } from '../../app/menu'
import { mondayOf } from '../../domain/dates'
import { recipeById } from '../../domain/recipes'

const DAY_TYPE = { repos: 'Jour de repos', leger: 'Jour d’entraînement léger', soutenu: 'Jour d’entraînement soutenu' }
const L = (ml: number) => `${(ml / 1000).toFixed(2).replace('.', ',')} L`

export function WaterButtons({ date, bottleMl = 500 }: { date: string; bottleMl?: number }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <button className="btn-secondary px-2" onClick={() => addWater(date, 250)}>
        + Verre
      </button>
      <button className="btn-secondary px-2" aria-label={`Ajouter ma gourde (${bottleMl / 10} cl)`} onClick={() => addWater(date, bottleMl)}>
        + Gourde
      </button>
      <button className="btn-secondary px-2 text-muted" aria-label="Annuler le dernier ajout d’eau" onClick={() => undoLastWater(date)}>
        Annuler
      </button>
    </div>
  )
}

type Tab = 'journal' | 'menu' | 'panier'
const TABS: { id: Tab; label: string }[] = [
  { id: 'journal', label: 'Aujourd’hui' },
  { id: 'menu', label: 'Menu' },
  { id: 'panier', label: 'Panier' },
]

export function Nutrition() {
  const [tab, setTab] = useState<Tab>('journal')
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1 p-1 rounded-btn bg-surface2 border border-line" role="tablist" aria-label="Nutrition">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`min-h-[40px] rounded-[12px] text-sm font-semibold ${tab === t.id ? 'bg-surface shadow text-ink' : 'text-muted'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'journal' && <Journal />}
      {tab === 'menu' && <MenuTab />}
      {tab === 'panier' && <PanierTab />}
    </div>
  )
}

function Journal() {
  const today = todayISO()
  const [tmax, setTmax] = useState<number>()
  useEffect(() => {
    todayMaxTemp(today).then(setTmax)
  }, [today])
  const day = useDbQuery(() => nutritionDay(today, tmax), [today, tmax])
  const menuDay = useDbQuery(async () => (await getMenu(mondayOf(today)))?.days.find((d) => d.date === today), [today])
  if (!day) return null
  const t = day.targets
  const meals = [
    { label: 'Ce midi', plate: day.plates.dejeuner, planned: menuDay?.lunch },
    { label: 'Ce soir', plate: day.plates.diner, planned: menuDay?.dinner },
  ]

  return (
    <div className="space-y-4">
      <PageTitle sub={DAY_TYPE[t?.dayType ?? 'repos'] + ` · ${day.sessionsLabel}`}>Nutrition</PageTitle>

      <section className="card tint tint-nutri space-y-3" aria-label="Ton assiette du jour">
        <h2 className="display text-lg">Ton assiette du jour</h2>
        {meals.map((m) => {
          const r = m.planned ? recipeById(m.planned.recipeId) : undefined
          return (
            <div key={m.label}>
              <p className="font-semibold">{m.label}</p>
              <p className="text-[15px]">
                {m.plate.text} <span className="text-muted">{m.plate.examples}</span>
              </p>
              {r && <p className="text-sm mt-0.5">Au menu : <b>{r.name}</b></p>}
            </div>
          )
        })}
        <p className="text-xs text-muted">Portions normales, sans rien peser ni noter. Repères généraux, pas une prescription.</p>
      </section>

      <section className="card tint tint-eau space-y-3" aria-label="Hydratation">
        <div className="flex items-baseline justify-between">
          <h2 className="display text-lg">Eau</h2>
          <span className="num font-semibold">
            {L(day.waterMl)} / {L(day.hydration.ml)}
          </span>
        </div>
        <Gauge label="Hydratation" value={Math.round(day.waterMl / 10) / 100} target={Math.round(day.hydration.ml / 10) / 100} unit="L" color="eau" />
        <WaterButtons date={today} bottleMl={day.bottleMl} />
        {day.waterSource === 'check' && <p className="text-xs text-muted">Estimation de ton check du matin.</p>}
        {day.waterSource === 'montre' && <p className="text-xs text-muted">Eau enregistrée sur ta montre (Garmin).</p>}
        <p className="text-xs text-muted">{day.hydration.reasons.join(' ')} Pas envie de tout noter ? Le check du matin demande juste combien tu as bu la veille.</p>
      </section>

      {day.tips && (
        <details className="card" open>
          <summary className="display text-lg min-h-[44px] flex items-center">Autour de ta séance</summary>
          {(['avant', 'pendant', 'apres'] as const).map((k) => (
            <div key={k} className="mt-2">
              <p className="font-semibold">{{ avant: 'Avant', pendant: 'Pendant', apres: 'Après' }[k]}</p>
              <ul className="list-disc pl-5 text-[15px]">
                {day.tips![k].map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-xs text-muted mt-2">Repères généraux, à adapter à ta tolérance.</p>
        </details>
      )}
    </div>
  )
}
