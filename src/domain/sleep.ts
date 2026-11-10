/**
 * SOMMEIL : heure de coucher conseillée.
 * Repère : 7 h 30 de sommeil d'habitude, 8 h la veille d'une séance clé (sortie longue,
 * séance soutenue, course), + 15 min pour s'endormir.
 */
export function bedtime(wake: string, keyTomorrow: boolean): string {
  const [h, m] = wake.split(':').map(Number)
  const sleepMin = (keyTomorrow ? 8 * 60 : 7.5 * 60) + 15
  let t = h * 60 + m - sleepMin
  t = ((t % 1440) + 1440) % 1440
  t = Math.round(t / 15) * 15
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Moyenne de sommeil (h) sur les nuits connues ; undefined si moins de 4 nuits. */
export function avgSleep(hours: (number | undefined)[]): number | undefined {
  const v = hours.filter((x): x is number => x != null)
  return v.length >= 4 ? v.reduce((a, b) => a + b, 0) / v.length : undefined
}
