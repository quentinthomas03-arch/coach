import type { ISODate, PlannedSession } from '../data/types'

/**
 * MÉTÉO DES SÉANCES : chaque séance de course des 3 prochains jours est confrontée
 * à la prévision à son heure. Le coach conseille (tenue, frontale, allure à la chaleur)
 * et, en cas de vraie mauvaise météo, propose d'échanger avec un jour plus clément.
 */

export interface HourWeather {
  /** « 2026-11-12T18:00 » (heure locale). */
  time: string
  tempC: number
  feelsC: number
  precipMm: number
  windKmh: number
  code: number
}

export interface Forecast {
  hours: HourWeather[]
  /** Lever et coucher du soleil par jour, « HH:MM ». */
  sun: Record<ISODate, { rise: string; set: string }>
}

export type WeatherLevel = 'ok' | 'conseil' | 'decaler'

export interface SessionWeather {
  sessionId: string
  date: ISODate
  level: WeatherLevel
  summary: string
  tips: string[]
}

const STORM = (c: number) => c >= 95
const FREEZING_RAIN = (c: number) => [56, 57, 66, 67].includes(c)
const SNOW = (c: number) => (c >= 71 && c <= 77) || c === 85 || c === 86

export function describeCode(c: number): string {
  if (c === 0) return 'ciel clair'
  if (c <= 3) return 'nuageux'
  if (c === 45 || c === 48) return 'brouillard'
  if (c >= 51 && c <= 57) return 'bruine'
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return 'pluie'
  if (SNOW(c)) return 'neige'
  if (STORM(c)) return 'orage'
  return 'variable'
}

/** Moyenne sur la durée de la séance (heures pleines couvertes). */
function window(f: Forecast, date: ISODate, startHHMM: string, durationMin: number): HourWeather[] {
  const h0 = Number(startHHMM.slice(0, 2))
  const n = Math.max(1, Math.ceil((Number(startHHMM.slice(3, 5)) + durationMin) / 60))
  const keys = Array.from({ length: n }, (_, i) => `${date}T${String(h0 + i).padStart(2, '0')}:00`)
  return f.hours.filter((h) => keys.includes(h.time))
}

export function assessSessionWeather(s: PlannedSession, startHHMM: string, f: Forecast): SessionWeather | undefined {
  const hs = window(f, s.date, startHHMM, s.durationMin)
  if (!hs.length) return undefined
  const max = (k: keyof HourWeather) => Math.max(...hs.map((h) => h[k] as number))
  const min = (k: keyof HourWeather) => Math.min(...hs.map((h) => h[k] as number))
  const rain = hs.reduce((a, h) => a + h.precipMm, 0)
  const wind = max('windKmh')
  const feels = min('feelsC')
  const temp = max('tempC')
  const codes = hs.map((h) => h.code)
  const tips: string[] = []
  let level: WeatherLevel = 'ok'
  const reasons: string[] = []

  if (codes.some(STORM)) {
    level = 'decaler'
    reasons.push('orage annoncé')
  }
  if (codes.some(FREEZING_RAIN) || (min('tempC') <= 0 && rain > 0.2)) {
    level = 'decaler'
    reasons.push('risque de verglas')
  }
  if (rain / hs.length >= 4) {
    level = 'decaler'
    reasons.push(`forte pluie (${Math.round(rain)} mm)`)
  }
  if (wind >= 55) {
    level = 'decaler'
    reasons.push(`vent fort (${Math.round(wind)} km/h)`)
  }

  if (level !== 'decaler') {
    if (rain >= 0.5) tips.push('Un peu de pluie : coupe-vent léger et casquette, ce n’est pas une raison de ne pas y aller.')
    if (wind >= 30) tips.push(`Vent à ${Math.round(wind)} km/h : pars face au vent, rentre vent dans le dos. Juge l’effort, pas l’allure.`)
    if (codes.some(SNOW)) tips.push('Neige : chaussures à bonne accroche, foulée courte, allure à l’effort.')
  }
  if (feels <= 0) tips.push(`Ressenti ${Math.round(feels)} °C : 3 couches, gants et bonnet. Fais l’échauffement guidé à l’intérieur avant de sortir, et rentre vite te changer.`)
  else if (feels <= 5) tips.push(`Ressenti ${Math.round(feels)} °C : manches longues, gants. Tu dois avoir un peu froid les 5 premières minutes.`)
  if (temp >= 25) tips.push(`${Math.round(temp)} °C : ralentis de 10 à 20 s/km, cours à l’ombre et bois avant de partir. Ta FC montera plus vite, c’est normal.`)

  const sun = f.sun[s.date]
  if (sun) {
    const endMin = Number(startHHMM.slice(0, 2)) * 60 + Number(startHHMM.slice(3, 5)) + s.durationMin
    const toMin = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3, 5))
    if (endMin > toMin(sun.set) + 15 || toMin(startHHMM) < toMin(sun.rise) - 15) tips.push(`Nuit (soleil couché à ${sun.set}) : frontale, vêtement réfléchissant, parcours éclairé et connu.`)
  }

  if (level === 'ok' && tips.length) level = 'conseil'
  const desc = `${describeCode(codes[0])}, ${Math.round(hs[0].tempC)} °C`
  return { sessionId: s.id, date: s.date, level, summary: level === 'decaler' ? `${desc} : ${reasons.join(', ')}` : desc, tips }
}

