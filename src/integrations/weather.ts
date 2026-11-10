/**
 * Météo du jour via Open-Meteo (gratuit, sans clé, sans compte).
 * Seules les coordonnées arrondies (~1 km) sont envoyées.
 */
export interface DayWeather {
  date: string
  tmaxC: number
}

export async function fetchTodayMax(lat: number, lon: number, fetchFn: typeof fetch = fetch): Promise<DayWeather | undefined> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&daily=temperature_2m_max&timezone=auto&forecast_days=1`
  const res = await fetchFn(url)
  if (!res.ok) return undefined
  const d = (await res.json()) as { daily?: { time?: string[]; temperature_2m_max?: number[] } }
  const date = d.daily?.time?.[0]
  const tmax = d.daily?.temperature_2m_max?.[0]
  return date && typeof tmax === 'number' ? { date, tmaxC: tmax } : undefined
}

export function currentPosition(): Promise<{ lat: number; lon: number } | undefined> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(undefined),
      { maximumAge: 6 * 3600 * 1000, timeout: 10000, enableHighAccuracy: false },
    )
  })
}
