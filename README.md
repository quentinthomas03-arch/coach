# Coach

Coach d'entraînement personnel sur iPhone : course à pied, renforcement musculaire, nutrition et hydratation, avec envoi des séances sur une montre Garmin via Intervals.icu.

- **Appli web installable (PWA)** : elle s'ajoute à l'écran d'accueil de l'iPhone et fonctionne hors ligne, sauf pour les échanges avec Intervals.icu.
- **Pas de serveur, pas de compte, pas de suivi.** Toutes les données restent sur le téléphone (IndexedDB).
- **Moteur de plan déterministe** : du code testé, sans IA à l'exécution, qui explique chacune de ses décisions.

> ⚠️ **Avertissement** : Coach ne remplace pas un avis médical ni un professionnel du sport ou de la nutrition. Consulte un médecin avant de démarrer un programme exigeant, après un long arrêt, ou en cas de douleur.

---

## Utilisation au quotidien

| Écran | À quoi il sert |
|---|---|
| **Aujourd’hui** | Check du matin (4 taps : forme, moral, travail, vie perso, plus la soirée et une douleur éventuelle) → forme du jour vert/orange/rouge. Séance du jour avec « Pourquoi ? », état sur la montre et proposition d’allègement (tu acceptes ou tu gardes ta séance). Séance détectée par la montre → « c’était dur comment ? ». Messages du coach, nutrition et eau en 1 tap, tabac. Le dimanche : « Prépare ta semaine ». |
| **Semaine** | Le plan de la semaine et de la suivante. Tu déplaces, verrouilles, retires ou ajoutes une séance. Tes dispos de la semaine en quelques taps. « Ce qui a changé » avec **Annuler** sur chaque changement. En mode « je valide », les propositions du coach à accepter ou refuser. |
| **Plan** | Mode actuel (Reprise → Forme continue → Objectif). Fixer un objectif : le coach fait d’abord son **bilan** (où tu en es, temps nécessaire, réaliste ou non, date au plus tôt). Ma forme (VDOT) et mes allures, mes performances, le test de calibration de 30 min. |
| **Nutrition** | Journal (objectifs du jour, eau, repères autour de la séance, repas). Ajout d’un repas en le **décrivant** (« colin pané, écrasé de pommes de terre, fondue de poireaux »), en portions petite/normale/grosse, **sans peser**. Menu de la semaine (55 recettes) qui suit tes séances et se met à jour avec ton panier du maraîcher. |
| **Suivi** | Minutes et km par semaine, charge et garde-fous, régularité du renfo, sommeil et FC de repos, poids. |
| **Réglages** | Plan (date de début, sorties, niveaux, ton du coach, mode des changements, matériel), Nutrition (profil, objectif de poids encadré, aliments évités, météo), Intervals.icu, sauvegarde, stockage, avertissement. |

Le plan se recalcule tout seul à chaque ouverture de l’appli : import des séances faites, bilan de la semaine, envoi des 7 prochains jours de course sur la montre.

### Ce que le coach fait aussi
- **Échauffement et étirements obligatoires** : chaque séance de course commence par 4 min de mobilité et gammes et se termine par 5 min d’étirements, sur la montre comme dans l’appli (guidés avec chrono : boutons « Échauffement guidé » et « Étirements guidés »).
- **Zones fragiles** (Réglages › Plan) : exercices de prévention ciblés dans le renfo, l’échauffement et les étirements. Si une douleur revient au même endroit, le coach propose de l’ajouter en 1 tap.
- **Pause** (Plan) : vacances, maladie, blessure. Plus aucune séance ni envoi sur la montre ; au retour, reprise adaptée à la durée et au motif.
- **Allures automatiques** : les sorties courues à fond (effort 8/10 et plus, ou FC ≥ 90 % de la FC max) servent de référence, les allures se mettent à jour sans test.
- **Surcharge prolongée** : 3 semaines de travail, de moral ou de fatigue au plus bas → une sortie et un renfo de moins, jusqu’à ce que ça aille mieux.
- **Sommeil** : heure de coucher conseillée la veille d’une séance clé (heure de lever dans Réglages › Plan), alerte si les nuits sont courtes.
- **Notes libres** (Aujourd’hui › « + Une note pour le coach ») : le coach repère douleurs, fatigue et bonnes sensations par mots-clés, et réagit.
- **Tabac × course** : FC de repos avant et depuis l’arrêt, sur la page Tabac.
- **Bilan de la semaine** (le dimanche sur Aujourd’hui, et dans Suivi) : ce qui a été fait, l’avis du coach, la semaine à venir, partageable.
- **Eau sans contrainte** : question « Hier, tu as bu ? » dans le check du matin, gourde en 1 tap, ou eau saisie sur la montre (si Intervals.icu la transmet).

