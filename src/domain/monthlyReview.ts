import type { Activity, ISODate, MorningCheckin, PlannedSession } from '../data/types'
import { RUN_TYPES } from './activities'
import { newRecords, type Trophy } from './progress'
import type { WeeklyReview } from './weeklyReview'

/** BILAN DU MOIS : course, renfo, régularité, sommeil, sorties, tabac, records et trophées. */
export interface MonthlyInput {
  /** « 2026-11 » */
  month: string
  today: ISODate
  acts: Activity[]
  sessions: PlannedSession[]
  checkins: MorningCheckin[]
  sleepHours: number[]
  cravings: { at: string; resisted: boolean }[]
  trophies: Trophy[]
  foodDays: number
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const f1 = (n: number) => n.toFixed(1).replace('.', ',')

export function monthBounds(month: string): { from: ISODate; to: ISODate; prevFrom: ISODate } {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}`, prevFrom: `${prev}-01` }
}

export function monthlyReview(i: MonthlyInput): WeeklyReview {
  const { from, to, prevFrom } = monthBounds(i.month)
  const end = i.today < to ? i.today : to
  const inM = (d: ISODate) => d >= from && d <= to
  const inP = (d: ISODate) => d >= prevFrom && d < from
  const runs = i.acts.filter((a) => RUN_TYPES.has(a.type))
  const km = (xs: Activity[]) => xs.reduce((a, x) => a + (x.distanceM ?? 0), 0) / 1000
  const mRuns = runs.filter((a) => inM(a.date))
  const pRuns = runs.filter((a) => inP(a.date))
  const planned = i.sessions.filter((s) => inM(s.date) && s.date <= end && (s.date < i.today || s.status === 'done') && s.kind !== 'repos' && s.status !== 'skipped')
  const done = planned.filter((s) => s.status === 'done')
  const renfo = done.filter((s) => s.kind === 'renfo').length
  const rate = planned.length ? done.length / planned.length : undefined
  const facts: string[] = []
  const coach: string[] = []

  const hours = mRuns.reduce((a, x) => a + x.durationSec, 0) / 3600
  facts.push(`Course : ${mRuns.length} sortie${mRuns.length > 1 ? 's' : ''}, ${f1(km(mRuns))} km, ${f1(hours)} h${pRuns.length ? ` (mois d’avant : ${f1(km(pRuns))} km)` : ''}.`)
  facts.push(`Renfo : ${renfo} séance${renfo > 1 ? 's' : ''}.`)
  if (rate != null) facts.push(`Séances faites : ${done.length} sur ${planned.length} (${Math.round(rate * 100)} %).`)
  if (i.sleepHours.length >= 7) facts.push(`Sommeil moyen : ${f1(i.sleepHours.reduce((a, b) => a + b, 0) / i.sleepHours.length)} h.`)
  const ch = i.checkins.filter((c) => inM(c.date))
  const nightsOut = ch.filter((c) => c.sortie).length
  const heavy = ch.filter((c) => c.alcool === '3+').length
  if (ch.length) facts.push(`Soirées : ${nightsOut} sortie${nightsOut > 1 ? 's' : ''}${heavy ? `, dont ${heavy} avec 3 verres ou plus` : ''}.`)
  const cigs = ch.reduce((a, c) => a + (c.cigarettes ?? 0), 0)
  const cigsPrev = i.checkins.filter((c) => inP(c.date)).reduce((a, c) => a + (c.cigarettes ?? 0), 0)
  if (ch.some((c) => c.cigarettes != null)) facts.push(`Tabac : ${cigs} cigarette${cigs > 1 ? 's' : ''} notée${cigs > 1 ? 's' : ''}${cigsPrev ? ` (mois d’avant : ${cigsPrev})` : ''}.`)
  const cr = i.cravings.filter((c) => inM(c.at.slice(0, 10)))
  if (cr.length) facts.push(`Envies de fumer : ${cr.filter((c) => c.resisted).length} tenues sur ${cr.length}.`)
  if (i.foodDays) facts.push(`Repas notés ${i.foodDays} jour${i.foodDays > 1 ? 's' : ''}.`)
  const recs = newRecords(i.acts, from, end)
  for (const r of recs) facts.push(`🏆 Record : ${r.label.toLowerCase()} — ${r.value}.`)
  const tr = i.trophies.filter((t) => typeof t.earned === 'string' && inM(t.earned))
  for (const t of tr) facts.push(`${t.emoji} Trophée : ${t.label}.`)

  if (planned.length < 4 && mRuns.length < 4) coach.push('Trop tôt pour juger ce mois : reviens en fin de mois.')
  else if (rate == null && !mRuns.length) coach.push('Mois calme. Le plus dur, c’est de s’y remettre : une séance cette semaine et on relance.')
  else if (rate != null && rate >= 0.85) coach.push('Mois très régulier. C’est exactement comme ça qu’on progresse : sans exploit, sans trou.')
  else if (rate != null && rate >= 0.6) coach.push('Mois correct. Quelques séances sautées : regarde quels jours coincent et déplace-les plutôt que de les perdre.')
  else if (rate != null) coach.push('Mois compliqué. On ne rattrape rien : on repart sur un rythme que tu peux tenir, et le plan s’adapte.')
  if (pRuns.length && km(mRuns) > km(pRuns) * 1.3) coach.push('Gros mois en volume par rapport au précédent : surveille fatigue et douleurs, et respecte la semaine allégée.')
  if (planned.length >= 4 && renfo === 0 && planned.some((s) => s.kind === 'renfo')) coach.push('Zéro renfo ce mois-ci. C’est ce qui protège tes tendons : deux fois 20 min par semaine.')
  if (heavy >= 4) coach.push(`${heavy} soirées arrosées : ton sommeil et tes séances du lendemain en paient le prix.`)
  if (recs.length) coach.push(`${recs.length} record${recs.length > 1 ? 's' : ''} ce mois-ci : le travail paie.`)

  const [y, m] = i.month.split('-').map(Number)
  return { title: `Bilan de ${MONTHS[m - 1]} ${y}`, facts, coach, nextWeek: [] }
}
