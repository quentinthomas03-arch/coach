import { describe, expect, it } from 'vitest'
import type { MorningCheckin, PlannedSession } from '../data/types'
import { addDays } from './dates'
import { coachMessages, type CoachContext } from './coach'

const today = '2026-11-20'
const sess = (daysAgo: number, kind: PlannedSession['kind'], status: PlannedSession['status']): PlannedSession => ({
  id: `${kind}-${daysAgo}`,
  date: addDays(today, -daysAgo),
  kind,
  title: '',
  durationMin: 30,
  reasons: [],
  status,
  externalId: '',
  sync: { status: 'sent' },
})
const check = (daysAgo: number, extra: Partial<MorningCheckin> = {}): MorningCheckin => ({
  date: addDays(today, -daysAgo), physique: 3, moral: 3, travail: 3, viePerso: 3, at: '', ...extra,
})
const ctx = (over: Partial<CoachContext>): CoachContext => ({ today, tone: 'direct', sessions: [], checkins: [check(0)], ...over })
const rules = (c: CoachContext) => coachMessages(c).map((m) => m.rule)

describe('voix du coach', () => {
  it('recadre après 2 sorties manquées', () => {
    expect(rules(ctx({ sessions: [sess(2, 'marche-course', 'missed'), sess(4, 'endurance', 'missed'), sess(6, 'endurance', 'done')] }))).toContain('sorties-manquees')
  })
  it('félicite une semaine complète', () => {
    const m = coachMessages(ctx({ sessions: [sess(1, 'endurance', 'done'), sess(3, 'renfo', 'done'), sess(5, 'endurance', 'done')] }))
    expect(m.map((x) => x.rule)).toContain('semaine-complete')
    expect(m.find((x) => x.rule === 'semaine-complete')!.text).toContain('3/3')
  })
  it('signale le renfo délaissé', () => {
    expect(rules(ctx({ sessions: [sess(3, 'renfo', 'missed'), sess(10, 'renfo', 'missed')] }))).toContain('renfo-delaisse')
  })
  it('alerte en cas de douleur persistante, en premier', () => {
    const c = ctx({
      checkins: [check(1, { douleur: { zone: 'genou', intensite: 1 } }), check(2, { douleur: { zone: 'genou', intensite: 2 } }), check(3, { douleur: { zone: 'genou', intensite: 1 } }), check(0)],
      sessions: [sess(2, 'endurance', 'missed'), sess(4, 'endurance', 'missed')],
    })
    const m = coachMessages(c)
    expect(m[0]).toMatchObject({ rule: 'douleur-persistante', kind: 'alerte' })
    expect(m[0].text).toMatch(/médecin ou kiné/)
  })
  it('remarque les soirées arrosées répétées', () => {
    expect(rules(ctx({ checkins: [check(0), check(1, { alcool: '3+' }), check(3, { alcool: '3+' })] }))).toContain('alcool')
  })
  it('relance si pas de check depuis 3 jours', () => {
    expect(rules(ctx({ checkins: [check(3)] }))).toContain('check-oublie')
    expect(rules(ctx({ checkins: [check(1)] }))).not.toContain('check-oublie')
    // Premier jour : pas de reproche.
    expect(rules(ctx({ checkins: [] }))).not.toContain('check-oublie')
  })
  it('le ton change le texte, pas la règle', () => {
    const base = { sessions: [sess(2, 'endurance', 'missed'), sess(4, 'endurance', 'missed')] }
    const a = coachMessages(ctx({ ...base, tone: 'bienveillant' }))[0]
    const b = coachMessages(ctx({ ...base, tone: 'cash' }))[0]
    expect(a.rule).toBe(b.rule)
    expect(a.text).not.toBe(b.text)
  })
  it('tabac : rappel avant le jour J et paliers', () => {
    expect(rules(ctx({ tabac: { phase: 'preparation', daysUntilQuit: 10, reached: [] } }))).toContain('tabac-approche')
    expect(rules(ctx({ tabac: { phase: 'preparation', daysUntilQuit: 40, reached: [] } }))).not.toContain('tabac-approche')
    const m = coachMessages(ctx({ tabac: { phase: 'sans-tabac', daysSmokeFree: 7, cigarettesAvoided: 70, moneySaved: 43.75, relapsed: false, reached: [] } }))
    expect(m.find((x) => x.rule === 'tabac-palier')!.text).toMatch(/7 jours/)
  })
  it('félicite la fin de la reprise', () => {
    expect(rules(ctx({ levelDecision: { level: 9, change: 'stable', reason: '', completed: true } }))).toContain('reprise-terminee')
  })
  it('relaie les garde-fous de charge en alerte', () => {
    const m = coachMessages(ctx({ loadAlerts: [{ rule: 'volume', text: 'Volume +30 %.' }] }))
    expect(m[0]).toMatchObject({ rule: 'charge-volume', kind: 'alerte', text: 'Stop, tu montes trop vite. Volume +30 %.' })
  })
  it('eau insuffisante la veille', () => {
    expect(rules(ctx({ waterYesterday: { ml: 750, target: 2250 } }))).toContain('eau')
    expect(rules(ctx({ waterYesterday: { ml: 1750, target: 2250 } }))).not.toContain('eau')
  })
  it('douleur répétée au même endroit : propose une zone fragile (sauf si déjà déclarée)', () => {
    const checkins = [check(0), check(2, { douleur: { zone: 'Genou', intensite: 1 } }), check(5, { douleur: { zone: 'Genou', intensite: 1 } })]
    const m = coachMessages(ctx({ checkins }))
    expect(m.find((x) => x.rule === 'zone-genou')!.action).toMatchObject({ type: 'add-zone', zone: 'genou' })
    expect(rules(ctx({ checkins, fragileZones: ['genou'] }))).not.toContain('zone-genou')
  })
  it('en pause : aucun reproche', () => {
    const base = { sessions: [sess(2, 'endurance', 'missed'), sess(4, 'endurance', 'missed')] }
    expect(rules(ctx({ ...base, paused: true }))).not.toContain('sorties-manquees')
    expect(rules(ctx({ ...base, notice: ['Bon retour !'] }))).toContain('notice')
  })
  it('surcharge prolongée', () => {
    expect(rules(ctx({ overload: { active: true, reasons: ['charge de travail très élevée (1,8/5 en moyenne)'] } }))).toContain('surcharge')
  })
  it('notes : douleur relevée avec action, bonnes sensations saluées', () => {
    const m = coachMessages(ctx({ noteInsights: [{ date: '2026-11-18', kind: 'douleur', zone: 'genou', excerpt: 'mal au genou' }] }))
    expect(m.find((x) => x.rule === 'note-douleur')!.action?.zone).toBe('genou')
    expect(rules(ctx({ noteInsights: [{ date: '2026-11-18', kind: 'positif', excerpt: 'super sensations' }] }))).toContain('note-positif')
  })
  it('sommeil court', () => {
    expect(rules(ctx({ sleepAvg: 6.1 }))).toContain('sommeil')
    expect(rules(ctx({ sleepAvg: 7.2 }))).not.toContain('sommeil')
  })
  it('rien de spécial = pas de bruit', () => {
    expect(coachMessages(ctx({}))).toEqual([])
  })
})
