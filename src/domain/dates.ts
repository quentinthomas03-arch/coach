/** Utilitaires de dates en heure locale (format AAAA-MM-JJ). */

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: string, n: number): string {
  const d = parseISODate(s)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function todayISO(now = new Date()): string {
  return toISODate(now)
}

/** Lundi de la semaine contenant la date. */
export function mondayOf(s: string): string {
  const d = parseISODate(s)
  const wd = (d.getDay() + 6) % 7
  return addDays(s, -wd)
}

/** 0 = lundi … 6 = dimanche */
export function weekdayIndex(s: string): number {
  return (parseISODate(s).getDay() + 6) % 7
}

const fmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
export function formatLongFr(s: string): string {
  return fmt.format(parseISODate(s))
}
