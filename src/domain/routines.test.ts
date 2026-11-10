import { describe, expect, it } from 'vitest'
import { repriseWorkout } from './reprise'
import { routineFor, routineSec, STRETCH_LABEL, WARMUP_LABEL, withRoutines } from './routines'
import { estimateDurationSec, toIntervalsText } from './workout'

describe('échauffement et étirements', () => {
  it('routines de base : ~4 et ~5 minutes', () => {
    expect(Math.round(routineSec(routineFor('echauffement')) / 60)).toBe(4)
    expect(Math.round(routineSec(routineFor('etirements')) / 60)).toBe(5)
  })
  it('zones fragiles : exercices ciblés ajoutés, sans doublon', () => {
    const r = routineFor('echauffement', ['achille', 'mollet'])
    expect(r.items.filter((i) => i.name === 'Montées sur pointes')).toHaveLength(1)
    expect(routineFor('etirements', ['dos']).items.map((i) => i.name)).toContain('Posture de l’enfant')
  })
  it('chaque séance commence par l’échauffement et finit par les étirements (sur la montre aussi)', () => {
    const w = withRoutines(repriseWorkout(2))
    const txt = toIntervalsText(w)
    expect(txt.startsWith(`Warmup\n- ${WARMUP_LABEL} 4m`)).toBe(true)
    expect(txt.trim().endsWith(`- ${STRETCH_LABEL} 5m`)).toBe(true)
    expect(estimateDurationSec(w) - estimateDurationSec(repriseWorkout(2))).toBe(9 * 60)
  })
  it('idempotent', () => {
    const w = withRoutines(repriseWorkout(2))
    expect(withRoutines(w)).toEqual(w)
  })
})
