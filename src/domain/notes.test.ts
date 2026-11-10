import { describe, expect, it } from 'vitest'
import { analyzeNote } from './notes'
import { avgSleep, bedtime } from './sleep'

describe('notes libres', () => {
  it('douleur et zone', () => {
    const i = analyzeNote({ date: '2026-12-10', text: 'Sortie ok mais un peu mal au genou droit en descente', at: '' })
    expect(i[0]).toMatchObject({ kind: 'douleur', zone: 'genou' })
    expect(i[0].excerpt).toBe('…un peu mal au genou droit en descente')
  })
  it('fatigue et bonnes sensations', () => {
    expect(analyzeNote({ date: '', text: 'Complètement crevé après le boulot', at: '' })[0].kind).toBe('fatigue')
    expect(analyzeNote({ date: '', text: 'Super sensations, très facile !', at: '' })[0].kind).toBe('positif')
  })
  it('rien de particulier', () => {
    expect(analyzeNote({ date: '', text: 'Couru avec Paul au parc', at: '' })).toEqual([])
  })
})

describe('sommeil', () => {
  it('heure de coucher', () => {
    expect(bedtime('07:00', false)).toBe('23:15')
    expect(bedtime('07:00', true)).toBe('22:45')
    expect(bedtime('06:00', true)).toBe('21:45')
  })
  it('moyenne seulement avec assez de nuits', () => {
    expect(avgSleep([7, 6, undefined])).toBeUndefined()
    expect(avgSleep([7, 6, 6.5, 6.5])).toBe(6.5)
  })
})
