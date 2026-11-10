import type { ISODate, MorningCheckin, PlannedSession } from '../data/types'
import { addDays, daysBetween } from './dates'
import type { Readiness } from './readiness'
import type { LevelDecision } from './reprise'
import type { TabacStatus } from './tabac'

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
}

type Variants = Record<Tone, string>

const say = (rule: string, kind: MessageKind, v: Variants, tone: Tone): CoachMessage => ({ rule, kind, text: v[tone] })

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

  return out.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
}
