import type { ISODate, MorningCheckin, PlannedSession } from '../data/types'
import { addDays } from './dates'
import type { Tone } from './coach'
import type { LoadEntry } from './load'

/**
 * BILAN DE LA SEMAINE (le dimanche soir) : ce qui a été fait, comment tu allais,
 * ce que le coach en pense et ce qui t'attend. Règles simples et lisibles.
 */
export interface WeeklyReviewInput {
  monday: ISODate
  /** Aujourd'hui : en cours de semaine, seules les séances passées (ou faites) sont jugées. */
  today?: ISODate
  tone: Tone
  sessions: PlannedSession[]
  /** Séances de la semaine suivante. */
  nextSessions: PlannedSession[]
  entries: LoadEntry[]
  checkins: MorningCheckin[]
  sleepHours: (number | undefined)[]
  waterMl: number[]
  weights: { date: ISODate; kg: number }[]
  tabacLine?: string
  notesCount: number
}

export interface WeeklyReview {
  title: string
  facts: string[]
  coach: string[]
  nextWeek: string[]
}

const f1 = (n: number) => n.toFixed(1).replace('.', ',')
const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

export function weeklyReview(i: WeeklyReviewInput): WeeklyReview {
  const end = addDays(i.monday, 7)
  const inWeek = (d: ISODate) => d >= i.monday && d < end
  const ongoing = !!i.today && i.today < addDays(end, -1)
  const judged = (s: PlannedSession) => !ongoing || s.date < i.today! || s.status === 'done'
  const week = i.sessions.filter((s) => inWeek(s.date) && s.kind !== 'repos' && s.status !== 'skipped' && judged(s))
  const runs = week.filter((s) => s.kind !== 'renfo')
  const renfos = week.filter((s) => s.kind === 'renfo')
  const done = (l: PlannedSession[]) => l.filter((s) => s.status === 'done').length
  const e = i.entries.filter((x) => inWeek(x.date))
  const prev = i.entries.filter((x) => x.date >= addDays(i.monday, -7) && x.date < i.monday)
  const runMin = e.filter((x) => x.run).reduce((a, x) => a + x.minutes, 0)
  const prevMin = prev.filter((x) => x.run).reduce((a, x) => a + x.minutes, 0)
  const km = e.filter((x) => x.run).reduce((a, x) => a + (x.km ?? 0), 0)
  const c = i.checkins.filter((x) => inWeek(x.date))
  const avg = (k: 'physique' | 'moral' | 'travail') => (c.length ? c.reduce((a, x) => a + x[k], 0) / c.length : undefined)
  const sleep = i.sleepHours.filter((x): x is number => x != null)
  const water = i.waterMl.filter((x) => x > 0)
  const facts: string[] = []
  facts.push(`Course : ${done(runs)}/${runs.length} séance(s), ${runMin} min${km ? `, ${f1(km)} km` : ''}${prevMin ? ` (semaine précédente : ${prevMin} min)` : ''}.`)
  facts.push(`Renfo : ${done(renfos)}/${renfos.length} séance(s).`)
  if (c.length) facts.push(`Check du matin : ${c.length}/7 jours. Forme ${f1(avg('physique')!)}/5, moral ${f1(avg('moral')!)}/5, travail ${f1(avg('travail')!)}/5.`)
  if (sleep.length) facts.push(`Sommeil moyen : ${f1(sleep.reduce((a, b) => a + b, 0) / sleep.length)} h.`)
  if (water.length) facts.push(`Eau : ${f1(water.reduce((a, b) => a + b, 0) / water.length / 1000)} L par jour en moyenne (${water.length} jour(s) renseigné(s)).`)
  const w = i.weights.filter((x) => inWeek(x.date)).sort((a, b) => (a.date < b.date ? -1 : 1))
  if (w.length) facts.push(`Poids : ${f1(w[w.length - 1].kg)} kg.`)
  if (i.tabacLine) facts.push(i.tabacLine)
  if (i.notesCount) facts.push(`${i.notesCount} note(s) cette semaine.`)

  const coach: string[] = []
  const total = runs.length + renfos.length
  const ratio = total ? (done(runs) + done(renfos)) / total : 0
  const t = i.tone
  if (total && ratio >= 0.9) coach.push(t === 'cash' ? 'Semaine complète. Rien à redire.' : 'Semaine complète : c’est la régularité qui fait progresser. Bravo.')
  else if (total && ratio >= 0.6) coach.push(t === 'bienveillant' ? 'Une bonne semaine, même si tout n’a pas été fait. On garde le cap.' : 'Correct, mais il manque des séances. La semaine prochaine, on vise le plein.')
  else if (total) coach.push(t === 'cash' ? 'Semaine ratée. Si le planning ne colle pas, change tes dispos ; sinon, on s’y remet lundi.' : 'Peu de séances faites cette semaine. Ajuste tes dispos si le planning est trop ambitieux, le plan suivra.')
  if (renfos.length && done(renfos) === 0) coach.push('Le renfo est passé à la trappe : c’est ton point faible, on le cale en priorité la semaine prochaine.')
  if (prevMin >= 60 && runMin > prevMin * 1.15) coach.push(`Volume en hausse de ${Math.round((runMin / prevMin - 1) * 100)} % : attention à ne pas monter trop vite.`)
  if (avg('travail') != null && avg('travail')! <= 2.2) coach.push('Grosse semaine au travail : l’entraînement doit rester une soupape, pas une charge de plus.')
  if (sleep.length >= 4 && sleep.reduce((a, b) => a + b, 0) / sleep.length < 6.5) coach.push('Tes nuits sont courtes : c’est la priorité de la semaine prochaine.')
  const elapsed = ongoing ? Math.max(1, Math.round((new Date(i.today! + 'T12:00:00').getTime() - new Date(i.monday + 'T12:00:00').getTime()) / 86400000) + 1) : 7
  if (c.length < Math.min(4, Math.ceil(elapsed * 0.6))) coach.push('Fais ton check du matin plus souvent : c’est lui qui me permet d’adapter tes séances.')

  const nextWeek = i.nextSessions
    .filter((s) => s.status === 'planned' && s.kind !== 'repos')
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((s) => `${DAYS[(new Date(s.date + 'T12:00:00').getDay() + 6) % 7]} : ${s.title} (${s.durationMin} min)`)
  if (ongoing) coach.unshift('Semaine en cours : je ne compte que les jours déjà passés.')
  return { title: `${ongoing ? 'Bilan en cours, semaine' : 'Bilan de la semaine'} du ${new Date(i.monday + 'T12:00:00').getDate()}/${new Date(i.monday + 'T12:00:00').getMonth() + 1}`, facts, coach, nextWeek }
}

export function reviewText(r: WeeklyReview): string {
  return [r.title, '', ...r.facts.map((x) => `• ${x}`), '', 'Le coach :', ...r.coach.map((x) => `• ${x}`), ...(r.nextWeek.length ? ['', 'Semaine prochaine :', ...r.nextWeek.map((x) => `• ${x}`)] : [])].join('\n')
}
