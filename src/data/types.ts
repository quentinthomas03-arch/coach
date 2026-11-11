/**
 * Types des données stockées sur le téléphone (IndexedDB).
 * Toutes les dates « jour » sont des chaînes ISO locales AAAA-MM-JJ.
 */

export type ISODate = string // '2026-11-10'
export type ISODateTime = string // '2026-11-10T07:30:00.000Z'

export type Sex = 'homme' | 'femme'

export interface Profile {
  id: 'me'
  sex: Sex
  birthYear: number
  heightCm?: number
  weightKg: number
  hrMax?: number
  hrRest?: number
  /** Zones fragiles ou antécédents, texte libre court. */
  injuries: string[]
  /** Aliments non aimés (servent aux repères nutrition). */
  foodDislikes: string[]
  updatedAt: ISODateTime
}

export type EquipmentId =
  | 'tapis'
  | 'kettlebell'
  | 'elastiques'
  | 'roue-abdos'
  | 'escalier'
  | 'mur'
  | 'banc'
  | 'barre-traction'

export interface Equipment {
  id: EquipmentId
  available: boolean
  /** Ex. poids de la kettlebell en kg. */
  detail?: string
}

export interface DayAvailability {
  /** 0 = lundi … 6 = dimanche */
  weekday: number
  available: boolean
  maxMinutes: number
  /** 'matin' | 'midi' | 'soir' — sert aux repères nutrition. */
  slot?: 'matin' | 'midi' | 'soir'
}

export interface WeekAvailability {
  /** Lundi de la semaine concernée, ou 'template' pour la semaine type. */
  weekStart: ISODate | 'template'
  days: DayAvailability[]
  updatedAt: ISODateTime
}

export type SessionKind =
  | 'endurance'
  | 'marche-course'
  | 'seuil'
  | 'fractionne'
  | 'sortie-longue'
  | 'cotes'
  | 'recuperation'
  | 'test'
  | 'renfo'
  | 'repos'

import type { Workout } from '../domain/workout'
import type { StrengthSession } from '../domain/strength'

export type SessionStatus = 'planned' | 'done' | 'missed' | 'moved' | 'skipped'
export type SyncStatus = 'not-sent' | 'sent' | 'error' | 'outdated'

export interface PlannedSession {
  id: string
  date: ISODate
  kind: SessionKind
  title: string
  /** Durée prévue en minutes. */
  durationMin: number
  /** Texte structuré Intervals.icu (course) ou liste d'exercices (renfo). */
  workoutText?: string
  /** Raisons lisibles du choix de cette séance (« pourquoi aujourd'hui »). */
  reasons: string[]
  status: SessionStatus
  /** Identifiant stable envoyé à Intervals.icu (mise à jour sans doublon). */
  externalId: string
  sync: { status: SyncStatus; at?: ISODateTime; error?: string; intervalsEventId?: number }
  planVersionId?: number
  /** Séance clé (sortie longue, qualité) : pas de renfo la veille. */
  key?: boolean
  /** Verrouillée par moi : le moteur ne la modifie et ne la déplace jamais. */
  locked?: boolean
  /** Qui a créé ou modifié la séance en dernier. */
  origin?: 'moteur' | 'moi'
  workout?: Workout
  strength?: StrengthSession
}

export interface Activity {
  /** Identifiant Intervals.icu de l'activité. */
  id: string
  date: ISODate
  type: string
  durationSec: number
  distanceM?: number
  elevationGainM?: number
  avgHr?: number
  load?: number
  rpe?: number
  matchedSessionId?: string
  name?: string
  /** Calories brutes mesurées par la montre. */
  calories?: number
  raw?: unknown
}

export interface MorningCheckin {
  date: ISODate
  /** 1 (très mauvais) à 5 (excellent) */
  physique: number
  moral: number
  /** 1 (très chargé) à 5 (léger) */
  travail: number
  viePerso: number
  /** intensite : 1 = gêne légère, 2 = douleur modérée, 3 = douleur forte */
  douleur?: { zone: string; intensite: number }
  /** La veille au soir. */
  sortie?: boolean
  alcool?: 'aucun' | '1-2' | '3+'
  /** Cigarettes fumées la veille (module tabac, facultatif). */
  cigarettes?: number
  /** Eau bue la veille (estimation en 1 tap). */
  eauHier?: WaterEstimate
  note?: string
  at: ISODateTime
}

export type WaterEstimate = 'moins-1' | '1-1.5' | '1.5-2' | 'plus-2'

export interface SessionFeedback {
  id: string
  sessionId?: string
  activityId?: string
  date: ISODate
  /** Effort ressenti 1-10 */
  rpe: number
  fatigue?: number
  douleur?: { zone: string; intensite: number }
  at: ISODateTime
}

export interface Wellness {
  date: ISODate
  sleepHours?: number
  sleepScore?: number
  restingHr?: number
  hrv?: number
  bodyBattery?: number
  weightKg?: number
  /** Eau enregistrée sur la montre / Garmin Connect (ml), si transmise par Intervals.icu. */
  hydrationMl?: number
  raw?: unknown
}

export interface FoodItem {
  id: string
  source: 'ciqual' | 'off' | 'perso'
  name: string
  /** Valeurs pour 100 g */
  kcal: number
  protein: number
  carbs: number
  fat: number
  barcode?: string
  /** Famille d'aliments (Ciqual) ou marque (Open Food Facts). */
  group?: string
  /** Portion habituelle en grammes (ex. 1 yaourt = 125 g). */
  portionG?: number
  favorite?: boolean
  lastUsedAt?: ISODateTime
  usageCount?: number
}

export interface FoodLogEntry {
  id?: number
  date: ISODate
  meal: 'petit-dej' | 'dejeuner' | 'collation' | 'diner'
  foodId: string
  name: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  at: ISODateTime
}

export interface HydrationEntry {
  id?: number
  date: ISODate
  ml: number
  at: ISODateTime
  /** manuel (verre, gourde) ou estimation du check du matin. */
  source?: 'manuel' | 'check'
}

export interface BodyMetric {
  date: ISODate
  weightKg?: number
  waistCm?: number
  note?: string
}

export interface PlanVersion {
  id?: number
  createdAt: ISODateTime
  cause: string
  /** Résumé lisible des changements (affiché à l'utilisateur). */
  changes: string[]
  /** Séances avant le changement, pour pouvoir annuler. */
  before: PlannedSession[]
  after: PlannedSession[]
  /** Causes précises (attribution), affichées avant la liste des changements. */
  causes?: string[]
  /** applied = en place ; pending = proposée, en attente de mon accord ; undone = annulée ; rejected = refusée. */
  status: 'applied' | 'pending' | 'undone' | 'rejected'
}

export interface SyncLogEntry {
  id?: number
  at: ISODateTime
  action: string
  ok: boolean
  detail: string
}

export interface Setting {
  key: string
  value: unknown
}
