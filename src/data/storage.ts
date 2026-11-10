/**
 * Stockage persistant.
 *
 * Safari peut effacer les données d'un site après 7 jours sans visite, MAIS
 * une appli ajoutée à l'écran d'accueil a son propre stockage, qui n'est pas
 * soumis à cette règle. On demande quand même la persistance (navigator.storage.persist).
 * Attention : supprimer l'icône de l'écran d'accueil supprime aussi les données.
 */
export async function requestPersistence(): Promise<boolean | undefined> {
  if (!navigator.storage?.persist) return undefined
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return undefined
  }
}

export async function storageEstimate(): Promise<{ usageMb: number; quotaMb: number } | undefined> {
  if (!navigator.storage?.estimate) return undefined
  const e = await navigator.storage.estimate()
  return { usageMb: (e.usage ?? 0) / 1e6, quotaMb: (e.quota ?? 0) / 1e6 }
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
