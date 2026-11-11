import type { ISODate, PlannedSession } from '../data/types'
import { db, getSetting, setSetting, type CoachDB } from '../data/db'
import { addDays } from '../domain/dates'
import { assessSessionWeather, parseForecast, swapCandidate, type Forecast, type SessionWeather } from '../domain/runWeather'
import { currentPosition, fetchForecast } from '../integrations/weather'
import { getCalendarOptions, slotsFor } from './calendar'
import { getNutritionConfig } from './nutrition'

const KEY = 'meteo.forecast'

/** Prévision mise en cache 3 h. Ne bloque jamais : sans météo, rien ne s'affiche. */
async function forecast(database: CoachDB, fetchPos = currentPosition, fetchF = fetchForecast): Promise<Forecast | undefined> {
  const cached = await getSetting<{ at: string; f: Forecast }>(KEY, database)
  if (cached && Date.now() - Date.parse(cached.at) < 3 * 3600_000) return cached.f
  if (!(await getNutritionConfig(database)).weather) return undefined
  try {
    const pos = await fetchPos()
    if (!pos) return cached?.f
    const f = parseForecast(await fetchF(pos.lat, pos.lon))
    if (f) await setSetting(KEY, { at: new Date().toISOString(), f }, database)
    return f ?? cached?.f
  } catch {
    return cached?.f
  }
}

export interface WeatherAdvice extends SessionWeather {
  session: PlannedSession
  swapWith?: PlannedSession
}

/** Séances de course d'aujourd'hui à J+3 avec la météo prévue à leur heure. */
export async function sessionsWeather(today: ISODate, database: CoachDB = db, deps?: { pos?: typeof currentPosition; fetch?: typeof fetchForecast }): Promise<WeatherAdvice[]> {
  const f = await forecast(database, deps?.pos, deps?.fetch)
  if (!f) return []
  const all = (await database.sessions.where('date').between(today, addDays(today, 3), true, true).toArray()).filter((s) => s.status === 'planned')
  const o = await getCalendarOptions(database)
  const slots = await slotsFor(all.map((s) => s.date), database)
  const at = (s: PlannedSession) => o.times[slots.get(s.date) ?? 'soir']
  const w = (s: PlannedSession) => assessSessionWeather(s, at(s), f)
  const out: WeatherAdvice[] = []
  for (const s of all.filter((x) => x.kind !== 'renfo')) {
    const r = w(s)
    if (!r) continue
    out.push({ ...r, session: s, swapWith: r.level === 'decaler' && !s.locked ? swapCandidate(s, all, w) : undefined })
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1))
}
