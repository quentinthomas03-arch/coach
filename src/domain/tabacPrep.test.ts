import { describe, expect, it } from 'vitest'
import { cravingStats, prepStep, reductionTarget, tabacStatus } from './tabac'

const s = { quitDate: '2027-01-01', cigsPerDayBefore: 12, packPrice: 12.5, cigsPerPack: 20, reasons: [] }

describe('préparation à l’arrêt', () => {
  it('étape de la semaine', () => {
    expect(prepStep(51)).toBeUndefined()
    expect(prepStep(49)?.weeksBefore).toBe(7)
    expect(prepStep(7)?.weeksBefore).toBe(1)
    expect(prepStep(1)?.title).toBe('Préparer le jour J')
  })
  it('réduction progressive jusqu’à 50 %', () => {
    expect(reductionTarget(12, 40)).toBeUndefined()
    expect(reductionTarget(12, 35)).toBe(12)
    expect(reductionTarget(12, 21)).toBe(9)
    expect(reductionTarget(12, 5)).toBe(6)
  })
  it('statut de préparation', () => {
    const st = tabacStatus(s, [], '2026-12-01')
    expect(st.prep?.weeksBefore).toBe(5)
    expect(st.target).toBe(11)
  })
  it('statistiques des envies', () => {
    const at = (d: string, h: number) => new Date(`${d}T${String(h).padStart(2, '0')}:10:00`).toISOString()
    const logs = [
      { at: at('2027-01-05', 13), resisted: true, trigger: 'repas' },
      { at: at('2027-01-06', 13), resisted: true, trigger: 'repas' },
      { at: at('2027-01-07', 9), resisted: false, trigger: 'cafe' },
      { at: at('2026-12-30', 13), resisted: true },
    ]
    const c = cravingStats(logs, '2027-01-07')
    expect(c).toMatchObject({ last7: 3, resisted7: 2, prev7: 1, peakHour: 13, topTrigger: 'repas', total: 4, totalResisted: 3 })
  })
})