/**
 * Jour de remplacement : une autre séance prévue (course ou renfo) dans les 3 jours,
 * non verrouillée, dont la météo est bonne (le renfo se fait à l'intérieur : toujours possible).
 */
export function swapCandidate(bad: PlannedSession, others: PlannedSession[], weatherOf: (s: PlannedSession) => SessionWeather | undefined): PlannedSession | undefined {
  const runs = others.filter((o) => o.id !== bad.id && o.status === 'planned' && o.date !== bad.date && !o.locked)
  // Échanger avec un renfo : la course prend le jour du renfo, le renfo se fait au sec.
  const ok = runs.filter((o) => {
    if (o.kind === 'renfo') return weatherOf({ ...bad, date: o.date })?.level !== 'decaler'
    return weatherOf(o)?.level !== 'decaler' && weatherOf({ ...o, date: bad.date })?.level !== 'decaler'
  })
  return ok.sort((a, b) => Math.abs(Date.parse(a.date) - Date.parse(bad.date)) - Math.abs(Date.parse(b.date) - Date.parse(bad.date)))[0]
}

export const INDOOR_PLAN_B = 'Plan B à la maison : échauffement guidé, puis 10 à 15 montées d’escalier à allure facile (descente en marchant), ou la séance de renfo prévue cette semaine.'

/** Lecture de la réponse Open-Meteo. */
export function parseForecast(raw: unknown): Forecast | undefined {
  const d = raw as {
    hourly?: { time?: string[]; temperature_2m?: number[]; apparent_temperature?: number[]; precipitation?: number[]; wind_speed_10m?: number[]; weather_code?: number[] }
    daily?: { time?: string[]; sunrise?: string[]; sunset?: string[] }
  }
  const h = d?.hourly
  if (!h?.time?.length) return undefined
  const hours = h.time.map((time, i) => ({ time, tempC: h.temperature_2m?.[i] ?? 10, feelsC: h.apparent_temperature?.[i] ?? h.temperature_2m?.[i] ?? 10, precipMm: h.precipitation?.[i] ?? 0, windKmh: h.wind_speed_10m?.[i] ?? 0, code: h.weather_code?.[i] ?? 0 }))
  const sun: Forecast['sun'] = {}
  d.daily?.time?.forEach((t, i) => {
    const rise = d.daily?.sunrise?.[i]?.slice(11, 16)
    const set = d.daily?.sunset?.[i]?.slice(11, 16)
    if (rise && set) sun[t] = { rise, set }
  })
  return { hours, sun }
}
