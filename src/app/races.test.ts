import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { addRace, assessRace, getRaces, getWindows, removeRace } from './races'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('courses envisagées', () => {
  it('ajout, tri, bilan, suppression', async () => {
    const b = await addRace({ name: 'Semi B', date: '2027-10-10', type: 'route', distance: 'semi' })
    await addRace({ name: '10 km A', date: '2027-04-11', type: 'route', distance: '10k' })
    expect((await getRaces()).map((r) => r.name)).toEqual(['10 km A', 'Semi B'])
    const a = await assessRace(b, '2026-11-11')
    expect(a.lines.length).toBeGreaterThan(0)
    await removeRace(b.id)
    expect((await getRaces()).length).toBe(1)
  })
  it('fenêtres sans aucune donnée', async () => {
    const w = await getWindows('2026-11-11')
    expect(w).toHaveLength(4)
    expect(w[0].timeSec).toBeUndefined()
  })
})
