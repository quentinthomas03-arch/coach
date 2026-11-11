import { describe, expect, it } from 'vitest'
import { estimateFitness } from './fitness'
import { DISTANCES } from './paces'
import { repriseWorkout } from './reprise'
import { applyPaces, sessionPaces } from './sessionPaces'
import { adjustPaces, applyPrefs, offsetAfterFeedback } from './sessionPrefs'
import { toIntervalsText } from './workout'

const sp = sessionPaces(estimateFitness([{ id: 's', date: '2026-03-15', distanceM: DISTANCES.semi, timeSec: 6000, source: 'record' }], '2026-11-11'), true)!
const build = (prefs: Parameters<typeof applyPrefs>[1]) => toIntervalsText(applyPaces(applyPrefs(repriseWorkout(4), prefs, adjustPaces(sp, prefs)), adjustPaces(sp, prefs)))

describe('mes préférences de séance', () => {
  it('par défaut : marche active et récup en marchant', () => {
    expect(build({ walk: true, easyOffset: 0 })).toMatch(/Marche active 5m/)
  })
  it('« je ne marche pas » + échauffement à 6:30 : footing, récup en trottinant, plus aucune marche', () => {
    const txt = build({ walk: false, warmupPace: 390, easyOffset: 0 })
    expect(txt).not.toMatch(/Marche/i)
    expect(txt).toMatch(/- Footing d’échauffement 5m 6:20-6:50\/km Pace/)
    expect(txt).toMatch(/- Récup en trottinant 1m30s \d:\d\d-\d:\d\d\/km Pace/)
    expect(txt).toMatch(/- Retour au calme en trottinant 5m/)
  })
  it('allure facile plus lente de 10 s/km', () => {
    const a = adjustPaces(sp, { walk: true, easyOffset: 10 })!
    expect(a.easy[0]).toBe(sp.easy[0] + 10)
    expect(a.easy[1]).toBe(sp.easy[1] + 10)
  })
  it('retours « trop lent / trop rapide » : ±10 s/km, borné', () => {
    expect(offsetAfterFeedback(0, 'trop-lent')).toBe(-10)
    expect(offsetAfterFeedback(0, 'trop-rapide')).toBe(10)
    expect(offsetAfterFeedback(60, 'trop-rapide')).toBe(60)
    expect(offsetAfterFeedback(20, 'bien')).toBe(20)
  })
})
