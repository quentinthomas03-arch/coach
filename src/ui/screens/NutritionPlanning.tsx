import { useState } from 'react'
import { buildMenu, clearBasket, getBasket, getMenu, logRecipe, nutrientTable, setIncludePantry, setMeal, shoppingFor, thisMonday, toggleBasket, toggleChecked } from '../../app/menu'
import { MEALS, type Meal } from '../../app/nutrition'
import { addDays, formatLongFr, parseISODate, todayISO } from '../../domain/dates'
import { basketIdeas, formatQty, recipeNutrients, RAYON_ORDER, shoppingText, type NutrientTable } from '../../domain/menu'
import { RECIPES, recipeById, type Recipe } from '../../domain/recipes'
import { PRODUCE, inSeason } from '../../domain/seasons'
import { useDbQuery } from '../useDbQuery'
import { db } from '../../data/db'

const day2 = (d: string) => formatLongFr(d).split(' ').slice(0, 2).join(' ')

function RecipeSheet({ r, table, onClose, onChoose, date }: { r: Recipe; table?: NutrientTable; onClose: () => void; onChoose?: () => void; date?: string }) {
  const n = table ? recipeNutrients(r, table) : undefined
  const [meal, setMealSlot] = useState<Meal>('dejeuner')
  const [done, setDone] = useState(false)
  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end" onClick={onClose}>
      <div role="dialog" aria-label={r.name} className="w-full bg-surface rounded-t-[24px] p-4 pb-[max(env(safe-area-inset-bottom),16px)] max-h-[88dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1.5 bg-line rounded-full mx-auto mb-3" />
        <h2 className="display text-2xl leading-tight">{r.name}</h2>
        <p className="text-sm text-muted">
          {r.minutes} min{r.portions > 1 ? ` · ${r.portions} portions (se garde 2-3 jours)` : ' · 1 portion'}
        </p>
        {n && (
          <p className="num font-semibold mt-2">
            Par portion : {n.kcal} kcal · P {n.protein} g · G {n.carbs} g · L {n.fat} g
          </p>
        )}
        <h3 className="font-semibold mt-3">Ingrédients{r.portions > 1 ? ` (pour ${r.portions})` : ''}</h3>
        <ul className="text-[15px]">
          {r.ingredients.map((i) => (
            <li key={i.name} className="flex justify-between border-t border-line py-1.5">
              <span>{i.name}</span>
              <span className="num text-muted">{formatQty(Math.round((i.g * r.portions) / 5) * 5)}</span>
            </li>
          ))}
        </ul>
        <h3 className="font-semibold mt-3">Préparation</h3>
        <ol className="list-decimal pl-5 space-y-1 text-[15px]">
          {r.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {date && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">Ajouter une portion au journal :</p>
            <div className="grid grid-cols-4 gap-1">
              {MEALS.map((m) => (
                <button key={m.id} className={`min-h-[44px] rounded-btn border text-xs ${meal === m.id ? 'bg-accent text-on-accent border-transparent' : 'bg-surface2 border-line'}`} onClick={() => setMealSlot(m.id)}>
                  {m.label.replace('Petit-déjeuner', 'Petit-déj')}
                </button>
              ))}
            </div>
            <button className="btn-primary w-full" disabled={done} onClick={async () => { await logRecipe(r.id, date, meal); setDone(true) }}>
              {done ? 'Ajouté ✓' : 'Je l’ai mangé'}
            </button>
          </div>
        )}
        {onChoose && (
          <button className="btn-primary w-full mt-2" onClick={onChoose}>
            Choisir cette recette
          </button>
        )}
        <button className="btn-secondary w-full mt-2" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  )
}

