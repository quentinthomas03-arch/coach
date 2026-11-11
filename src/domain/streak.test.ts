import { describe, expect, it } from 'vitest'
import type { PlannedSession } from '../data/types'
import { addDays } from './dates'
import { regularStreak } from './streak'

const s = (date: string, status: PlannedSession['status']): PlannedSession => ({ id: date + status + Math.random(), date, kind: 'endurance', title: '', durationMin: 30, reasons: [], status, externalId: '', sync: { status: 'sent' } })
const week = (monday: string, done: number, total = 3) => Array.from({ length: total }, (_, i) => s(addDays(monday, i * 2), i < done ? 'done' : 'missed'))

describe('série de semaines régulières', () => {
  it('compte les semaines validées consécutives', () => {
    const all = [...week('2026-11-16', 3), ...week('2026-11-23', 2), ...week('2026-11-30', 3)]
    expect(regularStreak(all, '2026-12-09')).toBe(3)
  })
  it('une semaine ratée casse la série', () => {
    const all = [...week('2026-11-16', 3), ...week('2026-11-23', 0), ...week('2026-11-30', 3)]
    expect(regularStreak(all, '2026-12-09')).toBe(1)
  })
})
