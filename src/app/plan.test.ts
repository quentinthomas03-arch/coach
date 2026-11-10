import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CoachDB } from '../data/db'
import { addDays } from '../domain/dates'
import { IntervalsClient } from '../integrations/intervals'
import { KEYS, savePlanConfig, type PlanConfig } from './config'
import { acceptVersion, applyWeeklyReviews, endPause, markDone, moveSession, regenerate, rejectVersion, removeSession, startPause, undoVersion } from './plan'
import { sessionsToSend, syncToWatch } from './sync'

const MONDAY = '2026-11-16'
let n = 0
let database: CoachDB

const cfg = (over: Partial<PlanConfig> = {}): PlanConfig => ({
  startDate: MONDAY, runsPerWeek: 3, strengthPerWeek: 2, longRunWeekday: 6, repriseLevel: 2, strengthLevel: 1,
  recalcMode: 'auto', tone: 'direct', ...over,
})

beforeEach(async () => {
  database = new CoachDB(`plan-${n++}`)
  await database.open()
  await database.equipment.bulkPut(['tapis', 'kettlebell', 'escalier', 'mur'].map((id) => ({ id: id as never, available: true })))
  await savePlanConfig(cfg(), database)
})
afterEach(() => database.delete())

describe('service du plan', () => {
  it('première génération : 2 semaines, appliquée directement', async () => {
    const r = await regenerate('Création du plan', MONDAY, database)
    expect(r.changed).toBe(true)
    const all = await database.sessions.toArray()
    expect(all.filter((s) => s.kind !== 'renfo')).toHaveLength(6)
    expect(all.filter((s) => s.kind === 'renfo')).toHaveLength(4)
    expect(r.version!.status).toBe('applied')
  })

  it('recalcul sans changement : aucune nouvelle version', async () => {
    await regenerate('Création', MONDAY, database)
    expect((await regenerate('Rien', MONDAY, database)).changed).toBe(false)
    expect(await database.planVersions.count()).toBe(1)
  })

  it('je déplace une séance : elle est verrouillée et le reste s’organise autour', async () => {
    await regenerate('Création', MONDAY, database)
    const run = (await database.sessions.toArray()).find((s) => s.kind === 'marche-course' && s.date < addDays(MONDAY, 7))!
    const target = addDays(MONDAY, 1)
    await moveSession(run.id, target, MONDAY, database)
    const moved = await database.sessions.get(run.id)
    expect(moved).toMatchObject({ date: target, locked: true, origin: 'moi' })
    const week = (await database.sessions.toArray()).filter((s) => s.date < addDays(MONDAY, 7))
    expect(week.filter((s) => s.kind !== 'renfo' && s.status !== 'skipped')).toHaveLength(3)
    // Pas de renfo la veille de la sortie longue.
    const longDate = week.find((s) => s.kind === 'sortie-longue')!.date
    expect(week.some((s) => s.kind === 'renfo' && s.date === addDays(longDate, -1))).toBe(false)
  })

  it('mode « valider » : la proposition attend mon accord, puis s’applique ou se refuse', async () => {
    await regenerate('Création', MONDAY, database)
    await savePlanConfig(cfg({ recalcMode: 'valider', repriseLevel: 4 }), database)
    const before = await database.sessions.toArray()
    const r = await regenerate('Niveau changé', MONDAY, database)
    expect(r.version!.status).toBe('pending')
    expect(await database.sessions.toArray()).toEqual(before)
    await acceptVersion(r.version!.id!, database)
    expect((await database.sessions.toArray()).some((s) => s.reasons[0]?.includes('niveau 4'))).toBe(true)

    await savePlanConfig(cfg({ recalcMode: 'valider', repriseLevel: 5 }), database)
    const r2 = await regenerate('Encore', MONDAY, database)
    await rejectVersion(r2.version!.id!, database)
    expect((await database.planVersions.get(r2.version!.id!))!.status).toBe('rejected')
  })

  it('mode valider : une proposition refusée ne revient pas à l’identique', async () => {
    await regenerate('Création', MONDAY, database)
    await savePlanConfig(cfg({ recalcMode: 'valider', repriseLevel: 4 }), database)
    const r = await regenerate('Niveau changé', MONDAY, database)
    await rejectVersion(r.version!.id!, database)
    expect((await regenerate('Ouverture suivante', MONDAY, database)).changed).toBe(false)
  })

  it('séance retirée par moi après envoi : retirée aussi de la montre', async () => {
    await regenerate('Création', MONDAY, database)
    const run = (await database.sessions.toArray()).find((s) => s.kind === 'marche-course')!
    await database.sessions.update(run.id, { sync: { status: 'sent' } })
    await removeSession(run.id, MONDAY, database)
    expect((await database.settings.get(KEYS.pendingDeletes))!.value).toContain(run.externalId)
  })

  it('annuler un recalcul remet le plan d’avant', async () => {
    await regenerate('Création', MONDAY, database)
    const before = (await database.sessions.toArray()).map((s) => s.id).sort()
    await savePlanConfig(cfg({ repriseLevel: 5 }), database)
    const r = await regenerate('Niveau 5', MONDAY, database)
    await undoVersion(r.version!.id!, database)
    const after = await database.sessions.toArray()
    expect(after.map((s) => s.id).sort()).toEqual(before)
    expect(after.filter((s) => s.kind !== 'renfo').every((s) => s.reasons[0].includes('niveau 2'))).toBe(true)
  })

  it('bilan hebdo : semaine validée → niveau suivant', async () => {
    await regenerate('Création', MONDAY, database)
    const runs = (await database.sessions.toArray()).filter((s) => s.kind !== 'renfo' && s.date < addDays(MONDAY, 7))
    for (const r of runs) await markDone(r.id, 5, database)
    const d = await applyWeeklyReviews(addDays(MONDAY, 7), database)
    expect(d[0]).toMatchObject({ change: 'monte', level: 3 })
    expect((await database.settings.get(KEYS.plan))!.value).toMatchObject({ repriseLevel: 3, lastReviewedWeek: MONDAY })
    // Idempotent.
    expect(await applyWeeklyReviews(addDays(MONDAY, 7), database)).toEqual([])
  })
})

