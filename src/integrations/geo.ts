import { parseArea, type Area } from '../domain/races'

/**
 * Département à partir de la position (API adresse du gouvernement, gratuite, sans clé).
 * Seules des coordonnées arrondies (~1 km) sont envoyées ; en cas d'échec, rien n'est bloqué.
 */
export async function reverseArea(lat: number, lon: number, fetchFn: typeof fetch = fetch): Promise<Area | undefined> {
  try {
    const res = await fetchFn(`https://api-adresse.data.gouv.fr/reverse/?lon=${lon.toFixed(2)}&lat=${lat.toFixed(2)}&limit=1`)
    if (!res.ok) return undefined
    return parseArea(await res.json())
  } catch {
    return undefined
  }
}
