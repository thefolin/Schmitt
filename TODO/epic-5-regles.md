# EPIC-5 — Règles et fin de partie

**Objectif** : les effets déclenchés doivent être **annoncés**, et la partie
doit se terminer comme au vrai Schmitt.

---

## SCH-19 — Voir les gorgées dues au pouvoir de Zeus

**En tant que** joueur détenant le pouvoir de Zeus ⚡
**je veux** que le jeu annonce les gorgées que je reçois en me déplaçant
**afin de** ne pas oublier d'appliquer l'effet.

**Contexte** — Capture `00000035` (14:30:54).
« Le joueur possédant le pouvoir de Zeus ⚡ vient de se déplacer de 4 mais le
jeu ne signale pas que le [joueur X Reçoit 4 🍺] » (14:32:28)

Le pion vert (case 17) porte bien le badge ⚡, mais aucun message n'apparaît
après son déplacement de 4 cases. L'effet est silencieux — donc de fait
inappliqué pendant la soirée.

**Critères d'acceptation**
- [ ] Après le déplacement d'un porteur du pouvoir de Zeus, un message annonce les gorgées
- [ ] Le message suit le motif « JOUEUR X Reçoit N 🍺 » (SCH-13, SCH-12)
- [ ] N correspond au nombre de cases effectivement parcourues
- [ ] Vérifier si l'effet est calculé mais non affiché, ou pas déclenché du tout
- [ ] Test automatisé

**Priorité** : 🔴 Bloquant — effet de jeu invisible

---

## SCH-20 — Le défi du Schmitt pour les perdants

**En tant que** joueur ayant perdu
**je veux** que l'écran de fin annonce le défi du Schmitt
**afin de** terminer la partie selon la règle.

**Contexte** — Capture `00000043` (14:43:45).
« Il manque le défi du schmitt pour les perdants à la fin. » (14:44:11)

L'écran affiche « 🎉 VICTOIRE ! — JOUEUR 1 » et un bouton « NOUVELLE
PARTIE ». Rien pour les perdants.

**Critères d'acceptation**
- [ ] L'écran de fin annonce le défi du Schmitt pour les perdants
- [ ] Les perdants sont nommés
- [ ] Le contenu exact du défi est à récupérer auprès de Bastien
- [ ] L'accès à « Nouvelle partie » est conservé

**Priorité** : 🟠 Important — la fin de partie est incomplète

**⚠️ À clarifier** : contenu et déroulé exact du défi (à demander à Bastien).

**Note annexe** : sur la même capture, le bouton « NOUVELLE PARTIE » utilise
une police différente du reste du jeu (serif au lieu de la fonte grecque).
Défaut de style repéré à l'analyse, **non signalé par Bastien**.

---

## SCH-21 — Interface Aphrodite utilisable sur téléphone

**En tant que** joueur déclenchant le pouvoir d'Aphrodite
**je veux** une interface qui tient dans l'écran
**afin de** pouvoir faire mes choix.

**Contexte** — Capture `00000045` (14:48:25), « Interface aphrodite a
revoir » (14:48:35).

L'écran déborde de tous les côtés : le titre « POUVOIR D'APHRODITE » est
coupé, la consigne « …OCIEZ CHAQUE DÉ À UN JOUEUR ET CHOISISSEZ LA DIRECT… »
est tronquée à gauche **et** à droite, la première carte joueur est coupée,
la seconde sort de l'écran, et dans la carte verte « Joueur 3 » chevauche
« Position actuelle : 4 ».

**Critères d'acceptation**
- [ ] Toute l'interface tient dans la largeur d'un écran de téléphone en portrait
- [ ] Aucun texte tronqué ni superposé
- [ ] Toutes les cartes joueur sont atteignables (défilement explicite si nécessaire)
- [ ] Le plateau reste visible ou accessible (SCH-07)
- [ ] Vérifié sur l'APK Android, sur plusieurs tailles d'écran

**Priorité** : 🟠 Important — pouvoir difficilement jouable
