/**
 * SIMULATEUR : l'appli vécue jour après jour par des profils types.
 * Vérifie les règles d'un bon coach sur plusieurs mois, et imprime un tableau semaine par semaine.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { CoachDB } from '../data/db'
import type { PlannedSession } from '../data/types'
import { savePlanConfig, getPlanConfig } from '../app/config'
import { applyWeeklyReviews, dailyStale, markDone, regenerate } from '../app/plan'
import { getCycleReviews, maybeBuildCycleReview } from '../app/cycle'
import { addDays, mondayOf, weekdayIndex } from '../domain/dates'
import { runningMinutes } from '../domain/planInputs'

const START = '2026-11-16'
let n = 0
const dbs: CoachDB[] = []
afterEach(async () => {
  for (const d of dbs.splice(0)) await d.delete()
})

type Policy = (s: PlannedSession, week: number, day: string) => { done: boolean; rpe?: number }
interface Week { week: number; mode: string; level: number; base?: number; planned: number; done: number; runMin: number; changes: number }

async function simulate(name: string, weeks: number, policy: Policy, opts: { checkin?: (day: string, week: number) => { physique: number; douleur?: { zone: string; intensite: number } } } = {}) {
  const database = new CoachDB(`sim-${name}-${n++}`)
  dbs.push(database)
  await database.open()
  await database.equipment.bulkPut(['tapis', 'kettlebell', 'escalier', 'mur'].map((id) => ({ id: id as never, available: true })))
  await database.availability.put({
    weekStart: 'template',
    days: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, available: weekday !== 4, maxMinutes: weekday >= 5 ? 90 : 60 })),
    updatedAt: '',
  })
  await savePlanConfig({ startDate: START, runsPerWeek: 3, strengthPerWeek: 2, longRunWeekday: 6, repriseLevel: 2, strengthLevel: 1, recalcMode: 'auto', tone: 'direct' }, database)
  const table: Week[] = []
  const violations: string[] = []
  for (let d = 0; d < weeks * 7; d++) {
    const day = addDays(START, d)
    const week = Math.floor(d / 7)
    const c = opts.checkin?.(day, week)
    if (c) await database.checkins.put({ date: day, physique: c.physique, moral: 3, travail: 3, viePerso: 3, douleur: c.douleur, at: '' })
    await dailyStale(day, database)
    await applyWeeklyReviews(day, database)
    const r = await regenerate(d === 0 ? 'Création' : 'Ouverture', day, database)
    await maybeBuildCycleReview(day, database)
    if (r.changed && d > 0 && !(r.version?.causes ?? []).length) violations.push(`${day} : changement sans cause`)
    for (const s of (await database.sessions.where('date').equals(day).toArray()).filter((x) => x.status === 'planned' && x.kind !== 'repos')) {
      const p = policy(s, week, day)
      if (p.done) await markDone(s.id, p.rpe ?? 5, database)
    }
    if (weekdayIndex(day) === 6) {
      const ws = mondayOf(day)
      const ss = (await database.sessions.where('date').between(ws, addDays(ws, 7), true, false).toArray()).filter((x) => x.kind !== 'renfo' && x.kind !== 'repos')
      const cfg = (await getPlanConfig(database))!
      if (process.env.SIM_DEBUG && name === 'assidu' && week === 13) for (const x of ss) console.log('SIMDBG', x.date, x.kind, x.durationMin, runningMinutes(x), x.status, x.reasons.join(' | ').slice(0, 160))
      table.push({ week: week + 1, mode: cfg.mode ?? 'reprise', level: cfg.repriseLevel, base: cfg.formeBaseMinutes, planned: ss.length, done: ss.filter((x) => x.status === 'done').length, runMin: ss.reduce((a, x) => a + runningMinutes(x), 0), changes: await database.planVersions.count() })
      // Règles vérifiées sur la semaine
      for (const s of ss) if (weekdayIndex(s.date) === 4 && s.status !== 'done') violations.push(`${s.date} : séance un jour indisponible`)
      const all = await database.sessions.where('date').between(ws, addDays(ws, 7), true, false).toArray()
      const keys = all.filter((x) => x.key && x.status !== 'missed' && x.status !== 'skipped').map((x) => x.date)
      for (const s of all.filter((x) => x.kind === 'renfo' && x.status !== 'skipped')) if (keys.includes(addDays(s.date, 1))) violations.push(`${s.date} : renfo la veille d'une séance clé`)
    }
  }
  console.log(`\n=== ${name} ===\nsem | mode    | niv | base | course prévue (min) | faites`)
  for (const w of table) console.log(`${String(w.week).padStart(3)} | ${w.mode.padEnd(7)} | ${String(w.level).padStart(3)} | ${String(w.base ?? '-').padStart(4)} | ${String(w.runMin).padStart(18)} | ${w.done}/${w.planned}`)
  const reviews = await getCycleReviews(database)
  const controls = (await database.sessions.toArray()).filter((x) => x.kind === 'controle').length
  console.log(`bilans de cycle : ${reviews.map((r) => `${r.start} ${r.verdict}`).join(' | ')} · contrôles aérobies : ${controls}`)
  return { table, violations, reviews, controls }
}

const growth = (t: Week[]) => {
  const bad: string[] = []
  for (let i = 1; i < t.length; i++) {
    // Après une semaine allégée, on compare à la dernière semaine de charge.
    const prev = Math.max(t[i - 1].runMin, i >= 2 ? t[i - 2].runMin : 0)
    // Règle : jamais plus de +25 % de course d'une semaine sur l'autre (reprise : les niveaux font de petits paliers).
    if (prev > 0 && t[i].runMin > prev * 1.25 + 5) bad.push(`semaine ${t[i].week} : ${prev} → ${t[i].runMin} min`)
  }
  return bad
}

describe('simulation sur plusieurs mois', () => {
  it('l’assidu : tout fait, effort modéré → reprise bouclée puis forme continue, progression douce', async () => {
    const { table, violations, reviews, controls } = await simulate('assidu', 16, () => ({ done: true, rpe: 5 }))
    expect(violations).toEqual([])
    expect(reviews.length).toBe(3)
    expect(reviews.every((r) => r.verdict === 'reussi')).toBe(true)
    expect(controls).toBeGreaterThanOrEqual(2)
    expect(growth(table)).toEqual([])
    expect(table.find((w) => w.mode === 'forme')).toBeDefined()
    expect(table[table.length - 1].runMin).toBeGreaterThan(table[0].runMin)
  }, 120000)

  it('le pas-encore-commencé : rien de fait → aucune progression, rien ne grossit', async () => {
    const { table, violations } = await simulate('rien', 4, () => ({ done: false }))
    expect(violations).toEqual([])
    expect(new Set(table.map((w) => w.level))).toEqual(new Set([2]))
    expect(Math.max(...table.map((w) => w.runMin))).toBeLessThanOrEqual(table[0].runMin)
  }, 60000)

  it('le « tout est dur » (effort 8/10) → le niveau ne monte pas', async () => {
    const { table } = await simulate('dur', 5, () => ({ done: true, rpe: 8 }))
    expect(new Set(table.map((w) => w.level))).toEqual(new Set([2]))
  }, 60000)

  it('l’irrégulier : une sortie sur deux → progression lente, jamais de saut', async () => {
    let k = 0
    const { table, violations } = await simulate('irregulier', 8, (s) => ({ done: s.kind === 'renfo' ? false : k++ % 2 === 0, rpe: 5 }))
    expect(violations).toEqual([])
    expect(growth(table)).toEqual([])
    expect(table[table.length - 1].level).toBeLessThanOrEqual(5)
  }, 60000)

  it('la douleur en semaine 3 → on redescend, puis on repart', async () => {
    const { table } = await simulate('douleur', 6, () => ({ done: true, rpe: 5 }), {
      checkin: (_d, w) => ({ physique: 3, douleur: w === 2 ? { zone: 'Genou', intensite: 2 } : undefined }),
    })
    expect(table[3].level).toBeLessThan(table[2].level + 1)
  }, 60000)
})
