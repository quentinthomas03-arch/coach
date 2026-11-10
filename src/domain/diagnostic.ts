import { toIntervalsText, estimateDurationSec, type Workout } from './workout'
import { toStartDateLocal, type IntervalsEventInput } from '../integrations/intervals'

/**
 * Séances de test de la Phase 0 : elles servent à vérifier la chaîne
 * Appli → Intervals.icu → Garmin Connect → montre.
 * Identifiants externes fixes : renvoyer le test met à jour la même séance.
 */
export const TEST_RUN_EXTERNAL_ID = 'coach-test-course'
export const TEST_STRENGTH_EXTERNAL_ID = 'coach-test-renfo'

export const TEST_RUN_WORKOUT: Workout = {
  blocks: [
    { role: 'warmup', steps: [{ label: 'Marche active', durationSec: 300, target: { kind: 'hrZone', zone: 1 } }] },
    {
      role: 'main',
      repeat: 5,
      steps: [
        { label: 'Course tres facile', durationSec: 120, target: { kind: 'hrZone', zone: 2 } },
        { label: 'Marche', durationSec: 60, target: { kind: 'hrZone', zone: 1 } },
      ],
    },
    { role: 'cooldown', steps: [{ label: 'Marche', durationSec: 300, target: { kind: 'hrZone', zone: 1 } }] },
  ],
}

export const TEST_STRENGTH_TEXT = [
  'Renfo test (15 min) - les exercices et le chrono sont dans l’appli Coach.',
  '',
  '1. Squat au poids du corps - 3 x 10, repos 45 s',
  '2. Pont fessier - 3 x 12, repos 45 s',
  '3. Montées de mollets sur une marche - 3 x 12, repos 45 s',
  '4. Gainage ventral sur les genoux - 3 x 20 s, repos 30 s',
].join('\n')

export function testRunEvent(date: string): IntervalsEventInput {
  return {
    external_id: TEST_RUN_EXTERNAL_ID,
    category: 'WORKOUT',
    start_date_local: toStartDateLocal(date),
    type: 'Run',
    name: 'Coach - test course',
    description: toIntervalsText(TEST_RUN_WORKOUT),
    moving_time: estimateDurationSec(TEST_RUN_WORKOUT),
  }
}

export function testStrengthEvent(date: string): IntervalsEventInput {
  return {
    external_id: TEST_STRENGTH_EXTERNAL_ID,
    category: 'WORKOUT',
    start_date_local: toStartDateLocal(date),
    type: 'WeightTraining',
    name: 'Coach - test renfo',
    description: TEST_STRENGTH_TEXT,
    moving_time: 15 * 60,
  }
}
