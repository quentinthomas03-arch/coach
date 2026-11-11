import { useEffect, useMemo, useRef, useState } from 'react'
import type { FoodItem } from '../../data/types'
import { db } from '../../data/db'
import { addFood, allFoods, createCustomFood, toggleFavorite, type Meal, MEALS } from '../../app/nutrition'
import { forGrams, searchFoods } from '../../domain/foodSearch'
import { findFood, parseMeal } from '../../domain/mealParse'
import { normalPortion, portionGrams, type PortionSize } from '../../domain/portions'
import { isValidEan } from '../../integrations/ean'
import { OffError, productByBarcode, searchProducts } from '../../integrations/openfoodfacts'
import { useDbQuery } from '../useDbQuery'

interface Item {
  key: string
  food: FoodItem
  size: PortionSize
  /** Poids exact si je le connais (remplace la portion). */
  grams?: number
  alternatives: FoodItem[]
  input?: string
}

const gramsOf = (i: Item) => i.grams ?? portionGrams(i.food, i.size)
let seq = 0
const mk = (food: FoodItem, alternatives: FoodItem[] = [], input?: string): Item => ({ key: `i${seq++}`, food, size: 'normale', alternatives, input })

function Scanner({ onCode, onCancel }: { onCode: (c: string) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let stream: MediaStream | undefined
    let stop = false
    let timer: number | undefined
    ;(async () => {
      try {
        const { detectFrom } = await import('../../integrations/barcode')
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (!video.current) return
        video.current.srcObject = stream
        await video.current.play()
        const loop = async () => {
          if (stop || !video.current) return
          try {
            const code = await detectFrom(video.current)
            if (code) return onCode(code)
          } catch {
            /* image suivante */
          }
          timer = window.setTimeout(loop, 250)
        }
        loop()
      } catch {
        setErr('Caméra indisponible (autorisation refusée ?). Tape les chiffres du code-barres dans la recherche.')
      }
    })()
    return () => {
      stop = true
      if (timer) clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onCode])
  return (
    <div className="space-y-3">
      {err ? <p className="text-danger">{err}</p> : <video ref={video} playsInline muted className="w-full rounded-card bg-black aspect-[4/3] object-cover" aria-label="Aperçu caméra" />}
      <button className="btn-secondary w-full" onClick={onCancel}>
        Annuler
      </button>
    </div>
  )
}

function CustomFood({ onCreated, onBack, initialName = '' }: { onCreated: (f: FoodItem) => void; onBack: () => void; initialName?: string }) {
  const [f, setF] = useState({ name: initialName, kcal: '', protein: '', carbs: '', fat: '' })
  const n = (s: string) => Number(s.replace(',', '.'))
  const ok = f.name.trim() && f.kcal !== '' && !Number.isNaN(n(f.kcal))
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">Valeurs pour 100 g (sur l’étiquette).</p>
      <input className="field" placeholder="Nom" aria-label="Nom de l’aliment" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
          <input key={k} className="field" inputMode="decimal" aria-label={k} placeholder={{ kcal: 'kcal', protein: 'Protéines (g)', carbs: 'Glucides (g)', fat: 'Lipides (g)' }[k]} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-secondary" onClick={onBack}>
          Retour
        </button>
        <button className="btn-primary" disabled={!ok} onClick={async () => onCreated(await createCustomFood({ name: f.name.trim(), kcal: n(f.kcal), protein: n(f.protein) || 0, carbs: n(f.carbs) || 0, fat: n(f.fat) || 0 }))}>
          Créer
        </button>
      </div>
    </div>
  )
}

