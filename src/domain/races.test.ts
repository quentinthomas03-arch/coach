import { describe, expect, it } from 'vitest'
import { estimateFitness } from './fitness'
import { DISTANCES } from './paces'
import { parseArea, raceSearchLinks, raceToGoal, realisticWindows } from './races'

const fitness = estimateFitness([{ id: 's', date: '2026-03-15', distanceM: DISTANCES.semi, timeSec: 6000, source: 'record' }], '2026-11-11')

describe('courses', () => {
  it('fenêtres réalistes : plus la distance est longue, plus c’est tard', () => {
    const w = realisticWindows('2026-11-11', fitness, 60, false, 4)
    expect(w.map((x) => x.distance)).toEqual(['5k', '10k', 'semi', 'marathon'])
    for (let i = 1; i < w.length; i++) expect(w[i].earliest >= w[i - 1].earliest).toBe(true)
    expect(w[0].timeSec).toBeGreaterThan(0)
    expect(w[3].earliest > '2027-03-01').toBe(true)
  })
  it('lecture de l’API adresse', () => {
    expect(parseArea({ features: [{ properties: { city: 'Nantes', postcode: '44000', context: '44, Loire-Atlantique, Pays de la Loire' } }] })).toEqual({ city: 'Nantes', postcode: '44000', departmentCode: '44', department: 'Loire-Atlantique' })
    expect(parseArea({})).toBeUndefined()
  })
  it('recherches par département', () => {
    const l = raceSearchLinks({ department: 'Loire-Atlantique' }, '10 km', 2027)
    expect(l[0].url).toContain('calendrier%20course%2010%20km%20Loire-Atlantique%202027')
  })
  it('course envisagée → objectif', () => {
    expect(raceToGoal({ id: 'r', name: '10 km de Nantes', date: '2027-04-11', type: 'route', distance: '10k' })).toMatchObject({ type: 'route', distance: '10k', date: '2027-04-11', name: '10 km de Nantes' })
  })
})
