# Décisions techniques

## Phase 0 — chaîne Appli → Intervals.icu → Garmin (validée le 10/11/2026 sur iPhone + Fenix 6)

| Point testé | Résultat | Décision |
|---|---|---|
| Appel direct à l'API Intervals.icu depuis Safari iOS (CORS) | ✅ Autorisé | **Pas de relais** (pas de Cloudflare Worker). La clé ne transite que vers intervals.icu. |
| Séance de course structurée (`type: Run`, texte Intervals) | ✅ Arrive sur la Fenix 6 avec ses étapes | Les séances de course sont envoyées sur la montre. |
| Mise à jour sans doublon (`external_id` + `upsert=true`) | ✅ Même identifiant d'événement après renvoi | Chaque séance a un `externalId` stable (`coach-<id>`). |
| Suppression par `external_id` | ✅ | Utilisée quand le moteur retire une séance future. |
| Séance de renfo (`type: WeightTraining`, description texte) | ❌ Pas exploitable sur la montre | **Le renfo n'est pas envoyé à la montre.** Il se fait dans l'appli (exercices + chrono à l'écran). Sur la montre : lancer l'activité « Musculation » pour l'enregistrer si souhaité. |
| Lecture activités / bien-être | ⚠️ Vide au premier test (pas de course depuis mai ; import Garmin du bien-être à vérifier) | À revérifier avant la Phase 2. |
