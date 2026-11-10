import { describe, expect, it } from 'vitest'
import { estimateDurationSec, formatDistance, formatDuration, formatPace, toIntervalsText, type Workout } from './workout'

describe('formats Intervals.icu', () => {
  it('durées', () => {
    expect(formatDuration(600)).toBe('10m')
    expect(formatDuration(30)).toBe('30s')
    expect(formatDuration(90)).toBe('1m30s')
    expect(formatDuration(3600)).toBe('1h')
    expect(formatDuration(4500)).toBe('75m')
    expect(() => formatDuration(0)).toThrow()
  })
  it('distances : « m » est réservé aux minutes', () => {
    expect(formatDistance(400)).toBe('400mtr')
    expect(formatDistance(1000)).toBe('1km')
    expect(formatDistance(1500)).toBe('1.5km')
  })
  it('allures', () => {
    expect(formatPace(330)).toBe('5:30')
    expect(formatPace(305)).toBe('5:05')
  })
})

describe('toIntervalsText', () => {
  it('séance de marche-course de reprise', () => {
    const w: Workout = {
      blocks: [
        { role: 'warmup', steps: [{ label: 'Marche active', durationSec: 300, target: { kind: 'hrZone', zone: 1 } }] },
        {
          role: 'main',
          repeat: 6,
          steps: [
            { label: 'Course facile', durationSec: 120, target: { kind: 'hrZone', zone: 2 } },
            { label: 'Marche', durationSec: 60, target: { kind: 'hrZone', zone: 1 } },
          ],
        },
        { role: 'cooldown', steps: [{ label: 'Marche', durationSec: 300 }] },
      ],
    }
    expect(toIntervalsText(w)).toBe(
      [
        'Warmup',
        '- Marche active 5m Z1 HR',
        '',
        '6x',
        '- Course facile 2m Z2 HR',
        '- Marche 1m Z1 HR',
        '',
        'Cooldown',
        '- Marche 5m',
      ].join('\n'),
    )
    expect(estimateDurationSec(w)).toBe(300 + 6 * 180 + 300)
  })

  it('allure absolue et distance', () => {
    const w: Workout = {
      blocks: [{ role: 'main', repeat: 5, steps: [{ distanceM: 1000, target: { kind: 'pace', fastSecPerKm: 280, slowSecPerKm: 290 } }] }],
    }
    expect(toIntervalsText(w)).toBe('5x\n- 1km 4:40-4:50/km Pace')
  })

  it('nettoie les libellés dangereux', () => {
    const w: Workout = { blocks: [{ role: 'main', steps: [{ label: '- a\nb', durationSec: 60 }] }] }
    expect(toIntervalsText(w)).toBe('Main Set\n- a b 1m')
  })

  it('refuse les séances invalides', () => {
    expect(() => toIntervalsText({ blocks: [] })).toThrow()
    expect(() => toIntervalsText({ blocks: [{ role: 'main', steps: [{}] }] })).toThrow()
    expect(() =>
      toIntervalsText({ blocks: [{ role: 'main', steps: [{ durationSec: 60, target: { kind: 'pace', fastSecPerKm: 300, slowSecPerKm: 280 } }] }] }),
    ).toThrow()
  })
})