export function MenuTab() {
  const today = todayISO()
  const [offset, setOffset] = useState(0)
  const monday = addDays(thisMonday(today), offset * 7)
  const menu = useDbQuery(() => getMenu(monday), [monday])
  const table = useDbQuery(() => nutrientTable(), [])
  const [open, setOpen] = useState<{ r: Recipe; date: string } | null>(null)
  const [swap, setSwap] = useState<{ date: string; slot: 'lunch' | 'dinner' } | null>(null)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button className={offset === 0 ? 'btn-primary' : 'btn-secondary'} onClick={() => setOffset(0)}>
          Cette semaine
        </button>
        <button className={offset === 1 ? 'btn-primary' : 'btn-secondary'} onClick={() => setOffset(1)}>
          La suivante
        </button>
      </div>
      {!menu ? (
        <section className="card space-y-2">
          <p>Le coach compose tes déjeuners et dîners selon tes séances (féculents la veille des sorties longues, protéines après), la saison et ton panier du maraîcher.</p>
          <button className="btn-primary w-full" onClick={() => buildMenu(monday)}>
            Proposer le menu de la semaine
          </button>
        </section>
      ) : (
        <>
          {menu.days.map((d) => (
            <section key={d.date} className={`card py-3 ${d.date === today ? 'ring-2 ring-accent-ink' : ''}`}>
              <p className="text-sm font-semibold text-muted first-letter:uppercase">{day2(d.date)}</p>
              {(['lunch', 'dinner'] as const).map((slot) => {
                const m = d[slot]
                const r = recipeById(m.recipeId)
                if (!r) return null
                const n = table ? recipeNutrients(r, table) : undefined
                return (
                  <div key={slot} className="flex items-start gap-2 mt-1.5">
                    <button className="flex-1 text-left min-h-[44px]" onClick={() => setOpen({ r, date: d.date })}>
                      <span className="text-xs text-muted">{slot === 'lunch' ? 'Midi' : 'Soir'}{m.locked ? ' · 🔒 choisi par toi' : ''}</span>
                      <span className="block font-semibold leading-snug">
                        {r.name}
                        {m.leftover && <span className="text-muted font-normal"> (reste)</span>}
                      </span>
                      <span className="block text-xs text-muted">
                        {n ? `${n.kcal} kcal · ` : ''}
                        {m.why}
                      </span>
                    </button>
                    <button className="text-sm underline text-muted min-h-[44px] px-1" onClick={() => setSwap({ date: d.date, slot })}>
                      Changer
                    </button>
                  </div>
                )
              })}
            </section>
          ))}
          <button className="btn-secondary w-full" onClick={() => buildMenu(monday)}>
            Recalculer (garde mes choix)
          </button>
          <p className="text-xs text-muted">Petits-déjeuners et collations : vois les idées dans « Panier » ou ajoute tes favoris dans le journal.</p>
        </>
      )}
      {swap && (
        <div className="fixed inset-0 z-30 bg-bg overflow-y-auto px-4 pt-[max(env(safe-area-inset-top),16px)] pb-6" role="dialog" aria-label="Choisir une recette">
          <div className="flex items-center justify-between mb-3">
            <h2 className="display text-xl">Remplacer le repas</h2>
            <button className="min-h-[44px] px-2 text-muted" onClick={() => setSwap(null)}>
              Fermer
            </button>
          </div>
          <ul>
            {RECIPES.filter((r) => !r.tags.includes('petit-dej')).map((r) => (
              <li key={r.id} className="border-t border-line">
                <button
                  className="w-full text-left py-2.5 min-h-[48px]"
                  onClick={async () => {
                    await setMeal(monday, swap.date, swap.slot, r.id)
                    setSwap(null)
                  }}
                >
                  <span className="block">{r.name}</span>
                  <span className="block text-xs text-muted">
                    {r.minutes} min · {r.tags.filter((t) => t !== 'petit-dej').join(', ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {open && <RecipeSheet r={open.r} table={table} date={open.date <= today ? open.date : undefined} onClose={() => setOpen(null)} />}
    </div>
  )
}

export function CoursesTab() {
  const today = todayISO()
  const monday = thisMonday(today)
  const data = useDbQuery(() => shoppingFor(monday, today), [monday, today])
  const [msg, setMsg] = useState('')
  if (!data) return <section className="card">Commence par proposer le menu de la semaine (onglet Menu) : la liste de courses en découle.</section>
  const { items, checked } = data
  const toBuy = items.filter((i) => !i.inBasket)
  const share = async () => {
    const text = shoppingText(items, checked)
    try {
      if (navigator.share) await navigator.share({ title: 'Liste de courses', text })
      else {
        await navigator.clipboard.writeText(text)
        setMsg('Liste copiée.')
      }
    } catch {
      /* partage annulé */
    }
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-primary" onClick={share}>
          Partager la liste
        </button>
        <button className="btn-secondary" onClick={() => setIncludePantry(monday, !data.includePantry)}>
          {data.includePantry ? 'Sans le placard' : 'Avec le placard'}
        </button>
      </div>
      {msg && <p role="status" className="text-sm text-ok">{msg}</p>}
      <p className="text-sm text-muted">
        {toBuy.filter((i) => !checked.has(i.key)).length} article(s) à acheter pour les repas à venir (1 personne). Féculents en poids sec.
      </p>
      {RAYON_ORDER.map((r) => {
        const list = items.filter((i) => i.rayon === r)
        if (!list.length) return null
        return (
          <section key={r} className="card py-2">
            <h3 className="font-semibold py-1">{r}</h3>
            <ul>
              {list.map((i) => {
                const done = checked.has(i.key) || i.inBasket
                return (
                  <li key={i.key} className="border-t border-line">
                    <button className="w-full flex items-center gap-3 py-2 min-h-[48px] text-left" disabled={i.inBasket} onClick={() => toggleChecked(monday, i.key)} aria-pressed={done}>
                      <span aria-hidden className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 ${done ? 'bg-accent-ink border-accent-ink text-white' : 'border-line'}`}>
                        {done ? '✓' : ''}
                      </span>
                      <span className={`flex-1 ${done ? 'line-through text-muted' : ''}`}>{i.name}</span>
                      <span className="num text-sm text-muted">{i.inBasket ? 'dans le panier' : formatQty(i.grams)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

export function PanierTab() {
  const today = todayISO()
  const month = parseISODate(today).getMonth() + 1
  const data = useDbQuery(async () => ({ basket: await getBasket(), dislikes: (await db.profile.get('me'))?.foodDislikes ?? [] }), [])
  const table = useDbQuery(() => nutrientTable(), [])
  const [showAll, setShowAll] = useState(false)
  const [open, setOpen] = useState<Recipe | null>(null)
  if (!data) return null
  const has = (id: string) => data.basket.some((b) => b.produce === id)
  const season = inSeason(month)
  const list = showAll ? PRODUCE : season
  const ideas = basketIdeas(data.basket, RECIPES, data.dislikes)
  return (
    <div className="space-y-3">
      <section className="card">
        <h3 className="font-semibold">Ce que j’ai acheté chez le maraîcher</h3>
        <p className="text-sm text-muted mb-2">Touche les fruits et légumes de ton panier. {showAll ? 'Tous les produits.' : `De saison en ${new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date(2026, month - 1, 1))}.`}</p>
        <div className="flex flex-wrap gap-2">
          {list.map((p) => (
            <button key={p.id} aria-pressed={has(p.id)} onClick={() => toggleBasket(p.id, today)} className={`min-h-[40px] px-3 rounded-full border text-sm ${has(p.id) ? 'bg-accent text-on-accent border-transparent font-semibold' : 'bg-surface2 border-line'}`}>
              {p.name}
              {p.fragile ? ' ·' : ''}
            </button>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          <button className="text-sm underline text-muted min-h-[44px]" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Seulement la saison' : 'Voir tous les produits'}
          </button>
          {data.basket.length > 0 && (
            <button className="text-sm underline text-muted min-h-[44px]" onClick={() => clearBasket()}>
              Vider le panier
            </button>
          )}
        </div>
        <p className="text-xs text-muted">« · » = se garde peu, à cuisiner en premier. Le menu de la semaine utilise ton panier en priorité (onglet Menu › Recalculer).</p>
      </section>
      {ideas.length > 0 && (
        <section className="card">
          <h3 className="font-semibold mb-1">Idées avec ton panier</h3>
          <ul>
            {ideas.map(({ recipe, uses }) => (
              <li key={recipe.id} className="border-t border-line">
                <button className="w-full text-left py-2.5 min-h-[48px]" onClick={() => setOpen(recipe)}>
                  <span className="block font-semibold">{recipe.name}</span>
                  <span className="block text-xs text-muted">
                    {recipe.minutes} min · utilise : {uses.join(', ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="card">
        <h3 className="font-semibold">De saison ce mois-ci</h3>
        <p className="text-sm text-muted">
          Légumes : {season.filter((p) => p.kind === 'legume').map((p) => p.name.toLowerCase()).join(', ')}.
        </p>
        <p className="text-sm text-muted mt-1">Fruits : {season.filter((p) => p.kind === 'fruit').map((p) => p.name.toLowerCase()).join(', ') || '—'}.</p>
      </section>
      {open && <RecipeSheet r={open} table={table} date={today} onClose={() => setOpen(null)} />}
    </div>
  )
}
