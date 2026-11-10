import { useEffect, useState } from 'react'
import Dexie from 'dexie'

/**
 * Exécute `fn` puis la ré-exécute après chaque écriture dans la base locale.
 * Plus robuste que useLiveQuery pour les lectures composées (plusieurs fonctions async).
 */
export function useDbQuery<T>(fn: () => Promise<T>, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T>()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    Dexie.on('storagemutated', bump)
    return () => Dexie.on('storagemutated').unsubscribe(bump)
  }, [])
  useEffect(() => {
    let alive = true
    fn().then((v) => alive && setValue(v))
    return () => {
      alive = false
    }
  }, [tick, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps
  return value
}
