import { useEffect, useMemo, useRef, useState } from 'react'
import type { FoodItem } from '../../data/types'
import { db } from '../../data/db'
import { addFood, allFoods, createCustomFood, toggleFavorite, type Meal } from '../../app/nutrition'
import { forGrams, searchFoods } from '../../domain/foodSearch'
import { isValidEan } from '../../integrations/ean'
import { OffError, productByBarcode, searchProducts } from '../../integrations/openfoodfacts'
import { useDbQuery } from '../useDbQuery'

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
        setErr('Caméra indisponible (autorisation refusée ?). Tape les chiffres du code-barres à la place.')
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
      <p className="text-sm text-muted">Centre le code-barres, bien éclairé et à plat.</p>
      <button className="btn-secondary w-full" onClick={onCancel}>
        Annuler
      </button>
    </div>
  )
}

function Grams({ food, onAdd, onBack }: { food: FoodItem; onAdd: (g: number) => void; onBack: () => void }) {
  const [g, setG] = useState(food.portionG ?? 100)
  const v = forGrams(food, g)
  const chips = [...new Set([food.portionG, 50, 100, 150, 200, 250].filter((x): x is number => !!x))]
  return (
    <div className="space-y-3">
      <p className="font-semibold">{food.name}</p>
      <p className="text-sm text-muted">
        Pour 100 g : {food.kcal} kcal · P {food.protein} · G {food.carbs} · L {food.fat}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {chips.map((c) => (
          <button key={c} className={`min-h-[48px] rounded-btn border num ${g === c ? 'bg-accent text-on-accent border-transparent font-semibold' : 'bg-surface2 border-line'}`} onClick={() => setG(c)}>
            {c} g{c === food.portionG ? ' ★' : ''}
          </button>
        ))}
      </div>
      <label className="label" htmlFor="grams">
        Ou quantité exacte (g)
      </label>
      <input id="grams" className="field" inputMode="numeric" value={g} onChange={(e) => setG(Number(e.target.value.replace(/\D/g, '')) || 0)} />
      <p className="num font-semibold">
        {v.kcal} kcal · P {v.protein} g · G {v.carbs} g · L {v.fat} g
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-secondary" onClick={onBack}>
          Retour
        </button>
        <button className="btn-primary" disabled={!g} onClick={() => onAdd(g)}>
          Ajouter
        </button>
      </div>
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
        <button
          className="btn-primary"
          disabled={!ok}
          onClick={async () => onCreated(await createCustomFood({ name: f.name.trim(), kcal: n(f.kcal), protein: n(f.protein) || 0, carbs: n(f.carbs) || 0, fat: n(f.fat) || 0 }))}
        >
          Créer
        </button>
      </div>
    </div>
  )
}

