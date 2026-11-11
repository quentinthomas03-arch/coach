import type { Activity, ISODate, PlannedSession, Wellness } from '../data/types'
import { addDays } from './dates'
import { RUN_TYPES } from './activities'
import { formatPace } from './workout'
import { formatTime } from './paces'

/**
 * PROGRÈS : cadence, VO2max de la montre comparée à l'estimation du coach,
 * records personnels et trophées. Tout est calculé depuis les données déjà sur le téléphone.
 */

const runs = (acts: Activity[]) => acts.filter((a) => RUN_TYPES.has(a.type) && a.durationSec >= 600)
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined)

/* ---------- Cadence ---------- */

export interface CadenceInfo {
  current?: number
  previous?: number
  advice: string[]
}

/**
 * Cadence moyenne des sorties des 4 dernières semaines, comparée aux 4 précédentes.
 * Repère courant : sous ~160 pas/min en endurance, augmenter de 5 % réduit l'impact par foulée
 * (études de Heiderscheit et coll.). Pas de cible universelle : on progresse depuis la sienne.
 */
export function cadenceInfo(acts: Activity[], today: ISODate): CadenceInfo {
  const r = runs(acts).filter((a) => a.cadence)
  const cur = avg(r.filter((a) => a.date > addDays(today, -28)).map((a) => a.cadence!))
  const prev = avg(r.filter((a) => a.date <= addDays(today, -28) && a.date > addDays(today, -56)).map((a) => a.cadence!))
  const advice: string[] = []
  if (cur == null) return { advice: ['Pas encore de cadence mesurée : elle s’affiche après quelques sorties avec la montre.'] }
  const c = Math.round(cur)
  if (c < 160) {
    advice.push(`${c} pas/min en moyenne : c’est plutôt bas. Viser ${Math.round(c * 1.05)} (+5 %) avec des pas plus courts et plus rapides réduit l’impact à chaque foulée et protège genoux et tibias.`)
    advice.push('Comment : 2 fois par semaine, 4 × 1 min avec un métronome (appli gratuite ou bip de la montre) réglé sur la cible, en fin de footing. Et des éducatifs à l’échauffement : montées de genoux, talons-fesses, pas courts rapides.')
  } else if (c < 170) advice.push(`${c} pas/min : correct. Une légère hausse (+3 %) peut encore alléger la foulée, sans forcer.`)
  else advice.push(`${c} pas/min : bonne cadence, rien à changer.`)
  if (prev != null && Math.abs(cur - prev) >= 2) advice.push(`Sur 4 semaines : ${cur > prev ? '+' : ''}${Math.round(cur - prev)} pas/min.`)
  return { current: c, previous: prev != null ? Math.round(prev) : undefined, advice }
}

/* ---------- VO2max ---------- */

export interface Vo2Compare {
  garmin?: number
  garminTrend?: number
  coach?: number
  text: string
}

export function vo2Compare(wellness: Wellness[], vdot: number | undefined, today: ISODate): Vo2Compare {
  const w = wellness.filter((x) => x.vo2max).sort((a, b) => (a.date < b.date ? -1 : 1))
  const last = w.at(-1)?.vo2max
  const old = w.filter((x) => x.date <= addDays(today, -28)).at(-1)?.vo2max
  const coach = vdot != null ? Math.round(vdot * 10) / 10 : undefined
  let text: string
  if (last == null) text = 'La montre n’a pas encore transmis de VO2max (elle l’estime après des sorties en extérieur avec la FC).'
  else if (coach == null) text = `La montre t’estime à ${last}. Le coach chiffrera la sienne après un test ou une course.`
  else {
    const d = last - coach
    text =
      Math.abs(d) <= 3
        ? `Les deux estimations concordent (${last} contre ${coach}) : tes allures d’entraînement sont bien calibrées.`
        : d > 3
          ? `La montre est plus optimiste (${last} contre ${coach}). Ton moteur est peut-être meilleur que tes derniers chronos : un test ou une course le dira. En attendant, le coach garde les allures prudentes.`
          : `La montre est plus prudente (${last} contre ${coach}). C’est fréquent si ta FC max n’est pas bien réglée sur la montre, ou après une pause. Le coach se fie à tes chronos.`
  }
  return { garmin: last, garminTrend: last != null && old != null ? last - old : undefined, coach, text }
}

/* ---------- Records ---------- */

export interface PersonalRecord {
  id: string
  label: string
  value: string
  date: ISODate
}

const BANDS: { id: string; label: string; m: number }[] = [
  { id: '5k', label: 'Meilleur 5 km', m: 5000 },
  { id: '10k', label: 'Meilleur 10 km', m: 10000 },
  { id: 'semi', label: 'Meilleur semi', m: 21097 },
]

/**
 * Records détectés sur les sorties : plus longue distance, plus longue durée, et meilleur temps
 * sur une sortie de la distance (±3 %), ramené à la distance exacte.
 */
