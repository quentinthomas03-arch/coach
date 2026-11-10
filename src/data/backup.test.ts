import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { CoachDB, SETTING } from './db'
import { BackupError, exportBackup, importBackup, isBackupDue, parseBackup } from './backup'

let n = 0
let a: CoachDB
let b: CoachDB

beforeEach(async () => {
  a = new CoachDB(`test-a-${n}`)
  b = new CoachDB(`test-b-${n++}`)
  await a.open()
  await b.open()
})
afterEach(async () => {
  await a.delete()
  await b.delete()
})

async function seed(database: CoachDB) {
  await database.profile.put({
    id: 'me',
    sex: 'homme',
    birthYear: 1992,
    weightKg: 75,
    injuries: [],
    foodDislikes: ['saumon'],
    updatedAt: '2026-11-10T08:00:00.000Z',
  })
  await database.settings.bulkPut([
    { key: SETTING.intervalsAthleteId, value: 'i12345' },
    { key: SETTING.intervalsApiKey, value: 'SECRET' },
  ])
  await database.sessions.put({
    id: 's1',
    date: '2026-11-11',
    kind: 'marche-course',
    title: 'Reprise',
    durationMin: 30,
    reasons: ['Reprise après 6 mois'],
    status: 'planned',
    externalId: 'coach-s1',
    sync: { status: 'not-sent' },
  })
  await database.foodLog.add({
    date: '2026-11-10',
    meal: 'dejeuner',
    foodId: 'ciqual-1',
    name: 'Riz',
    grams: 150,
    kcal: 195,
    protein: 4,
    carbs: 42,
    fat: 0.5,
    at: '2026-11-10T12:00:00.000Z',
  })
  await database.hydration.add({ date: '2026-11-10', ml: 250, at: '2026-11-10T09:00:00.000Z' })
}

describe('sauvegarde', () => {
  it("export puis import restitue les données sans perte (hors secret)", async () => {
    await seed(a)
    const file = await exportBackup(a)
    const restored = parseBackup(JSON.stringify(file))
    await importBackup(restored, b)

    expect(await b.profile.get('me')).toEqual(await a.profile.get('me'))
    expect(await b.sessions.toArray()).toEqual(await a.sessions.toArray())
    expect(await b.foodLog.toArray()).toEqual(await a.foodLog.toArray())
    expect(await b.hydration.toArray()).toEqual(await a.hydration.toArray())
    expect((await b.settings.get(SETTING.intervalsAthleteId))?.value).toBe('i12345')
  })

  it('garde objectif, performances, menu, panier et réglages nutrition', async () => {
    await seed(a)
    await a.settings.bulkPut([
      { key: 'goal.current', value: { id: 'g', type: 'route', distance: '10k', date: '2027-04-11' } },
      { key: 'perf.list', value: [{ id: 'p', date: '2026-03-15', distanceM: 21097.5, timeSec: 6000, source: 'record' }] },
      { key: 'menu.2026-11-16', value: { days: [], checked: ['9104'] } },
      { key: 'basket.items', value: [{ produce: 'poireau', addedAt: '2026-11-15' }] },
      { key: 'nutrition.config', value: { activity: 'sedentaire', goal: 'maintien', weather: true } },
      { key: 'tabac.config', value: { quitDate: '2027-01-01', cigsPerDayBefore: 10, packPrice: 12.5, cigsPerPack: 20, reasons: [] } },
    ])
    await importBackup(parseBackup(JSON.stringify(await exportBackup(a))), b)
    for (const k of ['goal.current', 'perf.list', 'menu.2026-11-16', 'basket.items', 'nutrition.config', 'tabac.config']) {
      expect((await b.settings.get(k))?.value).toEqual((await a.settings.get(k))?.value)
    }
  })

  it("n'exporte jamais la clé d'API", async () => {
    await seed(a)
    const json = JSON.stringify(await exportBackup(a))
    expect(json).not.toContain('SECRET')
  })

  it("conserve la clé d'API déjà présente lors d'un import", async () => {
    await seed(a)
    const file = await exportBackup(a)
    await b.settings.put({ key: SETTING.intervalsApiKey, value: 'MA-CLE' })
    await b.hydration.add({ date: '2020-01-01', ml: 1, at: 'x' })
    await importBackup(file, b)
    expect((await b.settings.get(SETTING.intervalsApiKey))?.value).toBe('MA-CLE')
    expect(await b.hydration.count()).toBe(1)
  })

  it('refuse un fichier qui n’est pas une sauvegarde', () => {
    expect(() => parseBackup('pas du json')).toThrow(BackupError)
    expect(() => parseBackup('{"foo":1}')).toThrow(BackupError)
  })

  it('refuse un format plus récent que l’appli', () => {
    const f = { app: 'coach-perso', formatVersion: 99, schemaVersion: 1, exportedAt: '', tables: {} }
    expect(() => parseBackup(JSON.stringify(f))).toThrow(/plus récente/)
  })
})

describe('rappel de sauvegarde', () => {
  const now = new Date('2026-11-10T12:00:00Z')
  it('est dû si jamais sauvegardé', () => expect(isBackupDue(undefined, now)).toBe(true))
  it('est dû après 30 jours', () => expect(isBackupDue('2026-10-01T12:00:00Z', now)).toBe(true))
  it("n'est pas dû avant 30 jours", () => expect(isBackupDue('2026-10-20T12:00:00Z', now)).toBe(false))
})

describe('migration de schéma', () => {
  it('v1 → v2 : les données existantes sont conservées, la table des notes apparaît', async () => {
    const name = `migr-${Date.now()}`
    const v1 = new Dexie(name)
    v1.version(1).stores({ settings: 'key', profile: 'id', sessions: 'id, date, kind, status, externalId', checkins: 'date' })
    await v1.open()
    await v1.table('checkins').put({ date: '2026-11-10', physique: 3, moral: 3, travail: 3, viePerso: 3, at: '' })
    await v1.table('settings').put({ key: 'plan.config', value: { repriseLevel: 4 } })
    v1.close()
    const v2 = new CoachDB(name)
    await v2.open()
    expect(v2.verno).toBe(2)
    expect(await v2.checkins.get('2026-11-10')).toMatchObject({ physique: 3 })
    expect((await v2.settings.get('plan.config'))?.value).toEqual({ repriseLevel: 4 })
    await v2.notes.add({ date: '2026-11-10', text: 'test', at: '' })
    expect(await v2.notes.count()).toBe(1)
    await v2.delete()
  })
  it('une sauvegarde v1 (sans notes) se restaure', async () => {
    await seed(a)
    const file = await exportBackup(a)
    delete (file.tables as Record<string, unknown>).notes
    await importBackup(parseBackup(JSON.stringify(file)), b)
    expect(await b.notes.count()).toBe(0)
    expect(await b.profile.get('me')).toBeDefined()
  })
})
