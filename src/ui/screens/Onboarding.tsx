import { useState } from 'react'
import type { DayAvailability, EquipmentId, Sex } from '../../data/types'
import { db, setSetting } from '../../data/db'
import { DEFAULT_TEMPLATE, KEYS, savePlanConfig } from '../../app/config'
import { regenerate } from '../../app/plan'
import { syncToWatch } from '../../app/sync'
import { addDays, mondayOf, todayISO } from '../../domain/dates'
import { startLevelFor, type CurrentRunAbility, getLevel } from '../../domain/reprise'
import type { Tone } from '../../domain/coach'
import { Choice, Stepper, Toggle } from '../components/Choice'
import { DAY_NAMES, WeekEditor } from '../components/WeekEditor'

const EQUIPMENT: { id: EquipmentId; label: string }[] = [
  { id: 'tapis', label: 'Tapis' },
  { id: 'kettlebell', label: 'Kettlebell' },
  { id: 'elastiques', label: 'Élastiques' },
  { id: 'roue-abdos', label: 'Roue abdos' },
  { id: 'escalier', label: 'Escalier' },
  { id: 'mur', label: 'Mur libre' },
  { id: 'banc', label: 'Banc' },
  { id: 'barre-traction', label: 'Barre de traction' },
]

const TONES: { value: Tone; label: string; hint: string }[] = [
  { value: 'bienveillant', label: 'Bienveillant', hint: '« Ça arrive ! Ajuste tes dispos si besoin. »' },
  { value: 'direct', label: 'Direct', hint: '« 2 sorties sautées. Si le planning ne colle pas, change-le ; sinon on s’y tient. »' },
  { value: 'cash', label: 'Cash', hint: '« 2 sorties zappées. Soit tu ajustes, soit tu chausses. »' },
]

