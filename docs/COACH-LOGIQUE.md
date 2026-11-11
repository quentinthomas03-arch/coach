# Comment le coach décide

Tout est du code déterministe et testé, sans IA. Chaque décision est expliquée dans l'appli :
- « Pourquoi cette séance ? » sur chaque séance ;
- « Pourquoi : » sur chaque changement du plan (écran Semaine).

## Ce qui fait évoluer le plan (et seulement ça)
| Cause | Effet |
|---|---|
| Semaine **terminée et validée** (séances faites, effort ≤ 6/10, pas de douleur) | Niveau suivant (reprise) ou volume +8 % (forme). |
| Semaine faite à 2/3 | Consolidation : il faut 2 semaines à ce niveau avant de monter. |
| Effort ressenti ≥ 7/10 en moyenne | On reste au même niveau. |
| Douleur (check du matin ou retour de séance) | Un niveau en dessous, ou volume −20 %. |
| Aucune séance faite alors que tu avais commencé | Un niveau en dessous. |
| **Pas encore commencé** | Rien ne bouge : niveau de départ conservé. |
| Séance ratée | Une seule remplacée par semaine, plus tard dans la semaine si un jour le permet. |
| Dispos, réglages, zones fragiles, objectif, pause | Plan réorganisé, cause affichée. |
| 3 semaines de surcharge (travail, moral, fatigue) | Une sortie et un renfo de moins, jusqu'à ce que ça aille mieux. |
| Mise à jour de l'appli | Expliquée comme telle, appliquée sans te le demander, jamais présentée comme une décision d'entraînement. |

**Ce qui ne change jamais le plan des jours suivants** : le check du matin. Il propose seulement d'alléger la séance **du jour** si la forme est orange ou rouge. Tu acceptes ou tu gardes ta séance.

## Garde-fous de volume
- **Hausse du volume** : jamais plus de +8 % par semaine en forme continue. En reprise, la progression se fait par paliers de niveau.
- **Allègement** : une semaine allégée sur 4.
- **Créneaux** : le volume de base ne dépasse jamais ce que tes créneaux permettent de courir. Le temps qui ne tient pas en semaine est reporté sur la sortie longue, dans la limite de 30 min.
- **Sortie longue** : la semaine est toujours construite en entier, puis les séances déjà faites sont retirées. La sortie longue du dimanche garde donc sa durée.

## Allures (comme Kiprun)
- **Fourchette par étape** : chaque étape a sa fourchette d'allure (marche active, course facile, récupération, retour au calme), calculée depuis ta forme (méthode VDOT de Daniels).
- **Source de la forme** : tes records, corrigés de l'arrêt, puis le test de 30 min et tes sorties courues à fond.
- **En reprise** : l'allure facile est volontairement plus lente (+15 à +30 s/km).
- **Sans aucun chrono connu** : zones cardio, et le coach te demande un record.

## Tes corrections (Réglages › Mes séances, et après chaque séance)
- **« Je ne marche pas »** : l'échauffement devient un footing, les récupérations se font en trottinant, et le retour au calme en courant doucement.
- **Allure d'échauffement** : tu la fixes (ex. 6:30/km), fourchette de −10 à +20 s autour.
- **Allure facile** : de −60 à +60 s/km par rapport au calcul.
- **Retour en un tap après une séance faite** : « allures trop faciles / bien / trop dures ». Les séances suivantes accélèrent ou ralentissent de 10 s/km, et « Ce qui a changé » l'indique.

## Nutrition
- **Besoins du jour** : métabolisme de base (Mifflin-St Jeor) × activité, plus les séances. Les calories des séances viennent de la montre quand elle les fournit (nettes du métabolisme de base), sinon d'une estimation.
- **Répartition** : la journée est répartie par repas selon l'heure de ta séance (collation avant la course du soir, dîner de récupération).
- **Assiette en portions** :
  - repos : ¼ de féculents ;
  - entraînement léger : ⅓ de féculents ;
  - jour soutenu ou veille de sortie longue : ½ de féculents.
- **Recettes du menu** : dosées pour toi (×0,75 à ×1,5) selon le budget du repas.

## Vérifié par simulation (`src/sim/simulation.test.ts`)
Le simulateur fait vivre l'appli jour après jour, sur plusieurs mois, avec 5 profils :

| Profil | Ce qu'on attend du coach |
|---|---|
| Assidu | Reprise bouclée en 8 semaines, puis forme continue : 115 → 124 → 134 → (allègement 109) → 145 → 157 → 170 min. |
| N'a pas commencé | Niveau inchangé, jamais plus de 3 sorties + 1 remplacement. |
| Tout est dur (8/10) | Pas de progression. |
| Irrégulier (2/3) | Progression deux fois plus lente. |
| Douleur en semaine 3 | Redescend, puis repart. |

Les règles sont vérifiées chaque jour simulé : aucune séance un jour indisponible, jamais de renfo la veille d'une séance clé, aucun changement sans cause, pas de saut de volume au-delà de +25 % (hors retour d'allègement).
