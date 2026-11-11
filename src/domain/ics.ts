import type { ISODate, PlannedSession } from '../data/types'
import { describeWorkout } from './sessionPaces'

/**
 * AGENDA iPHONE : fichier .ics des séances à venir, avec une alerte.
 * Identifiants stables (UID = identifiant de la séance) : l'agenda reconnaît les séances déjà ajoutées.
 */

export type Slot = 'matin' | 'midi' | 'soir'
export interface IcsOptions {
  /** Heure de début par créneau, « HH:MM ». */
  times: Record<Slot, string>
  /** Alerte en minutes avant la séance. */
  alarmMin: number
  /** Horodatage de génération (DTSTAMP). */
  now: Date
}

export const DEFAULT_TIMES: Record<Slot, string> = { matin: '09:00', midi: '12:15', soir: '18:30' }

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Plie les lignes à 75 octets (norme iCalendar). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let cur = ''
  let len = 0
  for (const ch of line) {
    const l = new TextEncoder().encode(ch).length
    if (len + l > (parts.length ? 74 : 75)) {
      parts.push(cur)
      cur = ''
      len = 0
    }
    cur += ch
    len += l
  }
  parts.push(cur)
  return parts.join('\r\n ')
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
const local = (date: ISODate, hhmm: string) => `${date.replace(/-/g, '')}T${hhmm.replace(':', '')}00`

function addMinutes(date: ISODate, hhmm: string, min: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), h, m + min))
  return d.toISOString().slice(0, 16).replace(/[-:]/g, '') + '00'
}

export function sessionDescription(s: PlannedSession): string {
  const lines: string[] = []
  if (s.workout) {
    for (const l of describeWorkout(s.workout)) lines.push(`${l.repeat ? `${l.repeat} × ` : ''}${l.text}${l.target ? ` (${l.target})` : ''}`)
  } else if (s.strength) {
    for (const i of s.strength.items) lines.push(`${i.name} : ${i.sets} × ${i.reps ? `${i.reps}` : `${i.sec} s`}`)
  }
  if (s.reasons[0]) lines.push('', `Pourquoi : ${s.reasons[0]}`)
  lines.push('', 'Détails et chrono dans l’appli Coach.')
  return lines.join('\n')
}

export function buildIcs(sessions: PlannedSession[], slotOf: (date: ISODate) => Slot, o: IcsOptions): string {
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Coach//Seances//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Coach']
  for (const s of sessions) {
    const start = o.times[slotOf(s.date)]
    out.push(
      'BEGIN:VEVENT',
      `UID:${s.externalId}@coach`,
      `DTSTAMP:${stamp(o.now)}`,
      `DTSTART:${local(s.date, start)}`,
      `DTEND:${addMinutes(s.date, start, s.durationMin)}`,
      `SUMMARY:${esc(`${s.kind === 'renfo' ? '💪' : '🏃'} ${s.title} · ${s.durationMin} min`)}`,
      `DESCRIPTION:${esc(sessionDescription(s))}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(s.title)}`,
      `TRIGGER:-PT${o.alarmMin}M`,
      'END:VALARM',
      'END:VEVENT',
    )
  }
  out.push('END:VCALENDAR')
  return out.map(fold).join('\r\n') + '\r\n'
}
