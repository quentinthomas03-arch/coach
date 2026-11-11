import type { ISODate } from '../data/types'
import { db, getSetting, setSetting, type CoachDB } from '../data/db'
import { addDays, mondayOf } from '../domain/dates'
import { buildIcs, DEFAULT_TIMES, type Slot } from '../domain/ics'
import { getAvailability } from './config'

export interface CalendarOptions {
  times: Record<Slot, string>
  alarmMin: number
}
const KEY = 'calendar.options'
export const getCalendarOptions = async (database: CoachDB = db): Promise<CalendarOptions> => ({ times: DEFAULT_TIMES, alarmMin: 60, ...((await getSetting<CalendarOptions>(KEY, database)) ?? {}) })
export const saveCalendarOptions = (o: CalendarOptions, database: CoachDB = db) => setSetting(KEY, o, database)

/** Créneau (matin, midi, soir) de chaque jour, d'après les dispos de la semaine. */
export async function slotsFor(dates: ISODate[], database: CoachDB = db): Promise<Map<ISODate, Slot>> {
  const slots = new Map<ISODate, Slot>()
  for (const date of dates) {
    if (slots.has(date)) continue
    const { days } = await getAvailability(mondayOf(date), database)
    const wd = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7
    slots.set(date, days.find((d) => d.weekday === wd)?.slot ?? (wd >= 5 ? 'matin' : 'soir'))
  }
  return slots
}

/** Séances prévues des 14 prochains jours, au format agenda. */
export async function calendarFile(today: ISODate, database: CoachDB = db, now = new Date()): Promise<{ ics: string; count: number }> {
  const sessions = (await database.sessions.where('date').between(today, addDays(today, 13), true, true).toArray()).filter((s) => s.status === 'planned').sort((a, b) => (a.date < b.date ? -1 : 1))
  const o = await getCalendarOptions(database)
  const slots = await slotsFor(sessions.map((s) => s.date), database)
  return { ics: buildIcs(sessions, (d) => slots.get(d) ?? 'soir', { ...o, now }), count: sessions.length }
}

/** Ouvre le fichier : sur iPhone, Safari propose « Tout ajouter » à l'agenda. Repli : partage du fichier. */
export async function openCalendar(today: ISODate, mode: 'open' | 'share' = 'open') {
  const { ics, count } = await calendarFile(today)
  const blob = new Blob([ics], { type: 'text/calendar' })
  if (mode === 'share') {
    const file = new File([blob], 'coach-seances.ics', { type: 'text/calendar' })
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    if (nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: 'Séances Coach' }).catch(() => undefined)
      return count
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'coach-seances.ics'
  a.rel = 'noopener'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return count
}
