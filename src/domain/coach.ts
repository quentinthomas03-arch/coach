import type { ISODate, MorningCheckin, PlannedSession } from '../data/types'
import { addDays, daysBetween } from './dates'
import type { Readiness } from './readiness'
import type { LevelDecision } from './reprise'
import type { TabacStatus } from './tabac'
import { ZONE_LABEL, type FragileZone } from './routines'
import type { NoteInsight } from './notes'
import type { RunAnalysis } from './runAnalysis'
import { STATUS_TEXT, type TrainingStatus } from './fitnessModel'

/**
 * LA VOIX DU COACH.
 *
 * Des règles simples et lisibles repèrent ce qui va bien et ce qui dérape,
 * puis le coach le dit avec le ton choisi. Pas d'IA : chaque message a une
 * règle identifiable (champ `rule`), donc on sait toujours pourquoi il apparaît.
 */

export type Tone = 'bienveillant' | 'direct' | 'cash'
export type MessageKind = 'bravo' | 'info' | 'recadrage' | 'alerte'

export interface CoachMessage {
  rule: string
  kind: MessageKind
  text: string
  /** Action proposée en 1 tap (ex. ajouter une zone fragile). */
  action?:
    | { label: string; type: 'add-zone'; zone: FragileZone }
    | { label: string; type: 'link'; to: string }
    | { label: string; type: 'pace-feedback'; sessionId: string; fb: 'trop-lent' | 'trop-rapide' }
}

/** Zones du check du matin → zones fragiles. */
export const CHECKIN_ZONE: Record<string, FragileZone | undefined> = {
  Genou: 'genou',
  Mollet: 'mollet',
  'Tendon d’Achille': 'achille',
  Cheville: 'cheville',
  Hanche: 'hanche',
  Dos: 'dos',
  Pied: 'pied',
}

export interface CoachContext {
  today: ISODate
  tone: Tone
  /** Séances des 14 derniers jours et à venir. */
  sessions: PlannedSession[]
  /** Check-ins des 14 derniers jours. */
  checkins: MorningCheckin[]
  readiness?: Readiness
  levelDecision?: LevelDecision
  tabac?: TabacStatus
  /** Alertes des garde-fous de charge (voir load.ts). */
  loadAlerts?: { rule: 'acwr' | 'volume'; text: string }[]
  /** Eau de la veille (si connue) et objectif. */
  waterYesterday?: { ml: number; target: number }
  /** Zones fragiles déjà déclarées. */
  fragileZones?: FragileZone[]
  /** Plan en pause : pas de reproches. */
  paused?: boolean
  /** Messages ponctuels (ex. retour de pause). */
  notice?: string[]
  /** Surcharge prolongée détectée (voir overload.ts). */
  overload?: { active: boolean; reasons: string[] }
  /** Ce que le coach retient de mes notes récentes (voir notes.ts). */
  noteInsights?: NoteInsight[]
  /** Sommeil moyen des 7 dernières nuits (h), si connu. */
  sleepAvg?: number
  /** Aucune performance connue : pas de fourchette d'allure possible. */
  noPaceRef?: boolean
  /** Profil resté sur les valeurs par défaut de l'accueil. */
  profileUnchecked?: boolean
  /** Analyses automatiques des sorties récentes (2 derniers jours). */
  runAnalyses?: (RunAnalysis & { sessionId?: string; title?: string })[]
  /** Statut d'entraînement (condition / fatigue). */
  trainingStatus?: TrainingStatus
}

type Variants = Record<Tone, string>

const say = (rule: string, kind: MessageKind, v: Variants, tone: Tone, action?: CoachMessage['action']): CoachMessage => ({ rule, kind, text: v[tone], ...(action ? { action } : {}) })

const inLast = (today: ISODate, days: number) => (d: ISODate) => d < today && d >= addDays(today, -days)

const ORDER: MessageKind[] = ['alerte', 'recadrage', 'bravo', 'info']

