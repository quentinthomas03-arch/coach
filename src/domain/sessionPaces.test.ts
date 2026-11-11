import { describe, expect, it } from 'vitest'
import { estimateFitness } from './fitness'
import { DISTANCES } from './paces'
import { repriseWorkout } from './reprise'
import { withRoutines } from './routines'
import { applyPaces, describeWorkout, sessionPaces } from './sessionPaces'
import { toIntervalsText } from './workout'

const fitness = estimateFitness([{ id: 's', date: '2026-03-15', distanceM: DISTANCES.semi, timeSec: 6000, source: 'record' }], '2026-11-11')

describe('allures par étape (façon Kiprun)', () => {
  it('reprise : course facile plus lente que l’allure facile d’avant, marche en marche active', () => {
    const sp = sessionPaces(fitness, true)!
    expect(sp.easy[0]).toBeGreaterThan(380) // plus lent que 6:20/km
    expect(sp.easy[1] - sp.easy[0]).toBeGreaterThanOrEqual(30) // fourchette confortable
    expect(sp.walk).toEqual([540, 720])
  })
  it('chaque étape de la séance a sa fourchette sur la montre', () => {
    const w = withRoutines(applyPaces(repriseWorkout(4), sessionPaces(fitness, true)))
    const txt = toIntervalsText(w)
    expect(txt).toMatch(/- Marche active 5m 9:00-12:00\/km Pace/)
    expect(txt).toMatch(/4x\n- Course facile 5m \d:\d\d-\d:\d\d\/km Pace\n- Marche 1m30s 9:00-12:00\/km Pace/)
    expect(txt).toMatch(/Mobilité et gammes \(guidé dans l’appli\) 4m\n/)
  })
  it('déroulé lisible dans l’appli', () => {
    const lines = describeWorkout(applyPaces(repriseWorkout(4), sessionPaces(fitness, true)))
    expect(lines[0]).toMatchObject({ section: 'Échauffement', text: '5 min marche active', target: '9:00–12:00/km' })
    expect(lines[1]).toMatchObject({ section: 'Séance', repeat: 4 })
    expect(lines[1].text).toBe('5 min course facile + 1 min 30 marche')
  })
  it('forme inconnue : zones cardio conservées', () => {
    expect(sessionPaces(estimateFitness([], '2026-11-11'), true)).toBeUndefined()
    expect(toIntervalsText(applyPaces(repriseWorkout(2), undefined))).toMatch(/Z2 HR/)
  })
})
