import type { ISODate } from '../data/types'
import { db } from '../data/db'
import { addDays } from '../domain/dates'
import { buildLoadEntries } from '../domain/load'
import { tabacStatus } from '../domain/tabac'
import { weeklyReview, type WeeklyReview } from '../domain/weeklyReview'
import { getPlanConfig, getTabac } from './config'
import { nutritionDay } from './nutrition'

export async function buildWeeklyReview(monday: ISODate, today?: ISODate): Promise<WeeklyReview> {
  const end = addDays(monday, 7)
  const [cfg, sessions, nextSessions, acts, fb, checkins, well, weights, notes, tabacCfg] = await Promise.all([
    getPlanConfig(),
    db.sessions.where('date').between(addDays(monday, -7), end, true, false).toArray(),
    db.sessions.where('date').between(end, addDays(end, 7), true, false).toArray(),
    db.activities.where('date').between(addDays(monday, -7), end, true, false).toArray(),
    db.feedback.where('date').between(addDays(monday, -7), end, true, false).toArray(),
    db.checkins.where('date').between(monday, end, true, false).toArray(),
    db.wellness.where('date').between(monday, end, true, false).toArray(),
    db.bodyMetrics.where('date').between(monday, end, true, false).toArray(),
    db.notes.where('date').between(monday, end, true, false).count(),
    getTabac(),
  ])
  const waterMl: number[] = []
  for (let i = 0; i < 7; i++) waterMl.push((await nutritionDay(addDays(monday, i))).waterMl)
  let tabacLine: string | undefined
  if (tabacCfg) {
    const logs = (await db.checkins.toArray()).filter((c) => c.cigarettes != null).map((c) => ({ date: addDays(c.date, -1), count: c.cigarettes! }))
    const st = tabacStatus(tabacCfg, logs, addDays(end, -1))
    tabacLine = st.phase === 'preparation' ? `Tabac : J−${st.daysUntilQuit} avant l’arrêt.` : `Tabac : ${st.daysSmokeFree} jour(s) sans fumer, ${Math.round(st.moneySaved ?? 0)} € économisés.`
  }
  return weeklyReview({
    monday,
    today,
    tone: cfg?.tone ?? 'direct',
    sessions,
    nextSessions,
    entries: buildLoadEntries(acts, sessions, fb),
    checkins,
    sleepHours: well.map((w) => w.sleepHours),
    waterMl,
    weights: weights.filter((w) => w.weightKg).map((w) => ({ date: w.date, kg: w.weightKg! })),
    tabacLine,
    notesCount: notes,
  })
}
