import type { ISODate } from '../data/types'
import { db, type CoachDB } from '../data/db'
import { addDays } from '../domain/dates'
import { estimateFitness } from '../domain/fitness'
import { monthBounds, monthlyReview } from '../domain/monthlyReview'
import { cadenceInfo, personalRecords, trophies, vo2Compare } from '../domain/progress'
import { regularStreak } from '../domain/streak'
import { tabacStatus } from '../domain/tabac'
import { getTabac } from './config'
import { getPerformances } from './goals'
import { getCravings } from './tabac'

async function trophyList(today: ISODate, database: CoachDB) {
  const [acts, sessions, perfs, tabacCfg, cravings, checkins] = await Promise.all([
    database.activities.toArray(),
    database.sessions.toArray(),
    getPerformances(database),
    getTabac(database),
    getCravings(database),
    database.checkins.toArray(),
  ])
  const logs = checkins.filter((c) => c.cigarettes != null).map((c) => ({ date: addDays(c.date, -1), count: c.cigarettes! }))
  const st = tabacCfg ? tabacStatus(tabacCfg, logs, today, cravings) : undefined
  return {
    acts,
    sessions,
    perfs,
    cravings,
    checkins,
    list: trophies({ acts, sessions, streak: regularStreak(sessions, today), smokeFreeDays: st?.daysSmokeFree, smokeFreeSince: st?.smokeFreeSince, cravingsResisted: cravings.filter((c) => c.resisted).length, races: perfs.filter((p) => p.source === 'course').length }),
  }
}

export async function loadProgress(today: ISODate, database: CoachDB = db) {
  const t = await trophyList(today, database)
  const wellness = await database.wellness.where('date').between(addDays(today, -120), today, true, true).toArray()
  const fitness = estimateFitness(t.perfs, today)
  return { cadence: cadenceInfo(t.acts, today), vo2: vo2Compare(wellness, fitness.vdot, today), records: personalRecords(t.acts), trophies: t.list }
}

/** « 2026-11 » → bilan du mois. */
export async function buildMonthlyReview(month: string, today: ISODate, database: CoachDB = db) {
  const { from, to } = monthBounds(month)
  const t = await trophyList(today, database)
  const [well, foodDates] = await Promise.all([database.wellness.where('date').between(from, to, true, true).toArray(), database.foodLog.where('date').between(from, to, true, true).toArray()])
  return monthlyReview({
    month,
    today,
    acts: t.acts,
    sessions: t.sessions,
    checkins: t.checkins.map((c) => ({ ...c, date: addDays(c.date, -1) })),
    sleepHours: well.map((w) => w.sleepHours).filter((x): x is number => x != null),
    cravings: t.cravings,
    trophies: t.list,
    foodDays: new Set(foodDates.map((f) => f.date)).size,
  })
}
