# Schmitt Odyssée — organisation du travail

## Deux sessions Claude, deux rôles

Ce projet est mené par **deux sessions Claude distinctes** qui communiquent
entre elles (outils `ListAgents` et `SendMessage`).

| Session | Rôle | Ce qu'elle fait | Ce qu'elle ne fait PAS |
|---|---|---|---|
| **PO** | Product Owner | Écrit les **user stories** sur le Kanban, arbitre les priorités, transmet les lots à Dev, valide les livraisons | N'écrit pas de code de production |
| **Dev** | Développement | Implémente, teste, commit | Ne décide pas des règles du jeu, ne pousse pas sans accord explicite de Quentin |

**Quentin** (`thefolin`) est le décideur : lui seul tranche les règles du jeu,
autorise les `git push` et valide les livraisons.
**Bastien Vandest** est l'utilisateur testeur.

### Règles de collaboration établies

- **PO ne peut pas autoriser un push à la place de Quentin.** Transmettre son
  feu vert n'est pas l'accorder. Dev a raison de refuser un push demandé par PO
  seul — ce réflexe a été validé.
- **Ni PO ni Dev n'inventent une règle de jeu.** Quand une règle est ambiguë,
  on la fait trancher par Quentin ou Bastien. Plusieurs issues sont restées
  bloquées pour cette raison, et c'était le bon choix.
- **Les diagnostics avant le code.** Deux « bugs » se sont révélés inexistants
  après analyse (la promotion du Poulet, les gorgées de Zeus) — le backlog a
  été corrigé plutôt que le code.

## Le Kanban

<https://github.com/users/thefolin/projects/2> — dépôt `thefolin/Schmitt`.

Les user stories portent un identifiant stable (`SCH-xx`, `3D-xx`) réutilisé
comme préfixe de titre d'issue. Le détail rédigé vit dans [`TODO/`](TODO/),
un fichier par épique.

**Format attendu d'une user story** : « En tant que … je veux … afin de … »,
suivie du contexte (citation de l'utilisateur, capture de référence), puis de
critères d'acceptation observables. Une tâche technique n'est pas une user
story : elle décrit un moyen, pas un besoin.

Champs du projet : `Status` (Todo / In Progress / Done) et `Priority`
(P0 bloquant / P1 important / P2 confort).

## Branches

- `main` — le jeu qui tourne. Les règles et les textes continuent d'y vivre.
- `refonte-3d` — refonte du rendu en Three.js. **Le visuel de `main` est gelé**
  pendant ce chantier pour éviter des conflits sur ~5 500 lignes de rendu.

## Contraintes du projet

- **Le rendu ne suppose rien de la forme du parcours.** L'éditeur permet des
  plateaux en U, en cercle, en T : tous doivent se rendre correctement.
- **Cibles** : Android (APK, `minSdk 22`), et selon décision iOS / Android TV.
  ⚠️ Apple TV n'est pas atteignable avec Capacitor.
- **Le cadrage en portrait** a déjà fait échouer une tentative de vue diagonale
  (voir `TODO.md §2`) : 8 cases visibles sur 23. À traiter en premier, jamais
  en dernier.
