import type { ISODate } from '../data/types'
import { db, getSetting, setSetting, type CoachDB } from '../data/db'
import { estimateFitness } from '../domain/fitness'
import { raceToGoal, realisticWindows, type Area, type PlannedRace } from '../domain/races'
import { getPlanConfig } from './config'
import { assess, getPerformances, recentWeeklyMinutes, setGoal } from './goals'

const RACES_KEY = 'races.list'
const AREA_KEY = 'races.area'

export const getRaces = async (database: CoachDB = db) => ((await getSetting<PlannedRace[]>(RACES_KEY, database)) ?? []).sort((a, b) => (a.date < b.date ? -1 : 1))
export const getArea = (database: CoachDB = db) => getSetting<Area>(AREA_KEY, database)
export const saveArea = (a: Area, database: CoachDB = db) => setSetting(AREA_KEY, a, database)

export async function addRace(r: Omit<PlannedRace, 'id'>, database: CoachDB = db) {
  const race = { ...r, id: `race-${Date.now().toString(36)}` }
  await setSetting(RACES_KEY, [...(await getRaces(database)), race], database)
  return race
}
export async function removeRace(id: string, database: CoachDB = db) {
  await setSetting(RACES_KEY, (await getRaces(database)).filter((r) => r.id !== id), database)
}

export const assessRace = (r: PlannedRace, today: ISODate, database: CoachDB = db) => assess(raceToGoal(r), today, database)
export const launchRace = (r: PlannedRace, today: ISODate, database: CoachDB = db) => setGoal(raceToGoal(r), today, database)

export async function getWindows(today: ISODate, database: CoachDB = db) {
  const cfg = await getPlanConfig(database)
  const fitness = estimateFitness(await getPerformances(database), today)
  return realisticWindows(today, fitness, await recentWeeklyMinutes(today, database), (cfg?.mode ?? 'reprise') !== 'reprise', cfg?.repriseLevel ?? 1)
}
