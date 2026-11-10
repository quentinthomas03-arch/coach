import { describe, expect, it, vi } from 'vitest'
import { IntervalsClient, IntervalsError, authHeader, toStartDateLocal } from './intervals'

const creds = { athleteId: 'i12345', apiKey: 'abcdefghijklmnop' }

function mockFetch(status: number, body: unknown = [], contentType = 'application/json') {
  return vi.fn(async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': contentType } }),
  )
}

describe('IntervalsClient', () => {
  it('envoie les séances en upsert avec authentification Basic API_KEY', async () => {
    const f = mockFetch(200, [{ id: 1, external_id: 'coach-x' }])
    const c = new IntervalsClient(creds, f as unknown as typeof fetch)
    await c.upsertEvents([
      { external_id: 'coach-x', category: 'WORKOUT', start_date_local: '2026-11-11T00:00:00', type: 'Run', name: 'Test' },
    ])
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://intervals.icu/api/v1/athlete/i12345/events/bulk?upsert=true')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe(authHeader('abcdefghijklmnop'))
    expect(atob(authHeader('k123').slice(6))).toBe('API_KEY:k123')
    expect(JSON.parse(init.body as string)[0].external_id).toBe('coach-x')
  })

  it('utilise le relais si configuré', async () => {
    const f = mockFetch(200, { id: 'i12345' })
    await new IntervalsClient({ ...creds, baseUrl: 'https://relais.example.workers.dev/' }, f as unknown as typeof fetch).getAthlete()
    expect((f.mock.calls[0] as unknown[])[0]).toBe('https://relais.example.workers.dev/api/v1/athlete/i12345')
  })

  it('classe les erreurs', async () => {
    const cors = vi.fn(async () => {
      throw new TypeError('Load failed')
    })
    await expect(new IntervalsClient(creds, cors as unknown as typeof fetch).getAthlete()).rejects.toMatchObject({
      kind: 'network-or-cors',
    })
    await expect(new IntervalsClient(creds, mockFetch(401) as unknown as typeof fetch).getAthlete()).rejects.toMatchObject({
      kind: 'auth',
    })
    await expect(new IntervalsClient(creds, mockFetch(500, 'boom', 'text/plain') as unknown as typeof fetch).getAthlete()).rejects.toMatchObject(
      { kind: 'http', status: 500 },
    )
  })

  it('valide les identifiants avant tout appel', async () => {
    const f = mockFetch(200)
    await expect(new IntervalsClient({ athleteId: 'bob', apiKey: 'abcdefghijkl' }, f as unknown as typeof fetch).getAthlete()).rejects.toBeInstanceOf(
      IntervalsError,
    )
    expect(f).not.toHaveBeenCalled()
  })

  it('formate les dates', () => {
    expect(toStartDateLocal('2026-11-11')).toBe('2026-11-11T00:00:00')
    expect(() => toStartDateLocal('11/11/2026')).toThrow()
  })
})