export function personalRecords(acts: Activity[], since?: ISODate): PersonalRecord[] {
  const r = runs(acts).filter((a) => !since || a.date >= since)
  const out: PersonalRecord[] = []
  const longest = [...r].filter((a) => a.distanceM).sort((a, b) => b.distanceM! - a.distanceM!)[0]
  if (longest) out.push({ id: 'distance', label: 'Plus longue sortie', value: `${(longest.distanceM! / 1000).toFixed(1).replace('.', ',')} km`, date: longest.date })
  const longestT = [...r].sort((a, b) => b.durationSec - a.durationSec)[0]
  if (longestT) out.push({ id: 'duree', label: 'Plus longue durée', value: formatTime(longestT.durationSec), date: longestT.date })
  for (const b of BANDS) {
    const best = r
      .filter((a) => a.distanceM && Math.abs(a.distanceM - b.m) / b.m <= 0.03)
      .map((a) => ({ a, t: (a.durationSec / a.distanceM!) * b.m }))
      .sort((x, y) => x.t - y.t)[0]
    if (best) out.push({ id: b.id, label: b.label, value: `${formatTime(best.t)} (${formatPace(best.t / (b.m / 1000))}/km)`, date: best.a.date })
  }
  return out
}

/**
 * Records battus sur la période (comparés à l'historique d'avant).
 * Il faut un minimum d'historique : sinon chaque sortie de la reprise serait « un record ».
 */
export function newRecords(acts: Activity[], from: ISODate, to: ISODate, minHistory = 5): PersonalRecord[] {
  if (runs(acts.filter((a) => a.date < from)).length < minHistory) return []
  const before = personalRecords(acts.filter((a) => a.date < from))
  const now = personalRecords(acts.filter((a) => a.date <= to))
  return now.filter((r) => r.date >= from && r.date <= to && before.find((b) => b.id === r.id)?.value !== r.value)
}

/* ---------- Trophées ---------- */

export interface Trophy {
  id: string
  emoji: string
  label: string
  hint: string
  /** Date d'obtention, ou true si la date n'est pas connue précisément. */
  earned?: ISODate | true
}

export interface TrophyInput {
  acts: Activity[]
  sessions: PlannedSession[]
  streak: number
  smokeFreeDays?: number
  smokeFreeSince?: ISODate
  cravingsResisted?: number
  races: number
}

export function trophies(i: TrophyInput): Trophy[] {
  const r = runs(i.acts).sort((a, b) => (a.date < b.date ? -1 : 1))
  const firstRun = (cond: (a: Activity) => boolean) => r.find(cond)?.date
  const doneSessions = i.sessions.filter((s) => s.status === 'done').sort((a, b) => (a.date < b.date ? -1 : 1))
  const nthDone = (n: number) => doneSessions[n - 1]?.date
  const renfo = doneSessions.filter((s) => s.kind === 'renfo')
  const weekKm = new Map<string, number>()
  for (const a of r) {
    const k = addDays(a.date, -((new Date(`${a.date}T12:00:00Z`).getUTCDay() + 6) % 7))
    weekKm.set(k, (weekKm.get(k) ?? 0) + (a.distanceM ?? 0) / 1000)
  }
  const firstWeekOver = (km: number) => [...weekKm.entries()].sort().find(([, v]) => v >= km)?.[0]
  const t = (id: string, emoji: string, label: string, hint: string, earned?: ISODate | true): Trophy => ({ id, emoji, label, hint, earned })
  return [
    t('premiere', '👟', 'Première séance', 'Faire ta première séance du plan', nthDone(1)),
    t('dix', '🔟', '10 séances', '10 séances faites', nthDone(10)),
    t('cinquante', '🏅', '50 séances', '50 séances faites', nthDone(50)),
    t('30min', '⏱️', '30 minutes sans s’arrêter', 'Courir 30 min d’affilée', firstRun((a) => a.durationSec >= 1800 && !/marche/i.test(a.name ?? ''))),
    t('5k', '5️⃣', 'Premier 5 km', 'Une sortie de 5 km', firstRun((a) => (a.distanceM ?? 0) >= 5000)),
    t('10k', '🔥', 'Premier 10 km', 'Une sortie de 10 km', firstRun((a) => (a.distanceM ?? 0) >= 10000)),
    t('1h30', '🌄', '1 h 30 de course', 'Une sortie longue de 1 h 30', firstRun((a) => a.durationSec >= 5400)),
    t('semaine30', '📈', '30 km dans la semaine', 'Courir 30 km sur une semaine', firstWeekOver(30)),
    t('renfo10', '💪', '10 séances de renfo', '10 renfos faits', renfo[9]?.date),
    t('serie4', '📅', '4 semaines régulières', 'Série de 4 semaines', i.streak >= 4 ? true : undefined),
    t('serie12', '🗓️', '12 semaines régulières', 'Série de 12 semaines', i.streak >= 12 ? true : undefined),
    t('course', '🏁', 'Première course', 'Terminer une course objectif', i.races > 0 ? true : undefined),
    t('envies', '🧘', '20 envies tenues', 'Tenir 20 envies de fumer', (i.cravingsResisted ?? 0) >= 20 ? true : undefined),
    t('sanstabac7', '🚭', '1 semaine sans tabac', '7 jours sans fumer', (i.smokeFreeDays ?? 0) >= 7 ? addDays(i.smokeFreeSince!, 7) : undefined),
    t('sanstabac30', '🌿', '1 mois sans tabac', '30 jours sans fumer', (i.smokeFreeDays ?? 0) >= 30 ? addDays(i.smokeFreeSince!, 30) : undefined),
    t('sanstabac100', '💯', '100 jours sans tabac', '100 jours sans fumer', (i.smokeFreeDays ?? 0) >= 100 ? addDays(i.smokeFreeSince!, 100) : undefined),
  ]
}
