/**
 * Client minimal de l'API Intervals.icu (https://intervals.icu/api/v1/docs).
 *
 * Authentification : HTTP Basic, utilisateur « API_KEY », mot de passe = ta clé.
 * La clé ne quitte le téléphone que pour aller vers intervals.icu (ou vers ton
 * relais Cloudflare si on en active un en cas de blocage CORS).
 */

export const INTERVALS_DEFAULT_BASE = 'https://intervals.icu'

export interface IntervalsCredentials {
  athleteId: string
  apiKey: string
  /** Remplacé par l'URL du relais si le CORS bloque les appels directs. */
  baseUrl?: string
}

export type IntervalsEventType = 'Run' | 'WeightTraining' | 'Walk' | 'Ride' | 'Workout'

export interface IntervalsEventInput {
  external_id: string
  category: 'WORKOUT' | 'NOTE'
  /** Date locale « AAAA-MM-JJT00:00:00 » */
  start_date_local: string
  type: IntervalsEventType
  name: string
  description?: string
  moving_time?: number
}

export type IntervalsErrorKind = 'offline' | 'network-or-cors' | 'auth' | 'not-found' | 'http' | 'invalid-input'

export class IntervalsError extends Error {
  kind: IntervalsErrorKind
  status?: number
  constructor(kind: IntervalsErrorKind, message: string, status?: number) {
    super(message)
    this.kind = kind
    this.status = status
  }
}

/** Message en français expliquant l'erreur et quoi faire. */
export function explainError(e: unknown): string {
  if (!(e instanceof IntervalsError)) return `Erreur inattendue : ${String(e)}`
  switch (e.kind) {
    case 'offline':
      return 'Pas de connexion internet. Réessaie quand tu as du réseau.'
    case 'network-or-cors':
      return "Le navigateur a bloqué l'appel (réseau ou CORS). Si ça persiste avec du réseau, il faudra un petit relais (Cloudflare Worker)."
    case 'auth':
      return "Identifiant athlète ou clé d'API refusé. Vérifie-les dans Intervals.icu > Settings > Developer Settings."
    case 'not-found':
      return 'Ressource introuvable (identifiant athlète incorrect ?).'
    case 'invalid-input':
      return e.message
    default:
      return `Intervals.icu a répondu une erreur ${e.status ?? ''} : ${e.message}`
  }
}

type FetchLike = typeof fetch

export function authHeader(apiKey: string): string {
  return 'Basic ' + btoa(`API_KEY:${apiKey}`)
}

export function validateCredentials(c: IntervalsCredentials) {
  if (!/^i?\d+$/.test(c.athleteId.trim())) {
    throw new IntervalsError('invalid-input', "L'identifiant athlète ressemble à « i123456 » (visible dans Settings).")
  }
  if (c.apiKey.trim().length < 10) throw new IntervalsError('invalid-input', "La clé d'API semble incomplète.")
}

export class IntervalsClient {
  private fetchFn: FetchLike
  private creds: IntervalsCredentials
  constructor(creds: IntervalsCredentials, fetchFn?: FetchLike) {
    this.creds = creds
    this.fetchFn = fetchFn ?? ((...args) => fetch(...args))
  }

  private url(path: string) {
    const base = (this.creds.baseUrl || INTERVALS_DEFAULT_BASE).replace(/\/$/, '')
    return `${base}/api/v1/athlete/${encodeURIComponent(this.creds.athleteId.trim())}${path}`
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    validateCredentials(this.creds)
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new IntervalsError('offline', 'Hors ligne')
    }
    let res: Response
    try {
      res = await this.fetchFn(this.url(path), {
        method,
        headers: {
          Authorization: authHeader(this.creds.apiKey.trim()),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    } catch (e) {
      // fetch() rejette sans détail en cas de blocage CORS ou de coupure réseau.
      throw new IntervalsError('network-or-cors', String(e))
    }
    if (res.status === 401 || res.status === 403) throw new IntervalsError('auth', 'Accès refusé', res.status)
    if (res.status === 404) throw new IntervalsError('not-found', 'Introuvable', res.status)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new IntervalsError('http', text.slice(0, 300) || res.statusText, res.status)
    }
    const ct = res.headers.get('content-type') ?? ''
    return (ct.includes('application/json') ? await res.json() : await res.text()) as T
  }

  /** Infos de l'athlète : sert de test de connexion. */
  getAthlete() {
    return this.request<{ id: string; name?: string }>('GET', '')
  }

  /**
   * Crée ou met à jour des séances planifiées. Grâce à `upsert=true` et
   * `external_id`, renvoyer la même séance met à jour l'existante (pas de doublon).
   */
  upsertEvents(events: IntervalsEventInput[]) {
    return this.request<Array<{ id: number; external_id?: string }>>('POST', '/events/bulk?upsert=true', events)
  }

  /** Supprime des séances par identifiant externe. */
  deleteEventsByExternalId(externalIds: string[]) {
    return this.request<unknown>(
      'PUT',
      '/events/bulk-delete',
      externalIds.map((external_id) => ({ external_id })),
    )
  }

  listEvents(oldest: string, newest: string) {
    return this.request<Array<Record<string, unknown>>>('GET', `/events?oldest=${oldest}&newest=${newest}`)
  }

  listActivities(oldest: string, newest: string) {
    return this.request<Array<Record<string, unknown>>>('GET', `/activities?oldest=${oldest}&newest=${newest}`)
  }

  listWellness(oldest: string, newest: string) {
    return this.request<Array<Record<string, unknown>>>('GET', `/wellness?oldest=${oldest}&newest=${newest}`)
  }
}

/** « 2026-11-11 » → « 2026-11-11T00:00:00 » */
export function toStartDateLocal(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new IntervalsError('invalid-input', `Date invalide : ${isoDate}`)
  return `${isoDate}T00:00:00`
}
