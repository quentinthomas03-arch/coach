# Coach

Coach d'entraînement personnel sur iPhone : course à pied, renforcement musculaire, nutrition et hydratation, avec envoi des séances sur une montre Garmin via Intervals.icu.

- **Appli web installable (PWA)** : elle s'ajoute à l'écran d'accueil de l'iPhone et fonctionne hors ligne, sauf pour les échanges avec Intervals.icu.
- **Pas de serveur, pas de compte, pas de suivi.** Toutes les données restent sur le téléphone (IndexedDB).
- **Moteur de plan déterministe** : du code testé, sans IA à l'exécution, qui explique chacune de ses décisions.

> ⚠️ **Avertissement** : Coach ne remplace pas un avis médical ni un professionnel du sport ou de la nutrition. Consulte un médecin avant de démarrer un programme exigeant, après un long arrêt, ou en cas de douleur.

---

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

### Si le test CORS échoue : relais Cloudflare Worker
Un mini relais gratuit transmettrait les appels à Intervals.icu. Il ne stocke rien : la clé reste sur ton téléphone. Les étapes pas à pas seront ajoutées ici seulement si le test échoue.

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
  domain/        Logique pure et testée (plan, allures, charge, renfo, nutrition). Aucune dépendance à l'interface.
  data/          Schéma IndexedDB (Dexie), migrations, sauvegarde/restauration.
  integrations/  Intervals.icu (puis météo, aliments).
  ui/            Écrans et composants.
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
