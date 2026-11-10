import { describe, expect, it } from 'vitest'
import { daysBetween } from './dates'
import { tabacStatus, yearlyCost, type TabacSettings } from './tabac'

const s: TabacSettings = { quitDate: '2027-01-01', cigsPerDayBefore: 10, packPrice: 12.5, cigsPerPack: 20, reasons: ['Courir sans être essoufflé'] }

describe('tabac', () => {
  it('jours entre deux dates', () => {
    expect(daysBetween('2026-11-10', '2027-01-01')).toBe(52)
  })
  it('préparation : compte à rebours', () => {
    expect(tabacStatus(s, [], '2026-11-10')).toMatchObject({ phase: 'preparation', daysUntilQuit: 52 })
  })
  it('jour J : 0 jour, premier bénéfice', () => {
    const st = tabacStatus(s, [], '2027-01-01')
    expect(st).toMatchObject({ phase: 'sans-tabac', daysSmokeFree: 0, cigarettesAvoided: 0, relapsed: false })
    expect(st.reached[0].label).toBe('20 minutes')
  })
  it('après 10 jours : cigarettes évitées, argent, prochaine étape', () => {
    const st = tabacStatus(s, [], '2027-01-11')
    expect(st.daysSmokeFree).toBe(10)
    expect(st.cigarettesAvoided).toBe(100)
    expect(st.moneySaved).toBe(62.5)
    expect(st.next).toMatchObject({ afterDays: 14, inDays: 4 })
  })
  it('une rechute redémarre la série sans effacer le chemin parcouru', () => {
    const st = tabacStatus(s, [{ date: '2027-01-05', count: 3 }], '2027-01-11')
    expect(st.relapsed).toBe(true)
    expect(st.smokeFreeSince).toBe('2027-01-06')
    expect(st.daysSmokeFree).toBe(5)
    expect(st.cigarettesAvoided).toBe(97)
  })
  it('les cigarettes avant la date d’arrêt ne comptent pas comme rechute', () => {
    expect(tabacStatus(s, [{ date: '2026-12-31', count: 8 }], '2027-01-03').relapsed).toBe(false)
  })
  it('coût annuel', () => {
    expect(yearlyCost(s)).toBe(2281)
  })
})