describe('surcharge prolongée', () => {
  it('3 semaines de travail écrasant : une sortie de moins, retour à la normale ensuite', async () => {
    for (let i = 1; i <= 15; i++) await database.checkins.put({ date: addDays(MONDAY, -i), physique: 3, moral: 3, travail: 1, viePerso: 3, at: '' })
    await regenerate('Création', MONDAY, database)
    const week = (await database.sessions.toArray()).filter((s) => s.date < addDays(MONDAY, 7))
    expect(week.filter((s) => s.kind !== 'renfo')).toHaveLength(2)
    expect(week.filter((s) => s.kind === 'renfo')).toHaveLength(1)
  })
})

describe('pause', () => {
  it('pas de séance pendant la pause, retrait de la montre, reprise adaptée', async () => {
    await savePlanConfig(cfg({ repriseLevel: 5 }), database)
    await regenerate('Création', MONDAY, database)
    const run = (await database.sessions.toArray()).find((s) => s.kind === 'marche-course')!
    await database.sessions.update(run.id, { sync: { status: 'sent' } })
    await startPause({ from: MONDAY, reason: 'maladie' }, MONDAY, database)
    expect((await database.sessions.toArray()).filter((s) => s.date >= MONDAY)).toHaveLength(0)
    expect((await database.settings.get(KEYS.pendingDeletes))!.value).toContain(run.externalId)
    const d = await endPause(addDays(MONDAY, 14), database)
    expect(d!.repriseLevel).toBe(2)
    expect((await database.sessions.toArray()).some((s) => s.date >= addDays(MONDAY, 14))).toBe(true)
  })
})

describe('passage en forme continue', () => {
  it('reprise validée au niveau 9 → forme continue, puis volume +8 % après une bonne semaine', async () => {
    await savePlanConfig(cfg({ repriseLevel: 9 }), database)
    await regenerate('Création', MONDAY, database)
    const week1 = (await database.sessions.toArray()).filter((s) => s.kind !== 'renfo' && s.date < addDays(MONDAY, 7))
    for (const r of week1) await markDone(r.id, 4, database)
    const d = await applyWeeklyReviews(addDays(MONDAY, 7), database)
    expect(d[0].completed).toBe(true)
    const c = (await database.settings.get(KEYS.plan))!.value as PlanConfig
    expect(c.mode).toBe('forme')
    const base = c.formeBaseMinutes!
    expect(base).toBe(week1.reduce((a, s) => a + s.durationMin, 0))

    await regenerate('Semaine 2', addDays(MONDAY, 7), database)
    const week2 = (await database.sessions.toArray()).filter((s) => s.kind !== 'renfo' && s.date >= addDays(MONDAY, 7) && s.date < addDays(MONDAY, 14))
    expect(week2.some((s) => s.kind === 'fractionne')).toBe(true) // semaine 2 du cycle
    for (const r of week2) await markDone(r.id, 5, database)
    await applyWeeklyReviews(addDays(MONDAY, 14), database)
    const c2 = (await database.settings.get(KEYS.plan))!.value as PlanConfig
    expect(c2.formeBaseMinutes).toBe(Math.round(base * 1.08))
  })
})

describe('envoi sur la montre', () => {
  it('envoie seulement les courses des 7 prochains jours, puis marque envoyé', async () => {
    await regenerate('Création', MONDAY, database)
    const toSend = sessionsToSend(await database.sessions.toArray(), MONDAY)
    expect(toSend.every((s) => s.kind !== 'renfo' && s.date < addDays(MONDAY, 7))).toBe(true)
    expect(toSend).toHaveLength(3)

    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : []
      return new Response(JSON.stringify(body.map((e: { external_id: string }, i: number) => ({ id: 100 + i, external_id: e.external_id }))), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    })
    const client = new IntervalsClient({ athleteId: 'i1', apiKey: 'abcdefghijkl' }, fetchFn as unknown as typeof fetch)
    const res = await syncToWatch(MONDAY, database, client)
    expect(res).toMatchObject({ ok: true, sent: 3 })
    const body = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string)
    expect(body[0]).toMatchObject({ type: 'Run', category: 'WORKOUT' })
    expect(body[0].description).toMatch(/Warmup/)
    expect(sessionsToSend(await database.sessions.toArray(), MONDAY)).toHaveLength(0)

    // Un déplacement rend la séance « à renvoyer » et retire l'ancienne de la montre si elle a disparu.
    const run = (await database.sessions.toArray()).find((s) => s.kind === 'marche-course')!
    await moveSession(run.id, addDays(MONDAY, 1), MONDAY, database)
    expect(sessionsToSend(await database.sessions.toArray(), MONDAY).map((s) => s.id)).toContain(run.id)
  })

  it('erreur réseau : séances marquées en erreur, rien de perdu', async () => {
    await regenerate('Création', MONDAY, database)
    const client = new IntervalsClient({ athleteId: 'i1', apiKey: 'abcdefghijkl' }, (async () => { throw new TypeError('Load failed') }) as unknown as typeof fetch)
    const res = await syncToWatch(MONDAY, database, client)
    expect(res.ok).toBe(false)
    expect((await database.sessions.toArray()).filter((s) => s.sync.status === 'error')).toHaveLength(3)
  })
})
