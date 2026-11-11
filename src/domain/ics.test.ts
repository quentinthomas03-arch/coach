import { describe, expect, it } from 'vitest'
import type { PlannedSession } from '../data/types'
import { buildIcs, DEFAULT_TIMES } from './ics'

const s = (over: Partial<PlannedSession>): PlannedSession => ({ id: 'a', date: '2026-11-12', kind: 'endurance', title: 'Footing facile', durationMin: 45, reasons: ['Construire la base, sans forcer.'], status: 'planned', externalId: 'coach-a', sync: { status: 'pending' }, ...over }) as unknown as PlannedSession

describe('agenda .ics', () => {
  const ics = buildIcs([s({}), s({ id: 'b', externalId: 'coach-b', date: '2026-11-15', title: 'Sortie longue; douce, facile', durationMin: 75 })], (d) => (d === '2026-11-15' ? 'matin' : 'soir'), { times: DEFAULT_TIMES, alarmMin: 60, now: new Date('2026-11-11T10:00:00Z') })
  it('événements avec heure du créneau, fin et alerte', () => {
    expect(ics).toContain('DTSTART:20261112T183000')
    expect(ics).toContain('DTEND:20261112T191500')
    expect(ics).toContain('DTSTART:20261115T090000')
    expect(ics).toContain('DTEND:20261115T101500')
    expect(ics).toContain('UID:coach-b@coach')
    expect(ics.match(/TRIGGER:-PT60M/g)).toHaveLength(2)
  })
  it('échappement et lignes de 75 octets au plus', () => {
    expect(ics).toContain('Sortie longue\; douce\\, facile')
    for (const l of ics.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })
})
