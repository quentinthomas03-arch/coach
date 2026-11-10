import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { applyPiste, savePiste, type Piste } from '../theme'
import { Gauge, Scale5 } from '../components/Segmented'
import { IconDrop, IconPlus, IconWatch } from '../icons'
import { getSetting, SETTING } from '../../data/db'

/** Maquette de l'écran Aujourd'hui avec des données fictives, pour choisir la piste visuelle. */
export function TodayMock() {
  const [phys, setPhys] = useState<number | undefined>(3)
  const [moral, setMoral] = useState<number | undefined>(4)
  const [water, setWater] = useState(1250)
  return (
    <div className="space-y-4">
      <div>
        <p className="text-muted text-sm">Mardi 10 novembre</p>
        <h1 className="display text-3xl leading-tight">Bonsoir</h1>
      </div>

      <section className="card space-y-3" aria-label="Check du matin">
        <h2 className="display text-base">Check du matin</h2>
        <Scale5 label="Forme physique" value={phys} onChange={setPhys} low="épuisé" high="au top" />
        <Scale5 label="Moral" value={moral} onChange={setMoral} low="bas" high="excellent" />
      </section>

      <section className="card" aria-label="Séance du jour">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted">Course · 35 min</p>
            <h2 className="display text-xl leading-tight">Marche-course</h2>
          </div>
          <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-full bg-ok/15 text-ok px-2.5 py-1 text-xs font-semibold">
            <IconWatch width={14} height={14} /> Sur la montre
          </span>
        </div>
        <p className="num text-lg font-semibold mt-3">6 × (2 min course + 1 min marche)</p>
        <p className="text-sm text-muted mt-2">
          <strong className="text-ink">Pourquoi :</strong> semaine 2 de reprise, ta forme est moyenne ce matin, on garde
          l'intensité très basse (tu dois pouvoir parler).
        </p>
        <button className="btn-primary w-full mt-4">Voir la séance</button>
      </section>

      <section className="card space-y-3" aria-label="Nutrition du jour">
        <div className="flex items-baseline justify-between">
          <h2 className="display text-base">Nutrition</h2>
          <span className="num text-2xl font-bold">
            1 420<span className="text-sm text-muted font-normal"> / 2 450 kcal</span>
          </span>
        </div>
        <Gauge label="Protéines" value={68} target={120} unit="g" />
        <Gauge label="Glucides" value={160} target={300} unit="g" />
        <Gauge label="Lipides" value={45} target={80} unit="g" />
        <button className="btn-secondary w-full">
          <IconPlus width={20} height={20} /> Ajouter un repas
        </button>
      </section>

      <section className="card" aria-label="Hydratation">
        <div className="flex items-center justify-between">
          <h2 className="display text-base flex items-center gap-2">
            <IconDrop width={18} height={18} /> Eau
          </h2>
          <span className="num font-semibold">
            {(water / 1000).toFixed(2).replace('.', ',')} / 2,4 L
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button className="btn-secondary" onClick={() => setWater((w) => w + 250)}>
            + Verre 25 cl
          </button>
          <button className="btn-secondary" onClick={() => setWater((w) => w + 500)}>
            + Gourde 50 cl
          </button>
        </div>
      </section>
    </div>
  )
}

export function DesignPreview() {
  const [piste, setPiste] = useState<Piste>((document.documentElement.dataset.piste as Piste) || 'a')
  const nav = useNavigate()
  const choose = (p: Piste) => {
    setPiste(p)
    applyPiste(p)
  }
  return (
    <div>
      <div className="card mb-4">
        <p className="text-sm text-muted mb-2">Aperçu avec des données fictives. Le thème clair/sombre suit ton iPhone.</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Piste visuelle">
          {(['a', 'b'] as const).map((p) => (
            <button
              key={p}
              role="radio"
              aria-checked={piste === p}
              onClick={() => choose(p)}
              className={piste === p ? 'btn-primary' : 'btn-secondary'}
            >
              {p === 'a' ? 'A · Piste' : 'B · Matin'}
            </button>
          ))}
        </div>
      </div>
      <TodayMock />
      <div className="grid grid-cols-2 gap-2 mt-6">
        <button
          className="btn-secondary"
          onClick={async () => {
            applyPiste(((await getSetting<Piste>(SETTING.piste)) ?? 'a') as Piste)
            nav(-1)
          }}
        >
          Annuler
        </button>
        <button
          className="btn-primary"
          onClick={async () => {
            await savePiste(piste)
            nav(-1)
          }}
        >
          Garder {piste.toUpperCase()}
        </button>
      </div>
    </div>
  )
}