/** Questionnaire de départ : 6 écrans courts, tout reste modifiable ensuite dans Réglages. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const today = todayISO()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  // Profil
  const [sex, setSex] = useState<Sex>('homme')
  const [birthYear, setBirthYear] = useState(1990)
  const [height, setHeight] = useState(170)
  const [weight, setWeight] = useState(70)
  // Niveau
  const [ability, setAbility] = useState<CurrentRunAbility>()
  const [plank, setPlank] = useState<'non' | '20s' | '45s'>()
  // Semaine
  const [days, setDays] = useState<DayAvailability[]>(DEFAULT_TEMPLATE)
  const [runs, setRuns] = useState(3)
  const [longDay, setLongDay] = useState(6)
  // Matériel
  const [equip, setEquip] = useState<Set<EquipmentId>>(new Set(['tapis', 'kettlebell', 'elastiques', 'roue-abdos', 'escalier', 'mur']))
  // Coach
  const [tone, setTone] = useState<Tone>('direct')
  const [mode, setMode] = useState<'auto' | 'valider'>('auto')
  // Début
  const [start, setStart] = useState(today)
  // Tabac
  const [tabacOn, setTabacOn] = useState(true)
  const [quitDate, setQuitDate] = useState('2027-01-01')
  const [cigs, setCigs] = useState(10)
  const [pack, setPack] = useState(12.5)
  const [reasons, setReasons] = useState('')

  const nextMonday = addDays(mondayOf(today), 7)
  const steps = [
    {
      title: 'Ton profil',
      sub: 'Pour tes zones et, plus tard, tes besoins nutritionnels.',
      ok: true,
      body: (
        <div className="space-y-2">
          <Choice label="Sexe" options={[{ value: 'homme' as Sex, label: 'Homme' }, { value: 'femme' as Sex, label: 'Femme' }]} value={sex} onChange={setSex} />
          <Stepper label="Année de naissance" value={birthYear} onChange={setBirthYear} min={1940} max={2010} />
          <Stepper label="Taille" value={height} onChange={setHeight} min={140} max={210} unit="cm" />
          <Stepper label="Poids" value={weight} onChange={setWeight} min={40} max={160} step={0.5} unit="kg" />
        </div>
      ),
    },
    {
      title: 'Où tu en es',
      sub: 'Réponds honnêtement : partir trop haut, c’est la blessure assurée.',
      ok: !!ability && !!plank,
      body: (
        <div className="space-y-4">
          <Choice
            label="Aujourd’hui, combien de temps peux-tu courir tranquillement sans t’arrêter ?"
            cols={1}
            value={ability}
            onChange={setAbility}
            options={[
              { value: 'moins-5', label: 'Moins de 5 min' },
              { value: '5-10', label: '5 à 10 min' },
              { value: '10-20', label: '10 à 20 min' },
              { value: '20-30', label: '20 à 30 min' },
              { value: 'plus-30', label: 'Plus de 30 min' },
            ]}
          />
          {ability && <p className="text-sm text-muted">Tu démarreras au niveau {startLevelFor(ability)}/9 : {getLevel(startLevelFor(ability)).label}.</p>}
          <Choice
            label="Gainage planche sur les avant-bras ?"
            cols={1}
            value={plank}
            onChange={setPlank}
            options={[
              { value: 'non', label: 'Moins de 20 s ou jamais essayé' },
              { value: '20s', label: '20 à 45 s' },
              { value: '45s', label: 'Plus de 45 s' },
            ]}
          />
        </div>
      ),
    },
    {
      title: 'Ta semaine type',
      sub: 'Les jours où tu peux t’entraîner et combien de temps. Tu pourras l’ajuster chaque semaine.',
      ok: days.some((d) => d.available),
      body: (
        <div className="space-y-4">
          <WeekEditor days={days} onChange={setDays} />
          <Choice label="Sorties par semaine" cols={3} value={runs} onChange={setRuns} options={[2, 3, 4].map((n) => ({ value: n, label: `${n}` }))} />
          <Choice label="Sortie longue le" cols={3} value={longDay} onChange={setLongDay} options={[5, 6, 0].map((d) => ({ value: d, label: DAY_NAMES[d] }))} />
        </div>
      ),
    },
    {
      title: 'Ton matériel',
      sub: 'Le renfo s’adapte : sans un objet, l’exercice est remplacé.',
      ok: true,
      body: (
        <div className="divide-y divide-line">
          {EQUIPMENT.map((e) => (
            <Toggle
              key={e.id}
              label={e.label}
              checked={equip.has(e.id)}
              onChange={(v) => {
                const s = new Set(equip)
                if (v) s.add(e.id)
                else s.delete(e.id)
                setEquip(s)
              }}
            />
          ))}
        </div>
      ),
    },
    {
      title: 'Ton coach',
      sub: 'Comment il te parle, et qui décide des changements.',
      ok: true,
      body: (
        <div className="space-y-4">
          <Choice label="Ton" cols={1} value={tone} onChange={setTone} options={TONES} />
          <Choice
            label="Quand le plan doit changer (séance ratée, nouvelles dispos…)"
            cols={1}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'auto', label: 'Le coach ajuste, je peux annuler', hint: 'Tu vois toujours ce qui a changé et pourquoi.' },
              { value: 'valider', label: 'Le coach propose, je valide', hint: 'Rien ne bouge sans ton accord.' },
            ]}
          />
          <p className="text-sm text-muted">Dans tous les cas, tu peux déplacer, retirer, ajouter ou verrouiller n’importe quelle séance.</p>
        </div>
      ),
    },
    {
      title: 'Quand on commence ?',
      sub: 'Rien n’est planifié avant cette date.',
      ok: !!start && start >= today,
      body: (
        <div className="space-y-3">
          <Choice
            cols={2}
            value={start === today ? 'today' : start === nextMonday ? 'monday' : 'other'}
            onChange={(v) => v !== 'other' && setStart(v === 'today' ? today : nextMonday)}
            options={[
              { value: 'today', label: 'Aujourd’hui' },
              { value: 'monday', label: 'Lundi prochain' },
            ]}
          />
          <label className="label" htmlFor="start">
            Ou une autre date
          </label>
          <input id="start" type="date" className="field" min={today} value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
      ),
    },
    {
      title: 'Arrêt du tabac',
      sub: 'Facultatif. Le coach t’accompagne avant et après la date.',
      ok: !tabacOn || !!quitDate,
      body: (
        <div className="space-y-3">
          <Toggle label="Activer le module tabac" checked={tabacOn} onChange={setTabacOn} />
          {tabacOn && (
            <>
              <label className="label" htmlFor="quit">
                Date d’arrêt visée
              </label>
              <input id="quit" type="date" className="field" value={quitDate} onChange={(e) => setQuitDate(e.target.value)} />
              <Stepper label="Cigarettes par jour" value={cigs} onChange={setCigs} min={1} max={60} />
              <Stepper label="Prix du paquet" value={pack} onChange={setPack} min={5} max={25} step={0.1} unit="€" />
              <label className="label" htmlFor="reasons">
                Tes raisons d’arrêter (une par ligne)
              </label>
              <textarea id="reasons" className="field py-2 min-h-[96px]" value={reasons} onChange={(e) => setReasons(e.target.value)} placeholder={'Retrouver mon souffle en courant\nÉconomiser'} />
            </>
          )}
        </div>
      ),
    },
  ]
  const cur = steps[step]

  const finish = async () => {
    setBusy(true)
    const now = new Date().toISOString()
    await db.profile.put({ id: 'me', sex, birthYear, heightCm: height, weightKg: weight, injuries: [], foodDislikes: [], updatedAt: now })
    await db.equipment.bulkPut(EQUIPMENT.map((e) => ({ id: e.id, available: equip.has(e.id), detail: e.id === 'kettlebell' ? '6 kg' : undefined })))
    await db.availability.put({ weekStart: 'template', days, updatedAt: now })
    await savePlanConfig({
      startDate: start,
      runsPerWeek: runs,
      strengthPerWeek: 2,
      longRunWeekday: longDay,
      repriseLevel: startLevelFor(ability!),
      strengthLevel: plank === '45s' ? 3 : plank === '20s' ? 2 : 1,
      recalcMode: mode,
      tone,
    })
    if (tabacOn) {
      await setSetting(KEYS.tabac, { quitDate, cigsPerDayBefore: cigs, packPrice: pack, cigsPerPack: 20, reasons: reasons.split('\n').map((r) => r.trim()).filter(Boolean) })
    }
    await regenerate('Création du plan', today)
    await setSetting(KEYS.onboarded, now)
    syncToWatch(today).catch(() => undefined)
    onDone()
  }

  return (
    <div className="min-h-[100dvh] flex flex-col px-4 pt-[max(env(safe-area-inset-top),20px)] pb-[max(env(safe-area-inset-bottom),16px)]">
      <div className="flex gap-1 mb-4" aria-label={`Étape ${step + 1} sur ${steps.length}`}>
        {steps.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-accent-ink' : 'bg-line'}`} />
        ))}
      </div>
      <h1 className="display text-3xl">{cur.title}</h1>
      <p className="text-muted mt-1 mb-4">{cur.sub}</p>
      <div className="flex-1">{cur.body}</div>
      <div className="grid grid-cols-2 gap-2 mt-6 sticky bottom-0 bg-bg pt-2">
        <button className="btn-secondary" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}>
          Retour
        </button>
        {step < steps.length - 1 ? (
          <button className="btn-primary" disabled={!cur.ok} onClick={() => setStep(step + 1)}>
            Suivant
          </button>
        ) : (
          <button className="btn-primary" disabled={!cur.ok || busy} onClick={finish}>
            {busy ? 'Création…' : 'Créer mon plan'}
          </button>
        )}
      </div>
    </div>
  )
}