function ItemRow({ it, onChange, onRemove, onSwap }: { it: Item; onChange: (i: Item) => void; onRemove: () => void; onSwap: () => void }) {
  const [exact, setExact] = useState(it.grams != null)
  if (it.food.group === 'Saisie rapide')
    return (
      <li className="border-t border-line py-2.5 flex items-center justify-between gap-2">
        <span>
          <span className="font-semibold">{it.food.name}</span> <span className="text-sm text-muted num">· {it.food.kcal} kcal</span>
        </span>
        <button className="w-10 h-11 text-muted" aria-label={`Retirer ${it.food.name}`} onClick={onRemove}>
          ✕
        </button>
      </li>
    )
  const p = normalPortion(it.food)
  const g = gramsOf(it)
  const v = forGrams(it.food, g)
  return (
    <li className="border-t border-line py-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {it.input && <p className="text-xs text-muted">« {it.input} »</p>}
          <p className="font-semibold leading-snug">{it.food.name}</p>
          <p className="text-xs text-muted num">
            {g} g · {v.kcal} kcal · P {Math.round(v.protein)} g
          </p>
        </div>
        <button className="text-sm underline text-muted min-h-[44px] px-1" onClick={onSwap}>
          Changer
        </button>
        <button className="w-10 h-11 text-muted" aria-label={`Retirer ${it.food.name}`} onClick={onRemove}>
          ✕
        </button>
      </div>
      {!exact ? (
        <div className="grid grid-cols-4 gap-1.5 mt-2" role="group" aria-label="Taille de la portion">
          {(['petite', 'normale', 'grosse'] as const).map((s) => (
            <button key={s} aria-pressed={it.size === s} onClick={() => onChange({ ...it, size: s, grams: undefined })} className={`min-h-[40px] rounded-btn border text-sm ${it.size === s ? 'bg-accent text-on-accent border-transparent font-semibold' : 'bg-surface2 border-line'}`}>
              {s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
          <button className="min-h-[40px] rounded-btn border border-line bg-surface2 text-xs" onClick={() => { setExact(true); onChange({ ...it, grams: g }) }}>
            Poids exact
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-2">
          <input className="field w-28" inputMode="numeric" aria-label="Poids en grammes" value={it.grams ?? ''} onChange={(e) => onChange({ ...it, grams: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
          <span className="text-sm">g</span>
          <button className="text-sm underline text-muted min-h-[40px]" onClick={() => { setExact(false); onChange({ ...it, grams: undefined }) }}>
            Revenir aux portions
          </button>
        </div>
      )}
      {!exact && <p className="text-xs text-muted mt-1">Portion normale : {p.label} (≈ {p.g} g)</p>}
    </li>
  )
}

/** Saisie rapide (comme MyFitnessPal) : juste des calories, quand je n'ai pas envie de détailler. */
function QuickKcal({ onAdd }: { onAdd: (f: FoodItem) => void }) {
  const [kcal, setKcal] = useState('')
  const [name, setName] = useState('')
  const v = Number(kcal)
  return (
    <details className="card">
      <summary className="font-semibold min-h-[40px] flex items-center">Saisie rapide (juste les calories)</summary>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <input className="field" inputMode="numeric" placeholder="kcal" aria-label="Calories" value={kcal} onChange={(e) => setKcal(e.target.value.replace(/\D/g, ''))} />
        <input className="field" placeholder="ex. resto" aria-label="Nom (facultatif)" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <button
        className="btn-secondary w-full mt-2"
        disabled={!v || v > 5000}
        onClick={() => {
          onAdd({ id: `rapide-${Date.now().toString(36)}`, source: 'perso', name: name.trim() || 'Saisie rapide', kcal: v, protein: 0, carbs: 0, fat: 0, group: 'Saisie rapide' })
          setKcal('')
          setName('')
        }}
      >
        Ajouter au repas
      </button>
      <p className="text-xs text-muted mt-1">Les protéines ne sont pas comptées : le coach te le rappellera.</p>
    </details>
  )
}

/** Ajout d'un repas : décrire, chercher, favoris, scanner ; portions sans pesée. */
export function AddFood({ date, meal: initialMeal, onClose }: { date: string; meal: Meal; onClose: () => void }) {
  const [meal, setMeal] = useState<Meal>(initialMeal)
  const [desc, setDesc] = useState('')
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [mode, setMode] = useState<'main' | 'scan' | 'custom'>('main')
  const [swapKey, setSwapKey] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [offResults, setOffResults] = useState<FoodItem[]>([])
  const [busy, setBusy] = useState(false)
  const foods = useDbQuery(() => allFoods(), [])
  const mine = useDbQuery(() => db.foods.toArray(), [])
  const results = useMemo(() => (foods && q.trim().length >= 2 ? searchFoods(q, foods, 25) : []), [foods, q])
  const favs = (mine ?? []).filter((f) => f.favorite)
  const recents = (mine ?? []).filter((f) => f.lastUsedAt && !f.favorite).sort((a, b) => ((a.lastUsedAt ?? '') < (b.lastUsedAt ?? '') ? 1 : -1)).slice(0, 10)
  const digits = q.replace(/\s/g, '')
  const total = items.reduce((a, i) => a + forGrams(i.food, gramsOf(i)).kcal, 0)
  const withMine = (f: FoodItem) => (mine ?? []).find((m) => m.id === f.id) ?? f

  const add = (f: FoodItem, alts: FoodItem[] = []) => {
    if (swapKey) {
      setItems(items.map((i) => (i.key === swapKey ? { ...i, food: withMine(f), grams: undefined } : i)))
      setSwapKey(null)
    } else setItems([...items, mk(withMine(f), alts)])
    setQ('')
    setOffResults([])
  }
  const lookup = async (code: string) => {
    setMode('main')
    setMsg('Recherche du produit…')
    try {
      const p = (mine ?? []).find((f) => f.barcode === code) ?? (await productByBarcode(code))
      if (p) {
        setMsg('')
        add(p)
      } else {
        setMsg(`Produit ${code} absent d’Open Food Facts : crée-le avec les valeurs de l’étiquette.`)
        setMode('custom')
      }
    } catch (e) {
      setMsg(e instanceof OffError ? e.message : 'Erreur de recherche.')
    }
  }
  const swapping = items.find((i) => i.key === swapKey)

  const FoodRow = ({ f, sub }: { f: FoodItem; sub?: string }) => (
    <li className="flex items-center gap-2 border-t border-line">
      <button className="flex-1 text-left py-2.5 min-h-[48px]" onClick={() => add(f)}>
        <span className="block leading-snug">{f.name}</span>
        <span className="block text-xs text-muted">
          {sub ?? `${normalPortion(withMine(f)).label} · ${Math.round((f.kcal * normalPortion(withMine(f)).g) / 100)} kcal`}
          {f.source === 'off' ? ' · produit' : f.group === 'Plat courant (estimé)' ? ' · estimé' : ''}
        </span>
      </button>
      <button aria-label={withMine(f).favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} className="w-11 h-11 text-xl" onClick={() => toggleFavorite(f)}>
        {withMine(f).favorite ? '★' : '☆'}
      </button>
    </li>
  )

  return (
    <div className="fixed inset-0 z-30 bg-bg overflow-y-auto px-4 pt-[max(env(safe-area-inset-top),16px)] pb-32" role="dialog" aria-label="Ajouter un repas">
      <div className="flex items-center justify-between mb-2">
        <h2 className="display text-xl">{swapping ? 'Remplacer' : 'Ajouter'}</h2>
        <button className="min-h-[44px] px-2 text-muted" onClick={swapping ? () => setSwapKey(null) : onClose}>
          {swapping ? 'Retour' : 'Fermer'}
        </button>
      </div>
      {!swapping && (
        <div className="grid grid-cols-4 gap-1 mb-3" role="group" aria-label="Repas">
          {MEALS.map((m) => (
            <button key={m.id} aria-pressed={meal === m.id} onClick={() => setMeal(m.id)} className={`min-h-[40px] rounded-btn border text-xs ${meal === m.id ? 'bg-accent text-on-accent border-transparent font-semibold' : 'bg-surface2 border-line'}`}>
              {m.label.replace('Petit-déjeuner', 'Petit-déj')}
            </button>
          ))}
        </div>
      )}
      {msg && <p className="text-sm mb-2" role="status">{msg}</p>}

      {mode === 'scan' && <Scanner onCode={lookup} onCancel={() => setMode('main')} />}
      {mode === 'custom' && <CustomFood initialName={q && !isValidEan(digits) ? q : ''} onBack={() => setMode('main')} onCreated={(f) => { setMode('main'); add(f) }} />}

      {mode === 'main' && (
        <div className="space-y-4">
          {swapping ? (
            <section>
              <p className="text-sm text-muted mb-1">Au lieu de « {swapping.food.name} » :</p>
              <ul>{swapping.alternatives.map((f) => <FoodRow key={f.id} f={f} />)}</ul>
            </section>
          ) : (
            <section className="card space-y-2">
              <label className="font-semibold block" htmlFor="desc">
                Décris ton repas
              </label>
              <textarea id="desc" className="field py-2 min-h-[72px]" placeholder="ex. colin pané, écrasé de pommes de terre, fondue de poireaux" value={desc} onChange={(e) => setDesc(e.target.value)} />
              <button
                className="btn-primary w-full"
                disabled={!desc.trim() || !foods || busy}
                onClick={() => {
                  setBusy(true)
                  const parsed = parseMeal(desc, foods!)
                  const found = parsed.filter((p) => p.best)
                  setItems([...items, ...found.map((p) => mk(withMine(p.best!), p.alternatives, p.input))])
                  const missing = parsed.filter((p) => !p.best).map((p) => `« ${p.input} »`)
                  setMsg(missing.length ? `Pas trouvé : ${missing.join(', ')}. Cherche-les ci-dessous ou crée-les.` : '')
                  setDesc('')
                  setBusy(false)
                }}
              >
                Trouver les aliments
              </button>
            </section>
          )}

          {items.length > 0 && !swapping && (
            <section className="card">
              <h3 className="font-semibold">Ton repas</h3>
              <ul>
                {items.map((it) => (
                  <ItemRow
                    key={it.key}
                    it={it}
                    onChange={(n) => setItems(items.map((x) => (x.key === n.key ? n : x)))}
                    onRemove={() => setItems(items.filter((x) => x.key !== it.key))}
                    onSwap={() => {
                      if (!it.alternatives.length && foods) it.alternatives = findFood(it.input ?? it.food.name, foods).filter((f) => f.id !== it.food.id).slice(0, 6)
                      setSwapKey(it.key)
                    }}
                  />
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-2">
            <input className="field" placeholder={swapping ? 'Ou cherche un autre aliment' : 'Ou cherche un aliment (ou tape un code-barres)'} aria-label="Rechercher un aliment" value={q} onChange={(e) => setQ(e.target.value)} />
            {!swapping && (
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-secondary" onClick={() => setMode('scan')}>
                  Scanner
                </button>
                <button className="btn-secondary" onClick={() => setMode('custom')}>
                  Créer un aliment
                </button>
              </div>
            )}
            {isValidEan(digits) && (
              <button className="btn-secondary w-full" onClick={() => lookup(digits)}>
                Chercher le code {digits}
              </button>
            )}
            {q.trim().length >= 2 && (
              <>
                <ul>{results.map((f) => <FoodRow key={f.id} f={f} />)}</ul>
                {!results.length && <p className="text-sm text-muted">Rien trouvé dans la table Ciqual ni dans tes aliments.</p>}
                <button
                  className="btn-secondary w-full"
                  onClick={async () => {
                    setMsg('Recherche dans Open Food Facts…')
                    try {
                      setOffResults(await searchProducts(q))
                      setMsg('')
                    } catch (e) {
                      setMsg(e instanceof OffError ? e.message : 'Erreur de recherche.')
                    }
                  }}
                >
                  Chercher un produit de marque (Open Food Facts)
                </button>
                {offResults.length > 0 && <ul>{offResults.map((f) => <FoodRow key={f.id} f={f} />)}</ul>}
              </>
            )}
          </section>

          {!swapping && q.trim().length < 2 && <QuickKcal onAdd={(f) => setItems([...items, { ...mk(f), grams: 100 }])} />}

          {!swapping && q.trim().length < 2 && (
            <>
              {favs.length > 0 && (
                <section>
                  <h3 className="font-semibold">Favoris</h3>
                  <ul>{favs.map((f) => <FoodRow key={f.id} f={f} />)}</ul>
                </section>
              )}
              {recents.length > 0 && (
                <section>
                  <h3 className="font-semibold">Récents</h3>
                  <ul>{recents.map((f) => <FoodRow key={f.id} f={f} />)}</ul>
                </section>
              )}
              <p className="text-xs text-muted">Pas besoin de peser : « Normale » correspond à une portion habituelle d’adulte. Valeurs : table Ciqual de l’Anses, Open Food Facts pour les produits.</p>
            </>
          )}
        </div>
      )}

      {items.length > 0 && !swapping && mode === 'main' && (
        <div className="fixed bottom-0 inset-x-0 bg-surface/95 backdrop-blur border-t border-line px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
          <button
            className="btn-primary w-full"
            onClick={async () => {
              for (const it of items) await addFood(date, meal, it.food, gramsOf(it), db, it.grams != null)
              onClose()
            }}
          >
            Ajouter au {MEALS.find((m) => m.id === meal)!.label.toLowerCase()} · {items.length} aliment{items.length > 1 ? 's' : ''} · {total} kcal
          </button>
        </div>
      )}
    </div>
  )
}
