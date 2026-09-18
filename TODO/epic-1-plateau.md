# EPIC-1 — Le plateau doit ressembler au vrai Schmitt

> « Le plateau en général ne ressemble pas au vrai schmitt » — Bastien, 14:04:58

**Objectif** : qu'un joueur qui connaît le plateau physique retrouve ses
repères immédiatement, sans avoir à déchiffrer les cases.

---

## SCH-01 — Voir le vrai multiplicateur d'une case

**En tant que** joueur devant le plateau
**je veux** lire d'un coup d'œil le multiplicateur réel d'une case rouge ou verte
**afin de** savoir combien je vais boire ou distribuer avant même de jouer.

**Contexte** — Captures `00000009` et `00000010` (14:03:46).
« Les cases rouge et vert affichent pas le bon multiplicateur. »

Toutes les cases affichent un grand **« ×2 »** avec le vrai facteur en tout
petit exposant (`×3`, `×4`). Sur la capture `00000009`, la case 16 est en
réalité ×3 et la case 15 est ×4, mais les deux se lisent « ×2 » à distance.
La hiérarchie typographique est inversée : le chiffre significatif est le
plus petit.

**Critères d'acceptation**
- [ ] Le facteur réel de la case (2, 3, 4…) est l'élément typographique **dominant**
- [ ] Aucune case n'affiche un « 2 » codé en dur quand son facteur est différent
- [ ] Lisible sur un écran de téléphone à distance de bras, sans zoom
- [ ] Les cases rouges (boire) et vertes (distribuer) restent distinguables au premier regard

**Priorité** : 🟠 Important

---

## SCH-02 — Être envoyé dans le bon sens par une case flèche

**En tant que** joueur qui tombe sur une case flèche
**je veux** être déplacé dans la direction imposée par la case
**afin que** le plateau se joue comme le vrai Schmitt.

**Contexte** — Capture `00000041` (14:40:44).
« Le joueur vert est tombé sur la case flèche +2. Il aurait dû arriver sur la
case schmitt. A la place il a continué d'avancer jusqu'à la case X2 rouge.
— corriger le sens obligatoire des cases fleches »

Le déplacement de la flèche est appliqué dans le sens de marche courant du
joueur au lieu du sens propre à la case. Conséquence : la destination est
fausse, et le joueur rate la case ciblée par la règle.

**Critères d'acceptation**
- [ ] Une case flèche déplace toujours dans **son** sens, indépendamment du sens de marche du joueur
- [ ] Le cas de la capture est rejoué : depuis la flèche +2, le pion atterrit sur la case Schmitt
- [ ] Le comportement est identique en phase aller et en phase retour (après le pouvoir du Schmitt)
- [ ] Test automatisé couvrant les deux phases

**Priorité** : 🔴 Bloquant — règle du jeu non respectée

---

## SCH-03 — Comprendre l'orientation d'une case flèche

**En tant que** joueur
**je veux** que la flèche dessinée sur la case pointe vers là où elle m'envoie
**afin de** anticiper mon déplacement.

**Contexte** — « La case flèche n'est jamais bien orienté » (14:04:37).
Captures `00000010` (case 20) et `00000041` (cases 9 et 13) : toutes les
flèches pointent vers le haut de l'écran, quelle que soit leur direction
réelle et quelle que soit la portion du parcours (les cases 9 et 13 sont sur
un segment vertical, la case 20 sur un segment horizontal).

**Critères d'acceptation**
- [ ] La flèche est pivotée selon la direction effective de la case
- [ ] L'orientation reste juste sur tous les segments du parcours (haut, bas, gauche, droite)
- [ ] L'orientation reste cohérente avec un plateau créé dans l'éditeur (forme quelconque)
- [ ] Cohérent avec SCH-02 : l'image montre ce que le code applique

**Priorité** : 🟡 Confort — mais à traiter avec SCH-02

---

## SCH-04 — Retrouver l'aspect du plateau physique

**En tant que** joueur habitué au Schmitt papier
**je veux** reconnaître le plateau à l'écran
**afin de** ne pas avoir à réapprendre le jeu.

**Contexte** — « Le plateau en général ne ressemble pas au vrai schmitt »
(14:04:58). Remarque globale, sans capture dédiée : à préciser avec Bastien
(photo du plateau physique à demander).

**Critères d'acceptation**
- [ ] Obtenir de Bastien une photo du plateau réel comme référence
- [ ] Lister les écarts concrets (couleurs, ordre des cases, iconographie, proportions)
- [ ] Découper le résultat en stories distinctes avant de développer

**Priorité** : 🟡 À cadrer — dépend d'un retour de Bastien

**Note** : recoupe le point « Rendre le plateau beau » de [../TODO.md](../TODO.md).