## Sommaire

1. [Installer l'appli sur l'iPhone](#1-installer-lappli-sur-liphone)
2. [Relier la montre Garmin via Intervals.icu](#2-relier-la-montre-garmin-via-intervalsicu)
3. [Tester la chaîne jusqu'à la montre](#3-tester-la-chaîne-jusquà-la-montre)
4. [Sécurité de la clé d'API](#4-sécurité-de-la-clé-dapi)
5. [Sauvegarde et restauration](#5-sauvegarde-et-restauration)
6. [Limites de Safari à connaître](#6-limites-de-safari-à-connaître)
7. [Déploiement (GitHub Pages)](#7-déploiement-github-pages)
8. [Développement](#8-développement)
9. [Architecture](#9-architecture)

---

## 1. Installer l'appli sur l'iPhone

1. Ouvre **Safari** (pas Chrome) à l'adresse de l'appli : `https://<ton-pseudo-github>.github.io/<nom-du-depot>/`.
2. Touche le bouton **Partager** (carré avec une flèche vers le haut).
3. Fais défiler, puis touche **Sur l'écran d'accueil** › **Ajouter**.
4. Ouvre désormais Coach **depuis l'icône**, jamais depuis Safari. Les données de l'icône et celles de Safari sont séparées.

**Mises à jour** : elles s'installent toutes seules. Si une nouveauté n'apparaît pas, ferme l'appli (balaie-la vers le haut dans le sélecteur d'applis) puis rouvre-la.

## 2. Relier la montre Garmin via Intervals.icu

Garmin ne permet pas à une appli perso d'envoyer des séances directement sur la montre. **Intervals.icu** (gratuit) sert d'intermédiaire :

```
Coach ──► Intervals.icu ──► Garmin Connect ──► montre
```

Le sens inverse marche aussi : tes activités et ton bien-être (sommeil, FC de repos…) remontent de Garmin vers Intervals.icu, puis Coach les lit.

### 2.1 Créer le compte Intervals.icu
1. Dans Safari, va sur **intervals.icu** et crée un compte gratuit.
2. Remplis le profil de base (sexe, date de naissance, poids). Laisse le reste par défaut.

### 2.2 Relier Garmin Connect
1. Dans Intervals.icu, ouvre le menu puis **Settings**.
2. Dans la section **Connections**, touche **Garmin Connect** › **Connect**.
3. Connecte-toi avec ton compte Garmin et **accepte toutes les autorisations** : activités, données de santé (sommeil, FC de repos…) et entraînements.
4. De retour dans Intervals.icu, dans la connexion Garmin, **active l'envoi des entraînements planifiés vers Garmin**. L'option s'appelle « Upload planned workouts » ou un libellé proche. Active aussi l'import du bien-être (wellness) s'il est proposé.
5. Intervals.icu importe alors ton historique Garmin. Ça peut prendre quelques minutes.

### 2.3 Récupérer l'identifiant athlète et la clé d'API
1. Dans Intervals.icu, va dans **Settings**, puis tout en bas dans **Developer Settings**.
2. Note ton **Athlete ID** (de la forme `i123456`).
3. Touche **API Key** › **Generate** (ou « View ») et copie la clé.
4. Dans Coach : **Réglages** › **Intervals.icu**. Colle l'identifiant et la clé, puis **Enregistrer et tester**.

## 3. Tester la chaîne jusqu'à la montre

Dans Coach : **Réglages** › **Diagnostic montre**. Lance les tests dans l'ordre.

| Test | Ce qu'il vérifie |
|---|---|
| 1. Appel direct (CORS) | Le navigateur de l'iPhone peut-il parler directement à Intervals.icu ? Si non, il faut un petit relais (voir plus bas). |
| 2. Course test | Une séance structurée (marche-course en zones cardio) arrive dans le calendrier Intervals.icu. |
| 3. Renfo test | Une séance de type WeightTraining : on regarde comment Garmin l'affiche. |
| 4. Pas de doublon | Renvoyer une séance la met à jour au lieu de la dupliquer. |
| 5. Lecture | Activités et bien-être des 30 derniers jours (sommeil, FC de repos, HRV si disponible). |
| 6. Nettoyage | Supprime les séances test. |

### Faire arriver la séance sur la montre
1. Ouvre l'app **Garmin Connect** sur l'iPhone et tire l'écran vers le bas pour synchroniser.
2. Vérifie que la séance apparaît dans Garmin Connect › Entraînement › Entraînements, ou dans le calendrier.
3. Sur la **Fenix 6** : START › Course, puis appui long sur MENU › Entraînement › Mes entraînements (ou Calendrier) › choisis la séance › Faire l'entraînement.
4. Rien après 15 minutes ? Dans Garmin Connect, touche l'icône de la montre › **Synchroniser**.

Une fois les tests faits, touche **Copier le rapport** et colle le résultat dans la conversation de développement.

### Résultats (voir `docs/DECISIONS.md`)
- L'appel direct depuis l'iPhone fonctionne : **aucun relais n'est nécessaire**.
- Les séances de **course** arrivent sur la montre avec leurs étapes.
- Les séances de **renfo** ne sont pas exploitables sur la montre : elles se font dans l'appli (exercices et chrono à l'écran). Pour enregistrer la séance sur la montre, lance l'activité « Musculation ».

## 4. Sécurité de la clé d'API

- **Où elle est** : uniquement dans le stockage de l'appli sur ton iPhone. Elle n'est jamais dans le code, ni dans ce dépôt (public), ni dans les fichiers de sauvegarde.
- **Le risque** : quelqu'un qui obtiendrait la clé pourrait lire et modifier ton compte Intervals.icu (activités, calendrier). Elle ne donne **pas** accès à ton mot de passe Garmin.
- **Pour la révoquer** : intervals.icu › Settings › Developer Settings › régénère la clé. L'ancienne cesse immédiatement de fonctionner. Colle ensuite la nouvelle dans Coach.
- Coach permet aussi de supprimer la clé du téléphone (Réglages › Intervals.icu).

## 5. Sauvegarde et restauration

- **Sauvegarder** : Réglages › Sauvegarde › **Sauvegarder**. Le menu de partage iOS s'ouvre : choisis **Enregistrer dans Fichiers** › iCloud Drive.
- **Restaurer** : Réglages › Sauvegarde › **Restaurer**, puis choisis le fichier. Toutes les données du téléphone sont remplacées par celles de la sauvegarde. La clé d'API actuelle est conservée.
- Une bannière te le rappelle si ta dernière sauvegarde a plus de 30 jours.
- Le fichier est un JSON versionné (`formatVersion`). Les anciennes sauvegardes restent lisibles grâce aux migrations (`src/data/backup.ts`).

## 6. Limites de Safari à connaître

- Une appli **ajoutée à l'écran d'accueil** a son propre stockage. Celui-ci n'est pas soumis à la règle de Safari qui efface les données d'un site non visité depuis 7 jours.
- **Supprimer l'icône supprime toutes les données.** Sauvegarde avant.
- Coach demande le « stockage persistant » au navigateur (Réglages › Stockage indique s'il est accordé).
- **Pas de notifications push** (il faudrait un serveur). Les rappels passent par l'écran Aujourd'hui et par la montre.

## 6 bis. Nutrition : sources et limites

- **Aliments bruts** : table **Ciqual 2025 de l’Anses** (3 484 aliments), intégrée à l’appli et utilisable hors ligne. Licence Ouverte (Etalab). Source : ciqual.anses.fr. Le fichier `public/data/ciqual.json` est généré par `scripts/build-ciqual.mjs`.
- **Produits de marque** : **Open Food Facts** (base collaborative, gratuite). Seul le code-barres ou le texte recherché est envoyé.
- **Scan de code-barres** : Safari sur iPhone n’a pas de lecteur intégré. L’appli embarque la bibliothèque zxing (WebAssembly), qui fonctionne hors ligne. La lecture est fiable sur un emballage plat et bien éclairé, moins sur un emballage courbe ou froissé. **Alternative toujours disponible** : taper les chiffres du code dans la recherche.
- **Météo** (eau du jour) : **Open-Meteo**, gratuit et sans clé. Seule ta position arrondie (~1 km) est envoyée, une fois par jour. La météo peut être désactivée dans Réglages › Nutrition.
- **Calculs** (repères généraux, pas des prescriptions) :
  - métabolisme de base selon Mifflin-St Jeor, multiplié par ton niveau d’activité, plus la dépense des séances ;
  - protéines ~1,6 g/kg, lipides ≥ 25 % des calories, glucides pour le reste ;
  - eau : ~30 ml/kg par jour, plus la séance, plus la chaleur.
- **Garde-fous de poids** : déficit ≤ 15 % et ≤ 500 kcal/jour. L’objectif calorique ne descend jamais sous le métabolisme de base ni sous 1 500 kcal (homme) / 1 200 kcal (femme). Le rythme est limité à 0,75 % du poids par semaine. Pour un objectif important, l’appli recommande un avis médical ou diététique.
- **Menu et panier** : 55 recettes (rapides, à cuisiner en avance, plats plaisir), valeurs calculées depuis Ciqual, calendrier des fruits et légumes de saison en France. Le menu suit les séances (féculents la veille d’une sortie longue, protéines après une séance) et se recalcule quand tu modifies ton panier du maraîcher.
- **Saisie sans pesée** : portions « normales » d’adulte par type d’aliment (1 filet, 1 assiette, 1 pot…), petite ×0,7, grosse ×1,4. Plats du quotidien et du resto : ceux de Ciqual (burger, pizza, kebab, couscous, paella…) et quelques plats composés à partir d’ingrédients Ciqual (tacos, poke bowl, ramen, pad thaï…), marqués « estimé ».

## 7. Déploiement (GitHub Pages)

Chaque modification poussée sur la branche `main` est testée puis mise en ligne automatiquement par GitHub Actions (`.github/workflows/deploy.yml`). Si un test échoue, rien n'est déployé.

**Configuration initiale, une seule fois, depuis Safari sur l'iPhone :**
1. Sur github.com, ouvre le dépôt › **Settings**. Si l'onglet n'apparaît pas, active « Version pour ordinateur » dans le menu « aA » de Safari.
2. Menu de gauche › **Pages**.
3. Dans **Build and deployment** › **Source**, choisis **GitHub Actions**.
4. Va dans l'onglet **Actions** du dépôt : le déploiement « Déploiement » doit passer au vert, en 1 à 2 minutes environ.
5. L'adresse de l'appli s'affiche dans Settings › Pages.

## 8. Développement

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

Stack : React 19, Vite, TypeScript, Tailwind CSS, vite-plugin-pwa, Dexie (IndexedDB), Zod, Vitest.

## 9. Architecture

```
src/
  domain/        Logique pure et testée, sans dépendance à l'interface :
                 reprise, forme continue, objectifs (périodisation, bilan), allures (VDOT),
                 planificateur de semaine, renfo, forme du jour, voix du coach, charge,
                 nutrition, recettes, menu, saisons, tabac.
  app/           Services qui relient le moteur aux données : plan (versions, annulation),
                 envoi montre, import Intervals.icu, objectifs, nutrition, menu.
  data/          Schéma IndexedDB (Dexie), migrations, sauvegarde/restauration.
  integrations/  Intervals.icu, Open Food Facts, Open-Meteo, scan de code-barres.
  ui/            Écrans et composants.
docs/            Besoins exprimés au fil de l'eau, décisions techniques, check-list de tests sur iPhone.
```

### Principes
- **Chaque décision du moteur porte des raisons lisibles** : c'est ce qui alimente « pourquoi cette séance aujourd'hui ».
- **Migrations de schéma** : on ne modifie jamais une version publiée de `db.ts`, on en ajoute une nouvelle (`this.version(n+1)`) avec une fonction `upgrade` si besoin.
- **Identifiants externes stables** (`external_id`) pour chaque séance envoyée : renvoyer une séance la met à jour dans Intervals.icu au lieu de la dupliquer.

### Format des séances (Intervals.icu)
Les séances de course sont converties en texte structuré Intervals.icu (`src/domain/workout.ts`) :

```
Warmup
- Marche active 5m Z1 HR

5x
- Course facile 2m Z2 HR
- Marche 1m Z1 HR

Cooldown
- Marche 5m Z1 HR
```

- **Durées** : `10m`, `30s`, `1m30s`, `1h`.
- **Distances** : `1km`, `400mtr` (`m` désigne les minutes).
- **Cibles** : `Z2 HR` (zone cardiaque), `Z2 Pace` (zone d'allure), `5:30-6:00/km Pace` (allure absolue).
