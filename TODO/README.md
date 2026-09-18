# Retours utilisateur — Bastien Vandest (18/09/2026)

Source : export WhatsApp `message-whats-app/WhatsApp Chat - Le SCHMITT/`
(`_chat.txt` + 15 captures d'écran), session de test du **18/09/2026 entre
14h03 et 14h50**, sur l'**APK Android** `schmitt-odyssee-debug.apk`
(confirmé par Bastien : « L'appli apk »).

Bastien = utilisateur / testeur. Quentin = développeur.

## Structure

Un fichier par épique. Chaque user story porte un identifiant stable
(`SCH-xx`) réutilisable comme titre de carte dans le Kanban GitHub.

| Épique | Fichier | Stories |
|---|---|---|
| EPIC-1 — Fidélité du plateau au vrai Schmitt | [epic-1-plateau.md](epic-1-plateau.md) | SCH-01 → SCH-04 |
| EPIC-2 — Lisibilité en cours de partie (HUD) | [epic-2-hud.md](epic-2-hud.md) | SCH-05 → SCH-08 |
| EPIC-3 — Langage des messages d'action | [epic-3-messages.md](epic-3-messages.md) | SCH-09 → SCH-15 |
| EPIC-4 — Statuts persistants des joueurs | [epic-4-statuts.md](epic-4-statuts.md) | SCH-16 → SCH-18 |
| EPIC-5 — Règles & fin de partie | [epic-5-regles.md](epic-5-regles.md) | SCH-19 → SCH-21 |
| EPIC-6 — Éditeur de plateau | [epic-6-editeur.md](epic-6-editeur.md) | SCH-22 |

## Récapitulatif par priorité

**🔴 Bloquant (le jeu ne suit pas ses propres règles)**
- SCH-02 — sens des cases flèche non respecté
- SCH-16 — Petit Poulet ne devient jamais Gros Poulet
- SCH-22 — l'éditeur ne joue pas le plateau édité
- SCH-19 — le pouvoir de Zeus ne déclenche pas ses gorgées

**🟠 Important (confusion pendant le jeu)**
- SCH-01 — multiplicateur illisible sur les cases
- SCH-05 — le dé n'affiche pas la valeur jouée
- SCH-06 — historique visible 1 s puis masqué
- SCH-17 — aucun badge poulet sur les pions
- SCH-20 — défi du Schmitt absent de l'écran de victoire
- SCH-21 — interface Aphrodite hors écran

**🟡 Confort / polish**
- SCH-03, SCH-04, SCH-07, SCH-08, SCH-09 → SCH-15, SCH-18