export function coachMessages(ctx: CoachContext): CoachMessage[] {
  const { today, tone } = ctx
  const out: CoachMessage[] = []
  const last7 = inLast(today, 7)
  const past = ctx.sessions.filter((s) => last7(s.date) && s.kind !== 'repos')
  const runs = past.filter((s) => s.kind !== 'renfo')
  const missedRuns = runs.filter((s) => s.status === 'missed' || s.status === 'planned').length
  const doneAll = past.length >= 3 && past.every((s) => s.status === 'done')
  const checks7 = ctx.checkins.filter((c) => last7(c.date))

  // 1. Douleur qui dure → consulter.
  const painDays = checks7.filter((c) => c.douleur && c.douleur.intensite >= 1).length
  if (painDays >= 3) {
    out.push(
      say('douleur-persistante', 'alerte', {
        bienveillant: `Tu signales une douleur depuis ${painDays} jours. Prends rendez-vous avec un médecin ou un kiné : c'est le bon réflexe, et on adaptera le plan ensuite.`,
        direct: `${painDays} jours de douleur cette semaine. On ne joue pas avec ça : médecin ou kiné, et en attendant on lève le pied.`,
        cash: `${painDays} jours que ça fait mal. Stop, tu vas voir un médecin ou un kiné. Courir dessus, c'est signer pour des semaines d'arrêt.`,
      }, tone),
    )
  }

  // 1 bis. Garde-fous de charge.
  for (const a of ctx.loadAlerts ?? []) {
    const lead: Variants = { bienveillant: 'Attention : ', direct: 'Stop, tu montes trop vite. ', cash: 'Freine. ' }
    out.push({ rule: `charge-${a.rule}`, kind: 'alerte', text: lead[tone] + a.text })
  }

  // 1 ter. Douleur répétée au même endroit → proposer d'en faire une zone fragile.
  const last14 = ctx.checkins.filter((c) => inLast(today, 14)(c.date) || c.date === today)
  const counts = new Map<FragileZone, number>()
  for (const c of last14) {
    const z = c.douleur ? CHECKIN_ZONE[c.douleur.zone] : undefined
    if (z) counts.set(z, (counts.get(z) ?? 0) + 1)
  }
  for (const [z, n] of counts) {
    if (n >= 2 && !(ctx.fragileZones ?? []).includes(z)) {
      out.push({
        rule: `zone-${z}`,
        kind: 'recadrage',
        text: `${ZONE_LABEL[z]} : gêne signalée ${n} fois en 2 semaines. Ajoute-la à tes zones fragiles : l’échauffement, les étirements et le renfo la cibleront.`,
        action: { label: `Ajouter « ${ZONE_LABEL[z]} »`, type: 'add-zone', zone: z },
      })
    }
  }

  // 1 quater. Surcharge prolongée.
  if (ctx.overload?.active) {
    const why = ctx.overload.reasons.join(', ')
    out.push(
      say('surcharge', 'info', {
        bienveillant: `Ces 3 dernières semaines : ${why}. J’allège ton entraînement pour qu’il reste un plaisir. Il reviendra à la normale tout seul quand ça ira mieux.`,
        direct: `3 semaines de ${why}. J’allège le plan : une séance de moins. On remontera quand ta vie respirera un peu.`,
        cash: `${why[0].toUpperCase() + why.slice(1)} depuis 3 semaines. Je coupe une séance. Pas négociable : récupère.`,
      }, tone),
    )
  }

  // 1 quinquies. Statut d'entraînement inquiétant.
  if (ctx.trainingStatus === 'surcharge') out.push({ rule: 'statut-surcharge', kind: 'alerte', text: STATUS_TEXT.surcharge })
  if (ctx.trainingStatus === 'desentrainement' && !ctx.paused) out.push({ rule: 'statut-desentrainement', kind: 'info', text: `${STATUS_TEXT.desentrainement} Une petite sortie facile suffit à relancer la machine.` })

  // 1 sexies. Analyse automatique des sorties récentes.
  for (const a of ctx.runAnalyses ?? []) {
    if (a.verdict === 'inconnu') continue
    const head = a.title ? `${a.title} : ` : 'Ta sortie : '
    out.push({
      rule: `analyse-${a.activityId}`,
      kind: a.verdict === 'dans-la-cible' ? 'bravo' : 'recadrage',
      text: head + a.text,
      action: a.suggest && a.sessionId ? { label: a.suggest === 'trop-rapide' ? 'Ralentir mes allures de 10 s/km' : 'Accélérer mes allures de 10 s/km', type: 'pace-feedback', sessionId: a.sessionId, fb: a.suggest } : undefined,
    })
  }

  // 2. Sorties manquées.
  if (missedRuns >= 2) {
    out.push(
      say('sorties-manquees', 'recadrage', {
        bienveillant: `${missedRuns} sorties non faites cette semaine. Ça arrive ! Si ton planning est trop chargé, ajuste tes dispos dans Semaine, le plan suivra.`,
        direct: `${missedRuns} sorties sautées en 7 jours. Si le planning ne colle pas à ta vie, change tes dispos ; sinon, on s'y tient.`,
        cash: `${missedRuns} sorties zappées cette semaine. La forme ne reviendra pas toute seule. Soit tu ajustes tes dispos, soit tu chausses.`,
      }, tone),
    )
  }

  // 3. Renfo délaissé.
  const strength14 = ctx.sessions.filter((s) => s.kind === 'renfo' && inLast(today, 14)(s.date))
  if (strength14.length >= 2 && !strength14.some((s) => s.status === 'done')) {
    out.push(
      say('renfo-delaisse', 'recadrage', {
        bienveillant: 'Pas de renfo depuis deux semaines. 15 minutes suffisent, et c’est ce qui protège tes genoux et tes tendons.',
        direct: 'Deux semaines sans renfo. C’est ton point faible, c’est justement là qu’il faut insister : 15 minutes, pas plus.',
        cash: 'Zéro renfo en deux semaines. Tu sais que c’est ton point faible. 15 minutes, tapis, maintenant.',
      }, tone),
    )
  }

  // 4. Soirées arrosées répétées.
  const heavy = checks7.filter((c) => c.alcool === '3+').length
  if (heavy >= 2) {
    out.push(
      say('alcool', 'recadrage', {
        bienveillant: `${heavy} soirées bien arrosées cette semaine. Profite, mais pense à boire de l'eau et à décaler les séances qui suivent.`,
        direct: `${heavy} grosses soirées en 7 jours : ta récup en prend un coup. On en reparle si ça devient l'habitude.`,
        cash: `${heavy} soirées à 3 verres et plus cette semaine. Tu veux retrouver la forme ou entretenir la fatigue ? À toi de voir.`,
      }, tone),
    )
  }

  // 5. Check du matin oublié.
  const lastCheck = ctx.checkins.map((c) => c.date).filter((d) => d <= today).sort().pop()
  if (lastCheck && daysBetween(lastCheck, today) >= 3) {
    out.push(
      say('check-oublie', 'info', {
        bienveillant: 'Ton check du matin m’aide à adapter tes séances. 15 secondes quand tu peux !',
        direct: 'Pas de check du matin depuis quelques jours : sans lui, j’adapte à l’aveugle.',
        cash: 'Trois jours sans check. Je ne suis pas devin : 15 secondes, 4 boutons.',
      }, tone),
    )
  }

  // 5 bis. Eau de la veille.
  const wy = ctx.waterYesterday
  if (wy && wy.ml > 0 && wy.ml < wy.target * 0.6) {
    const l = (wy.ml / 1000).toFixed(1).replace('.', ',')
    out.push(
      say('eau', 'info', {
        bienveillant: `Hier, environ ${l} L d’eau : un peu juste. Garde une gourde à portée de main aujourd’hui.`,
        direct: `Seulement ~${l} L hier. Une gourde sur le bureau, et tu la finis avant midi.`,
        cash: `${l} L hier. Pas assez. Gourde, maintenant.`,
      }, tone),
    )
  }

  // 5 ter. Notes libres (le plus récent de chaque type).
  const fmtD = (d: ISODate) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(new Date(d + 'T12:00:00'))
  const latest = (k: NoteInsight['kind']) => (ctx.noteInsights ?? []).filter((n) => n.kind === k).sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  const np = latest('douleur')
  if (np) {
    const z = np.zone
    out.push({
      rule: 'note-douleur',
      kind: 'info',
      text: `Dans ta note de ${fmtD(np.date)} : « ${np.excerpt} ». Si ça revient, signale-le dans le check du matin : j’adapterai les séances.`,
      action: z && !(ctx.fragileZones ?? []).includes(z) ? { label: `Ajouter « ${ZONE_LABEL[z]} » aux zones fragiles`, type: 'add-zone', zone: z } : undefined,
    })
  }
  const nt = latest('fatigue')
  if (nt) out.push(say('note-fatigue', 'info', { bienveillant: `Tu notais être à plat (${fmtD(nt.date)}). Écoute-toi : une séance peut sauter sans drame.`, direct: `Noté : « ${nt.excerpt} ». Si ça dure, dis-le dans le check du matin, j’allègerai.`, cash: `« ${nt.excerpt} » : dors plus, et dis-le dans le check.` }, tone))
  const ng = latest('positif')
  if (ng && !np) out.push(say('note-positif', 'bravo', { bienveillant: `« ${ng.excerpt} » : c’est exactement ce qu’on cherche !`, direct: `« ${ng.excerpt} » : on continue comme ça.`, cash: `« ${ng.excerpt} ». Voilà.` }, tone))

  // 5 quater. Sommeil.
  if (ctx.sleepAvg != null && ctx.sleepAvg < 6.5) {
    const h = ctx.sleepAvg.toFixed(1).replace('.', ',')
    out.push(say('sommeil', 'recadrage', {
      bienveillant: `${h} h de sommeil en moyenne cette semaine : c’est là que ton corps récupère. Essaie de te coucher 30 min plus tôt.`,
      direct: `${h} h de sommeil en moyenne. La forme se construit la nuit : 30 min plus tôt au lit.`,
      cash: `${h} h par nuit. Tu t’entraînes, mais tu ne récupères pas. Au lit.`,
    }, tone))
  }

  // 5 quinquies. Données manquantes pour bien coacher.
  if (ctx.noPaceRef) {
    out.push({
      rule: 'records',
      kind: 'info',
      text: 'Pour avoir une fourchette d’allure à chaque étape sur ta montre (comme sur Kiprun), donne-moi un chrono de référence : ton semi en 1h40, même ancien, suffit pour commencer.',
      action: { label: 'Ajouter mes records', type: 'link', to: '/plan' },
    })
  }
  if (ctx.profileUnchecked) {
    out.push({
      rule: 'profil',
      kind: 'info',
      text: 'Ta taille, ton poids et ton âge sont encore ceux par défaut : ton eau du jour, tes portions et ton plan de course sont donc approximatifs. Corrige-les en 10 secondes.',
      action: { label: 'Corriger mon profil', type: 'link', to: '/reglages#nutrition' },
    })
  }

  // 6. Bravo : semaine complète.
  if (doneAll) {
    out.push(
      say('semaine-complete', 'bravo', {
        bienveillant: `Toutes tes séances des 7 derniers jours sont faites (${past.length}/${past.length}). Bravo, c’est la régularité qui paie !`,
        direct: `${past.length}/${past.length} séances faites cette semaine. C’est exactement ça qu’on veut.`,
        cash: `${past.length}/${past.length}. Rien à redire. Continue.`,
      }, tone),
    )
  }

  // 7. Reprise terminée / montée de niveau.
  if (ctx.levelDecision?.completed) {
    out.push(
      say('reprise-terminee', 'bravo', {
        bienveillant: 'Reprise terminée : tu cours 30 minutes d’affilée ! On passe en Forme continue, avec une petite séance plus tonique certaines semaines.',
        direct: 'Reprise validée : 30 min continues. On passe en Forme continue : cycles de 3 semaines de charge + 1 allégée.',
        cash: 'Reprise bouclée. Tu n’es plus en reprise, tu t’entraînes. Forme continue, c’est parti.',
      }, tone),
    )
  } else if (ctx.levelDecision?.change === 'monte') {
    out.push(
      say('niveau-monte', 'bravo', {
        bienveillant: `Tu passes au niveau ${ctx.levelDecision.level} de la reprise. Bien joué !`,
        direct: `Niveau ${ctx.levelDecision.level} débloqué : semaine validée.`,
        cash: `Niveau ${ctx.levelDecision.level}. Mérité.`,
      }, tone),
    )
  }

  // 8. Forme du jour.
  if (ctx.readiness && ctx.readiness.color !== 'vert') {
    const r = ctx.readiness
    out.push(
      say(`forme-${r.color}`, 'info', {
        bienveillant: r.color === 'rouge' ? 'Journée difficile : écoute ton corps, le repos fait partie de l’entraînement.' : 'Forme moyenne aujourd’hui : on allège un peu, sans culpabiliser.',
        direct: r.color === 'rouge' ? 'Voyants au rouge : repos aujourd’hui, on repart demain.' : 'Forme moyenne : séance allégée, c’est plus malin que de forcer.',
        cash: r.color === 'rouge' ? 'Rouge. Pas de héros aujourd’hui : repos.' : 'Pas au top : on allège. Forcer maintenant, c’est payer plus tard.',
      }, tone),
    )
  }

  // 9. Tabac.
  const t = ctx.tabac
  if (t?.phase === 'preparation' && t.daysUntilQuit != null && t.daysUntilQuit <= 14) {
    out.push(
      say('tabac-approche', 'info', {
        bienveillant: `J−${t.daysUntilQuit} avant l’arrêt du tabac. As-tu pris rendez-vous avec ton médecin ou ton pharmacien pour les substituts ?`,
        direct: `J−${t.daysUntilQuit} avant l’arrêt. Prépare le terrain : substituts, raisons écrites, plan pour les moments à risque.`,
        cash: `J−${t.daysUntilQuit}. Les substituts, c’est maintenant qu’on les prévoit, pas le 1er au matin.`,
      }, tone),
    )
  }
  if (t?.phase === 'preparation' && t.prep && t.daysUntilQuit != null && t.daysUntilQuit > 14 && t.daysUntilQuit % 7 === 0) {
    out.push(
      say('tabac-prepa', 'info', {
        bienveillant: `Arrêt du tabac, J−${t.daysUntilQuit} : cette semaine, « ${t.prep.title} ». ${t.prep.todo[0]}`,
        direct: `Tabac, semaine « ${t.prep.title} » : ${t.prep.todo[0]}`,
        cash: `Tabac, J−${t.daysUntilQuit}. Cette semaine : ${t.prep.todo[0].charAt(0).toLowerCase()}${t.prep.todo[0].slice(1)}`,
      }, tone, { label: 'Voir le programme', type: 'link', to: '/tabac' }),
    )
  }
  if (t?.cravings && t.cravings.resisted7 >= 3 && t.cravings.resisted7 === t.cravings.last7) {
    out.push(
      say('tabac-envies', 'bravo', {
        bienveillant: `${t.cravings.resisted7} envies de fumer tenues cette semaine, sans craquer. Chacune rend la suivante plus facile.`,
        direct: `${t.cravings.resisted7} envies tenues sur 7 jours. Bien joué.`,
        cash: `${t.cravings.resisted7} envies, ${t.cravings.resisted7} victoires. Continue.`,
      }, tone),
    )
  }
  if (t?.phase === 'sans-tabac' && t.daysSmokeFree != null) {
    const d = t.daysSmokeFree
    if (d === 0 && !t.relapsed) {
      out.push(say('tabac-jour-j', 'bravo', { bienveillant: 'C’est le jour J. Tu as tout préparé, une journée à la fois.', direct: 'Jour J. Une journée à la fois.', cash: 'Jour J. On y va.' }, tone))
    } else if ([1, 3, 7, 14, 30, 60, 90, 180, 365].includes(d)) {
      out.push(
        say('tabac-palier', 'bravo', {
          bienveillant: `${d} jour${d > 1 ? 's' : ''} sans tabac ! ${t.cigarettesAvoided} cigarettes évitées et ${Math.round(t.moneySaved ?? 0)} € économisés.`,
          direct: `${d} jour${d > 1 ? 's' : ''} sans fumer : ${t.cigarettesAvoided} cigarettes évitées, ${Math.round(t.moneySaved ?? 0)} € gardés.`,
          cash: `${d} jour${d > 1 ? 's' : ''} clean. ${Math.round(t.moneySaved ?? 0)} € dans ta poche.`,
        }, tone),
      )
    } else if (t.relapsed && d === 0) {
      out.push(
        say('tabac-rechute', 'info', {
          bienveillant: 'Une cigarette n’efface pas tout le chemin parcouru. On note, et on repart aujourd’hui.',
          direct: 'Écart noté. Ce n’est pas un échec, c’est une info : repère ce qui l’a déclenché, et on repart.',
          cash: 'Rechute. Ça arrive à presque tout le monde. Ce qui compte, c’est la suivante que tu ne fumes pas.',
        }, tone),
      )
    }
  }

  ;(ctx.notice ?? []).forEach((n, k) => out.push({ rule: `notice-${k}`, kind: 'info', text: n }))
  // En pause : on garde les alertes santé et l'information, jamais de reproche.
  const kept = ctx.paused ? out.filter((m) => m.kind === 'alerte' || m.kind === 'info' || m.rule.startsWith('tabac')).filter((m) => m.rule !== 'check-oublie') : out
  return kept.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
}
