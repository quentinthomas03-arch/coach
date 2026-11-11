import type { Activity, ISODate, MorningCheckin, PlannedSession, Wellness } from '../data/types'
import { addDays } from './dates'
import type { Lap } from './laps'
import type { LoadEntry } from './load'
import type { Workout } from './workout'
import { formatPace } from './workout'

/**
 * FIN DE CYCLE (toutes les 4 semaines) : CONTRÔLE AÉROBIE ET BILAN.
 *
 * Contrôle aérobie (semaine allégée) : 20 min régulières à FC zone 2. À FC égale, une allure plus rapide
 * qu'au cycle précédent = endurance qui progresse. Test sûr même en reprise (aucun effort maximal).
 * Bilan : régularité, volume, effort, douleurs, FC de repos, sommeil, poids, contrôle, et ce que le coach
 * prévoit pour le cycle suivant.
 */

export const CONTROL_LABEL = 'Contrôle à FC zone 2, allure régulière'

export function controlWorkout(): Workout {
  return {
    blocks: [
      { role: 'warmup', steps: [{ label: 'Footing d’échauffement', durationSec: 10 * 60, target: { kind: 'hrZone', zone: 1 } }] },
      { role: 'main', steps: [{ label: CONTROL_LABEL, durationSec: 20 * 60, target: { kind: 'hrZone', zone: 2 } }] },
      { role: 'cooldown', steps: [{ label: 'Retour au calme', durationSec: 5 * 60, target: { kind: 'hrZone', zone: 1 } }] },
    ],
  }
}

export interface EfficiencyPoint {
  date: ISODate
  /** allure (s/km) sur le bloc de contrôle */
  pace: number
  /** FC moyenne sur le bloc */
  hr: number
}

/** Mesure du contrôle : le tour du bloc de 20 min si disponible, sinon la sortie entière. */
export function efficiencyFrom(a: Activity, laps?: Lap[]): EfficiencyPoint | undefined {
  const main = laps?.find((l) => l.durationSec >= 15 * 60 && l.durationSec <= 25 * 60 && l.pace && l.avgHr)
  if (main) return { date: a.date, pace: Math.round(main.pace!), hr: Math.round(main.avgHr!) }
  if (a.distanceM && a.avgHr) return { date: a.date, pace: Math.round(a.durationSec / (a.distanceM / 1000)), hr: Math.round(a.avgHr) }
  return undefined
}

/** Progrès entre deux contrôles, ramené à la même FC (≈ 4 s/km par battement, repère d'efficacité aérobie). */
export function efficiencyDelta(prev: EfficiencyPoint, cur: EfficiencyPoint): number {
  const hrCorr = (cur.hr - prev.hr) * 4
  return Math.round(cur.pace + hrCorr - prev.pace)
}

export interface CycleInput {
  start: ISODate
  sessions: PlannedSession[]
  entries: LoadEntry[]
  checkins: MorningCheckin[]
  wellness: Wellness[]
  weights: { date: ISODate; kg: number }[]
  controls: EfficiencyPoint[]
  levelStart: string
  levelEnd: string
}

export interface CycleReview {
  start: ISODate
  end: ISODate
  verdict: 'reussi' | 'correct' | 'difficile'
  facts: string[]
  coach: string[]
}

const f1 = (n: number) => n.toFixed(1).replace('.', ',')

