import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { calendarFile } from './calendar'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('agenda', () => {
  it('séances prévues des 14 jours, créneau de la semaine type', async () => {
    const base = { kind: 'endurance', title: 'Footing', durationMin: 40, reasons: [], sync: { status: 'pending' } }
    await db.sessions.bulkPut([
      { ...base, id: '1', date: '2026-11-12', status: 'planned', externalId: 'c1' },
      { ...base, id: '2', date: '2026-11-15', status: 'planned', externalId: 'c2' },
      { ...base, id: '3', date: '2026-11-13', status: 'done', externalId: 'c3' },
      { ...base, id: '4', date: '2026-12-15', status: 'planned', externalId: 'c4' },
    ] as never)
    const { ics, count } = await calendarFile('2026-11-11')
    expect(count).toBe(2)
    expect(ics).toContain('DTSTART:20261112T183000')
    expect(ics).toContain('DTSTART:20261115T090000')
  })
})
