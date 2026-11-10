import { useEffect, useState } from 'react'
import { db } from '../../data/db'
import { addSavedMeal, addWater, copyMeal, deleteSavedMeal, getSavedMeals, MEALS, nutritionDay, removeEntry, saveMeal, todayMaxTemp, undoLastWater, yesterday, type Meal } from '../../app/nutrition'
import { addDays, formatLongFr, todayISO } from '../../domain/dates'
import { AddFood } from '../components/AddFood'
import { Gauge } from '../components/Segmented'
import { useDbQuery } from '../useDbQuery'
import { PageTitle } from '../Layout'
import { MenuTab, PanierTab } from './NutritionPlanning'
import { getMenu, logRecipe } from '../../app/menu'
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
  { id: 'journal', label: 'Journal' },
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
  const [date, setDate] = useState(today)
  const [adding, setAdding] = useState<Meal | null>(null)
  const [tmax, setTmax] = useState<number>()
  useEffect(() => {
    todayMaxTemp(today).then(setTmax)
  }, [today])
  const day = useDbQuery(() => nutritionDay(date, date === today ? tmax : undefined), [date, tmax])
  const saved = useDbQuery(() => getSavedMeals(), [])
  const menuDay = useDbQuery(async () => (await getMenu(mondayOf(date)))?.days.find((d) => d.date === date), [date])
  if (!day) return null
  const t = day.targets

  return (
    <div className="space-y-4">
      <PageTitle sub={DAY_TYPE[t?.dayType ?? 'repos'] + ` · ${day.sessionsLabel}`}>Nutrition</PageTitle>

      <div className="flex items-center justify-between">
        <button className="min-h-[44px] px-3 text-lg" aria-label="Jour précédent" onClick={() => setDate(addDays(date, -1))}>
          ‹
        </button>
        <p className="font-semibold first-letter:uppercase">{date === today ? 'Aujourd’hui' : formatLongFr(date)}</p>
        <button className="min-h-[44px] px-3 text-lg disabled:opacity-30" aria-label="Jour suivant" disabled={date >= today} onClick={() => setDate(addDays(date, 1))}>
          ›
        </button>
      </div>

      {day.missingProfile ? (
        <section className="card">Renseigne ta taille et ton poids dans Réglages › Nutrition pour calculer tes objectifs.</section>
      ) : (
        t && (
          <section className="card space-y-3" aria-label="Objectifs du jour">
            <div className="flex items-baseline justify-between">
              <h2 className="display text-lg">Objectifs du jour</h2>
              <span className="num text-2xl font-bold">
                {day.eaten.kcal}
                <span className="text-sm text-muted font-normal"> / {t.kcal} kcal</span>
              </span>
            </div>
            <Gauge label="Protéines" value={day.eaten.protein} target={t.protein} unit="g" />
            <Gauge label="Glucides" value={day.eaten.carbs} target={t.carbs} unit="g" />
            <Gauge label="Lipides" value={day.eaten.fat} target={t.fat} unit="g" />
            <details className="text-sm text-muted">
              <summary className="min-h-[44px] flex items-center font-medium text-ink">Comment c’est calculé</summary>
              <p>
                Métabolisme de base {t.bmr} kcal (Mifflin-St Jeor) × activité quotidienne + séances {t.exerciseKcal} kcal = {t.tdee} kcal. Protéines ~1,6 g/kg, lipides ≥ 25 %, glucides le reste (repère du jour : {t.carbRangeGkg[0]} à {t.carbRangeGkg[1]} g/kg).
              </p>
              {t.notes.map((n) => (
                <p key={n} className="mt-1">{n}</p>
              ))}
              <p className="mt-1">Repères généraux, pas une prescription. Pour une situation particulière, demande conseil à un médecin ou un diététicien.</p>
            </details>
          </section>
        )
      )}

      <section className="card space-y-3" aria-label="Hydratation">
        <div className="flex items-baseline justify-between">
          <h2 className="display text-lg">Eau</h2>
          <span className="num font-semibold">
            {L(day.waterMl)} / {L(day.hydration.ml)}
          </span>
        </div>
        <Gauge label="Hydratation" value={Math.round(day.waterMl / 10) / 100} target={Math.round(day.hydration.ml / 10) / 100} unit="L" />
        {date === today && <WaterButtons date={date} bottleMl={day.bottleMl} />}
        {day.waterSource === 'check' && <p className="text-xs text-muted">Estimation de ton check du matin.</p>}
        {day.waterSource === 'montre' && <p className="text-xs text-muted">Eau enregistrée sur ta montre (Garmin).</p>}
        <p className="text-xs text-muted">{day.hydration.reasons.join(' ')} Pas envie de tout noter ? Le check du matin demande juste combien tu as bu la veille.</p>
      </section>

      {day.tips && date === today && (
        <details className="card">
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

      {MEALS.map((m) => {
        const list = day.entries.filter((e) => e.meal === m.id)
        const kcal = list.reduce((a, e) => a + e.kcal, 0)
        const mineSaved = (saved ?? []).slice(0, 4)
        return (
          <section key={m.id} className="card" aria-label={m.label}>
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold text-lg">{m.label}</h2>
              <span className="num text-sm text-muted">{Math.round(kcal)} kcal</span>
            </div>
            <ul>
              {list.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 border-t border-line py-2">
                  <span className="min-w-0">
                    <span className="block truncate">{e.name}</span>
                    <span className="block text-xs text-muted num">
                      {e.grams} g · {Math.round(e.kcal)} kcal · P {Math.round(e.protein)} g
                    </span>
                  </span>
                  <button className="w-11 h-11 text-muted" aria-label={`Retirer ${e.name}`} onClick={() => removeEntry(e.id!)}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            {(() => {
              const planned = m.id === 'dejeuner' ? menuDay?.lunch : m.id === 'diner' ? menuDay?.dinner : undefined
              const r = planned ? recipeById(planned.recipeId) : undefined
              if (!r || list.some((e) => e.foodId === `recette-${r.id}`)) return null
              return (
                <button className="w-full text-left mt-2 rounded-btn border border-accent-ink/40 bg-accent/15 px-3 py-2 min-h-[48px]" onClick={() => logRecipe(r.id, date, m.id)}>
                  <span className="block text-xs text-muted">Au menu</span>
                  <span className="block font-semibold">{r.name} · Je l’ai mangé</span>
                </button>
              )
            })()}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button className="btn-primary" onClick={() => setAdding(m.id)}>
                + Ajouter
              </button>
              <button className="btn-secondary" onClick={() => copyMeal(yesterday(date), date, m.id)}>
                Comme la veille
              </button>
            </div>
            {mineSaved.length > 0 && (
              <div className="flex gap-2 mt-2 overflow-x-auto">
                {mineSaved.map((s) => (
                  <button key={s.id} className="shrink-0 min-h-[40px] px-3 rounded-full bg-surface2 border border-line text-sm" onClick={() => addSavedMeal(date, m.id, s)}>
                    + {s.name}
                  </button>
                ))}
              </div>
            )}
            {list.length > 0 && (
              <button
                className="text-sm underline text-muted mt-2 min-h-[44px]"
                onClick={async () => {
                  const name = prompt('Nom de ce repas (ex. « Petit-déj habituel ») :')
                  if (name) await saveMeal(date, m.id, name.trim())
                }}
              >
                Mémoriser ce repas
              </button>
            )}
          </section>
        )
      })}

      {(saved ?? []).length > 0 && (
        <details className="card">
          <summary className="font-semibold min-h-[44px] flex items-center">Mes repas mémorisés</summary>
          <ul>
            {(saved ?? []).map((s) => (
              <li key={s.id} className="flex items-center justify-between border-t border-line py-2">
                <span>
                  {s.name} <span className="text-xs text-muted">· {Math.round(s.items.reduce((a, i) => a + i.kcal, 0))} kcal</span>
                </span>
                <button className="text-sm text-muted underline min-h-[44px]" onClick={() => deleteSavedMeal(s.id)}>
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <History today={today} />
      {adding && <AddFood date={date} meal={adding} onClose={() => setAdding(null)} />}
    </div>
  )
}

function History({ today }: { today: string }) {
  const rows = useDbQuery(async () => {
    const from = addDays(today, -13)
    const e = await db.foodLog.where('date').between(from, today, true, true).toArray()
    const w = await db.hydration.where('date').between(from, today, true, true).toArray()
    return Array.from({ length: 14 }, (_, i) => addDays(today, -i)).map((d) => ({
      d,
      kcal: Math.round(e.filter((x) => x.date === d).reduce((a, x) => a + x.kcal, 0)),
      p: Math.round(e.filter((x) => x.date === d).reduce((a, x) => a + x.protein, 0)),
      water: w.filter((x) => x.date === d).reduce((a, x) => a + x.ml, 0),
    }))
  }, [today])
  const filled = (rows ?? []).filter((r) => r.kcal > 0)
  if (!filled.length) return null
  const avg = Math.round(filled.reduce((a, r) => a + r.kcal, 0) / filled.length)
  return (
    <details className="card">
      <summary className="font-semibold min-h-[44px] flex items-center">Historique et tendances (14 jours)</summary>
      <p className="text-sm text-muted">
        Moyenne : <strong className="text-ink num">{avg} kcal</strong> sur {filled.length} jour(s) saisi(s).
      </p>
      <table className="w-full text-sm num mt-2">
        <thead>
          <tr className="text-muted text-left">
            <th className="font-normal py-1">Jour</th>
            <th className="font-normal text-right">kcal</th>
            <th className="font-normal text-right">Prot.</th>
            <th className="font-normal text-right">Eau</th>
          </tr>
        </thead>
        <tbody>
          {(rows ?? []).map((r) => (
            <tr key={r.d} className="border-t border-line">
              <td className="py-1 first-letter:uppercase">{formatLongFr(r.d).split(' ').slice(0, 2).join(' ')}</td>
              <td className="text-right">{r.kcal || '—'}</td>
              <td className="text-right">{r.p ? `${r.p} g` : '—'}</td>
              <td className="text-right">{r.water ? L(r.water) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
