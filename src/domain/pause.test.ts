import { describe, expect, it } from 'vitest'
import { isPaused, resumeAfterPause } from './pause'

describe('pause', () => {
  it('période de pause', () => {
    const p = { from: '2026-12-20', until: '2026-12-27', reason: 'vacances' as const }
    expect(isPaused(p, '2026-12-19')).toBe(false)
    expect(isPaused(p, '2026-12-20')).toBe(true)
    expect(isPaused(p, '2026-12-28')).toBe(false)
    expect(isPaused({ from: '2026-12-20', reason: 'maladie' }, '2027-03-01')).toBe(true)
  })
  it('reprise : un niveau par semaine, un de plus après maladie', () => {
    expect(resumeAfterPause({ mode: 'reprise', repriseLevel: 6 }, { from: '2026-12-01', reason: 'vacances' }, '2026-12-15', false).repriseLevel).toBe(4)
    expect(resumeAfterPause({ mode: 'reprise', repriseLevel: 6 }, { from: '2026-12-01', reason: 'maladie' }, '2026-12-15', false).repriseLevel).toBe(3)
  })
  it('forme : volume réduit, retour en reprise après 4 semaines', () => {
    const d = resumeAfterPause({ mode: 'forme', repriseLevel: 9, formeBaseMinutes: 200 }, { from: '2026-12-01', reason: 'vacances' }, '2026-12-15', true)
    expect(d.formeBaseMinutes).toBe(172)
    expect(d.messages.join(' ')).toMatch(/refais le bilan/)
    expect(resumeAfterPause({ mode: 'forme', repriseLevel: 9, formeBaseMinutes: 200 }, { from: '2026-10-01', reason: 'blessure' }, '2026-11-15', false)).toMatchObject({ mode: 'reprise', repriseLevel: 5 })
  })
  it('pause de quelques jours : rien ne change', () => {
    expect(resumeAfterPause({ mode: 'forme', repriseLevel: 9, formeBaseMinutes: 200 }, { from: '2026-12-10', reason: 'vacances' }, '2026-12-14', false).formeBaseMinutes).toBe(200)
  })
})