export function cycleReview(i: CycleInput): CycleReview {
  const end = addDays(i.start, 27)
  const inC = (d: ISODate) => d >= i.start && d <= end
  const list = i.sessions.filter((s) => inC(s.date) && s.kind !== 'repos' && s.status !== 'skipped')
  const runs = list.filter((s) => s.kind !== 'renfo')
  const ren = list.filter((s) => s.kind === 'renfo')
  const done = (l: PlannedSession[]) => l.filter((s) => s.status === 'done').length
  const reg = list.length ? (done(runs) + done(ren)) / list.length : 0
  const weekMin = [0, 1, 2, 3].map((w) => i.entries.filter((e) => e.run && e.date >= addDays(i.start, 7 * w) && e.date < addDays(i.start, 7 * w + 7)).reduce((a, e) => a + e.minutes, 0))
  const rpes = i.entries.filter((e) => inC(e.date)).map((e) => e.rpe)
  const painDays = i.checkins.filter((c) => inC(c.date) && c.douleur && c.douleur.intensite >= 2).length
  const rhrW = (w: number) => {
    const v = i.wellness.filter((x) => x.restingHr != null && x.date >= addDays(i.start, 7 * w) && x.date < addDays(i.start, 7 * w + 7)).map((x) => x.restingHr!)
    return v.length >= 3 ? v.reduce((a, b) => a + b, 0) / v.length : undefined
  }
  const sleep = i.wellness.filter((x) => inC(x.date) && x.sleepHours != null).map((x) => x.sleepHours!)
  const w = i.weights.filter((x) => inC(x.date)).sort((a, b) => (a.date < b.date ? -1 : 1))
  const ctrl = i.controls.filter((c) => inC(c.date)).pop()
  const prevCtrl = i.controls.filter((c) => c.date < i.start).pop()

  const facts: string[] = [
    `Séances : ${done(runs)}/${runs.length} course${runs.length > 1 ? 's' : ''}, ${done(ren)}/${ren.length} renfo (régularité ${Math.round(reg * 100)} %).`,
    `Course par semaine : ${weekMin.join(' → ')} min.`,
    `Niveau : ${i.levelStart} → ${i.levelEnd}.`,
  ]
  if (rpes.length) facts.push(`Effort ressenti moyen : ${f1(rpes.reduce((a, b) => a + b, 0) / rpes.length)}/10.`)
  if (painDays) facts.push(`Douleur signalée ${painDays} jour(s).`)
  const r1 = rhrW(0)
  const r4 = rhrW(3)
  if (r1 && r4) facts.push(`FC de repos : ${Math.round(r1)} → ${Math.round(r4)} bpm.`)
  if (sleep.length >= 7) facts.push(`Sommeil moyen : ${f1(sleep.reduce((a, b) => a + b, 0) / sleep.length)} h.`)
  if (w.length >= 2) facts.push(`Poids : ${f1(w[0].kg)} → ${f1(w[w.length - 1].kg)} kg.`)
  if (ctrl) facts.push(`Contrôle aérobie : ${formatPace(ctrl.pace)}/km à ${ctrl.hr} bpm.`)

  const coach: string[] = []
  const verdict: CycleReview['verdict'] = painDays >= 3 || reg < 0.5 ? 'difficile' : reg >= 0.85 ? 'reussi' : 'correct'
  if (verdict === 'reussi') coach.push('Cycle réussi : régularité au rendez-vous, c’est exactement comme ça qu’on progresse.')
  if (verdict === 'correct') coach.push('Cycle correct, quelques séances manquées : le prochain vise la régularité avant tout.')
  if (verdict === 'difficile') coach.push(painDays >= 3 ? 'Cycle difficile à cause des douleurs : on reste prudent, et un avis médical ou kiné est conseillé si ça persiste.' : 'Cycle difficile : peu de séances faites. On ne monte pas tant que la régularité ne revient pas ; ajuste tes dispos si besoin.')
  if (ctrl && prevCtrl) {
    const d = efficiencyDelta(prevCtrl, ctrl)
    coach.push(d < -3 ? `Ton endurance progresse : à fréquence cardiaque égale, tu cours environ ${-d} s/km plus vite qu’au cycle précédent.` : d > 5 ? `À fréquence cardiaque égale, tu es ${d} s/km plus lent qu’au cycle précédent : fatigue, chaleur ou manque de sommeil ? On consolide.` : 'Endurance stable par rapport au cycle précédent.')
  } else if (ctrl) coach.push('Premier contrôle aérobie enregistré : il servira de référence pour mesurer tes progrès au prochain cycle.')
  if (r1 && r4 && r4 <= r1 - 2) coach.push('Ta FC de repos baisse : ton cœur s’adapte à l’entraînement.')
  if (sleep.length >= 7 && sleep.reduce((a, b) => a + b, 0) / sleep.length < 6.5) coach.push('Priorité du prochain cycle : le sommeil, c’est là que la forme se construit.')
  if (ren.length && done(ren) / ren.length < 0.5) coach.push('Le renfo reste ton point faible ce cycle : on le protège dans ton planning.')
  return { start: i.start, end, verdict, facts, coach }
}
