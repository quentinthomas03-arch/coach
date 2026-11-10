import { useEffect, useState } from 'react'
import type { Profile } from '../../data/types'
import { db, setSetting } from '../../data/db'
import { getNutritionConfig, NUTRITION_KEY, type NutritionConfig } from '../../app/nutrition'
import { daysBetween, todayISO } from '../../domain/dates'
import { ACTIVITY_LABEL, checkWeightGoal, type ActivityLevel } from '../../domain/nutrition'
import { Choice, Stepper, Toggle } from '../components/Choice'

/** Réglages nutrition : profil, activité, objectif de poids (avec garde-fous), aliments évités, météo. */
export function NutritionSettings() {
  const [cfg, setCfg] = useState<NutritionConfig>()
  const [p, setP] = useState<Profile>()
  const [dislikes, setDislikes] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => {
    getNutritionConfig().then(setCfg)
    db.profile.get('me').then((x) => {
      setP(x)
      setDislikes((x?.foodDislikes ?? []).join(', '))
    })
  }, [])
  if (!cfg || !p) return null
  const today = todayISO()
  const weeks = cfg.targetDate ? Math.max(1, Math.round(daysBetween(today, cfg.targetDate) / 7)) : 0
  const check = cfg.goal === 'perte' && cfg.targetWeightKg && cfg.targetDate && p.heightCm ? checkWeightGoal(p.weightKg, cfg.targetWeightKg, weeks, p.heightCm) : undefined

  return (
    <section id="nutrition" className="card mb-4 scroll-mt-16 space-y-4">
      <h2 className="display text-base">Nutrition</h2>
      <div>
        <Stepper label="Taille" value={p.heightCm ?? 170} onChange={(v) => setP({ ...p, heightCm: v })} min={140} max={210} unit="cm" />
        <Stepper label="Poids" value={p.weightKg} onChange={(v) => setP({ ...p, weightKg: v })} min={40} max={160} step={0.5} unit="kg" />
        <p className="text-xs text-muted">Le dernier poids saisi dans Suivi est utilisé en priorité.</p>
      </div>
      <Choice<ActivityLevel>
        label="Hors entraînement, ta journée"
        cols={1}
        value={cfg.activity}
        onChange={(v) => setCfg({ ...cfg, activity: v })}
        options={(Object.keys(ACTIVITY_LABEL) as ActivityLevel[]).map((k) => ({ value: k, label: ACTIVITY_LABEL[k] }))}
      />
      <Choice
        label="Objectif"
        cols={3}
        value={cfg.goal}
        onChange={(v) => setCfg({ ...cfg, goal: v })}
        options={[
          { value: 'maintien', label: 'Maintien' },
          { value: 'perte', label: 'Perdre' },
          { value: 'prise', label: 'Prendre' },
        ]}
      />
      {cfg.goal === 'perte' && (
        <div className="space-y-2">
          <Stepper label="Poids visé" value={cfg.targetWeightKg ?? Math.round(p.weightKg - 3)} onChange={(v) => setCfg({ ...cfg, targetWeightKg: v })} min={40} max={p.weightKg} step={0.5} unit="kg" />
          <label className="label" htmlFor="tdate">
            Échéance
          </label>
          <input id="tdate" type="date" className="field" min={today} value={cfg.targetDate ?? ''} onChange={(e) => setCfg({ ...cfg, targetDate: e.target.value })} />
          {check && (
            <div className={`rounded-card p-3 text-sm ${check.verdict === 'raisonnable' && !check.messages.length ? 'bg-ok/10' : 'bg-warn/10'}`}>
              <p>
                Rythme : <strong>{check.weeklyRateKg.toFixed(2).replace('.', ',')} kg/semaine</strong> ({check.weeklyRatePct.toFixed(1).replace('.', ',')} % du poids).{' '}
                {check.verdict === 'raisonnable' ? 'Raisonnable.' : ''}
              </p>
              {check.messages.map((m) => (
                <p key={m} className="mt-1">{m}</p>
              ))}
            </div>
          )}
          <p className="text-xs text-muted">
            Garde-fous : déficit limité (≤ 15 % et ≤ 500 kcal/j), jamais sous ton métabolisme de base ni sous 1 500 kcal. Pour un objectif important ou une situation particulière, consulte un médecin ou un diététicien.
          </p>
        </div>
      )}
      <div>
        <label className="label" htmlFor="dislikes">
          Aliments que je n’aime pas (séparés par des virgules)
        </label>
        <input id="dislikes" className="field" value={dislikes} onChange={(e) => setDislikes(e.target.value)} placeholder="ex. saumon, mangue" />
      </div>
      <Toggle label="Ajuster l’eau à la météo" hint="Utilise ta position (arrondie) et Open-Meteo, une fois par jour." checked={cfg.weather} onChange={(v) => setCfg({ ...cfg, weather: v })} />
      <button
        className="btn-primary w-full"
        onClick={async () => {
          await setSetting(NUTRITION_KEY, cfg)
          await db.profile.put({ ...p, foodDislikes: dislikes.split(',').map((x) => x.trim()).filter(Boolean), updatedAt: new Date().toISOString() })
          setMsg('Enregistré.')
        }}
      >
        Enregistrer
      </button>
      {msg && <p role="status" className="text-sm text-ok">{msg}</p>}
    </section>
  )
}