/** Ajout d'un aliment : recherche, favoris, récents, scan, saisie du code, aliment perso. */
export function AddFood({ date, meal, onClose }: { date: string; meal: Meal; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [mode, setMode] = useState<'search' | 'scan' | 'grams' | 'custom'>('search')
  const [picked, setPicked] = useState<FoodItem>()
  const [msg, setMsg] = useState('')
  const [offResults, setOffResults] = useState<FoodItem[]>([])
  const foods = useDbQuery(() => allFoods(), [])
  const mine = useDbQuery(() => db.foods.toArray(), [])
  const results = useMemo(() => (foods && q.trim().length >= 2 ? searchFoods(q, foods) : []), [foods, q])
  const favs = (mine ?? []).filter((f) => f.favorite)
  const recents = (mine ?? []).filter((f) => f.lastUsedAt).sort((a, b) => ((a.lastUsedAt ?? '') < (b.lastUsedAt ?? '') ? 1 : -1)).slice(0, 12)
  const digits = q.replace(/\s/g, '')

  const pick = (f: FoodItem) => {
    setPicked((mine ?? []).find((m) => m.id === f.id) ?? f)
    setMode('grams')
  }
  const lookup = async (code: string) => {
    setMsg('Recherche du produit…')
    try {
      const known = (mine ?? []).find((f) => f.barcode === code)
      const p = known ?? (await productByBarcode(code))
      if (p) {
        setMsg('')
        pick(p)
      } else {
        setMsg(`Produit ${code} absent d’Open Food Facts : crée-le avec les valeurs de l’étiquette.`)
        setMode('custom')
      }
    } catch (e) {
      setMsg(e instanceof OffError ? e.message : 'Erreur de recherche.')
      setMode('search')
    }
  }

  const Row = ({ f }: { f: FoodItem }) => (
    <li className="flex items-center gap-2 border-t border-line">
      <button className="flex-1 text-left py-2.5 min-h-[48px]" onClick={() => pick(f)}>
        <span className="block">{f.name}</span>
        <span className="block text-xs text-muted">
          {f.kcal} kcal/100 g{f.group ? ` · ${f.group}` : ''}
          {f.source === 'off' ? ' · produit' : f.source === 'perso' ? ' · perso' : ''}
        </span>
      </button>
      <button aria-label={f.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} className="w-11 h-11 text-xl" onClick={() => toggleFavorite(f)}>
        {(mine ?? []).find((m) => m.id === f.id)?.favorite ? '★' : '☆'}
      </button>
    </li>
  )

  return (
    <div className="fixed inset-0 z-30 bg-bg overflow-y-auto px-4 pt-[max(env(safe-area-inset-top),16px)] pb-[max(env(safe-area-inset-bottom),16px)]" role="dialog" aria-label="Ajouter un aliment">
      <div className="flex items-center justify-between mb-3">
        <h2 className="display text-xl">Ajouter un aliment</h2>
        <button className="min-h-[44px] px-2 text-muted" onClick={onClose}>
          Fermer
        </button>
      </div>
      {msg && <p className="text-sm mb-2" role="status">{msg}</p>}
      {mode === 'scan' && <Scanner onCode={(c) => lookup(c)} onCancel={() => setMode('search')} />}
      {mode === 'grams' && picked && (
        <Grams
          food={picked}
          onBack={() => setMode('search')}
          onAdd={async (g) => {
            await addFood(date, meal, picked, g)
            onClose()
          }}
        />
      )}
      {mode === 'custom' && (
        <CustomFood
          initialName={q && !isValidEan(digits) ? q : ''}
          onBack={() => setMode('search')}
          onCreated={(f) => pick(f)}
        />
      )}
      {mode === 'search' && (
        <div className="space-y-3">
          <input autoFocus className="field" placeholder="Rechercher (ex. riz cuit, yaourt) ou code-barres" aria-label="Rechercher un aliment" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-primary" onClick={() => setMode('scan')}>
              Scanner
            </button>
            <button className="btn-secondary" onClick={() => setMode('custom')}>
              Créer un aliment
            </button>
          </div>
          {isValidEan(digits) && (
            <button className="btn-secondary w-full" onClick={() => lookup(digits)}>
              Chercher le code {digits}
            </button>
          )}
          {q.trim().length >= 2 ? (
            <>
              <ul>{results.map((f) => <Row key={f.id} f={f} />)}</ul>
              {!results.length && <p className="text-sm text-muted">Rien dans la table Ciqual ni dans tes aliments.</p>}
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
              {offResults.length > 0 && <ul>{offResults.map((f) => <Row key={f.id} f={f} />)}</ul>}
            </>
          ) : (
            <>
              {favs.length > 0 && (
                <section>
                  <h3 className="font-semibold">Favoris</h3>
                  <ul>{favs.map((f) => <Row key={f.id} f={f} />)}</ul>
                </section>
              )}
              {recents.length > 0 && (
                <section>
                  <h3 className="font-semibold">Récents</h3>
                  <ul>{recents.map((f) => <Row key={f.id} f={f} />)}</ul>
                </section>
              )}
              <p className="text-xs text-muted">Aliments bruts : table Ciqual de l’Anses (2025). Produits : Open Food Facts.</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
