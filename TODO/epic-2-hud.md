# EPIC-2 — Lisibilité en cours de partie (HUD)

> « Au niveau de l'affichage : … » — Bastien, 14:09:59

**Objectif** : à tout moment de la partie, un joueur doit pouvoir répondre à
« qu'est-ce qui vient de se passer ? » et « où en sont les autres ? » sans
attendre ni deviner.

---

## SCH-05 — Voir la valeur du dé effectivement jouée

**En tant que** joueur qui vient de lancer
**je veux** que le dé affiche la valeur utilisée pour mon déplacement
**afin de** vérifier que le jeu a compté juste.

**Contexte** — « le dé n'affiche jamais la bonne valeur de déplacement »
(14:09:59). Captures `00000035` (14:30:54) et `00000047` (14:48:44) : le dé
est figé en cours de culbute, aucune face n'est lisible.

Un correctif existe côté web (commit `7a08af7` « fix(dice): la face affichée
ne correspondait pas à la valeur jouée ») mais l'APK testé date du 15/09 et
ne l'embarque pas forcément → **vérifier d'abord si le bug persiste sur un
build à jour** avant de rouvrir le sujet.

**Critères d'acceptation**
- [ ] Rejouer le scénario sur un APK reconstruit depuis `main`
- [ ] Le dé s'immobilise sur une face nette, égale à la valeur du déplacement
- [ ] La face reste lisible après la fin de l'animation
- [ ] Si le bug est déjà corrigé : fermer la story et livrer un APK à jour à Bastien

**Priorité** : 🟠 Important — à vérifier en premier

---

## SCH-06 — Garder l'historique des coups sous les yeux

**En tant que** joueur
**je veux** que l'historique des actions reste affiché en permanence
**afin de** suivre ce qu'ont fait les autres sans devoir regarder l'écran au bon moment.

**Contexte** — « l'historique devrait être en permanence visible et pas
seulement 1 seconde après avoir joué. Il se superpose au nom du joueur c'est
pas pratique. » (14:09:59)

Deux problèmes distincts : la **durée** (disparaît trop vite) et la
**position** (recouvre le bandeau « JOUEUR X — À vous de jouer » visible en
haut de la plupart des captures).

**Critères d'acceptation**
- [ ] L'historique est visible en continu, sans disparition automatique
- [ ] Il ne recouvre jamais le bandeau du joueur courant
- [ ] Il montre au moins les derniers coups, dans l'ordre
- [ ] Reste lisible en portrait sur téléphone

**Priorité** : 🟠 Important

---

## SCH-07 — Basculer à volonté entre plateau et message

**En tant que** joueur
**je veux** un moyen toujours accessible de passer du plateau au message d'action et inversement
**afin de** consulter l'un sans perdre l'autre.

**Contexte** — « toujours avoir a l'écran le moyen de basculer sur le plateau
ou le message du joueur (peut être un bouton ?) » (14:09:59).
Sur les captures d'overlay (`00000016`, `00000020`, `00000027`, `00000033`,
`00000037`), le plateau est flouté en arrière-plan et inaccessible.

**Critères d'acceptation**
- [ ] Un contrôle permanent (bouton) permet la bascule dans les deux sens
- [ ] Il est atteignable quel que soit l'overlay affiché
- [ ] Revenir au message ne fait pas perdre l'action en cours
- [ ] Zone tactile confortable au pouce sur mobile

**Priorité** : 🟡 Confort

---

## SCH-08 — Identifier une action à son icône de case

**En tant que** joueur
**je veux** voir l'icône de la case qui déclenche l'effet dans le message d'action
**afin de** relier immédiatement le message à l'endroit du plateau.

**Contexte** — « les messages d'action des joueurs devraient avoir comme logo
la case qui applique l'effet, en plus du texte appliqué. » (14:09:59)

Aujourd'hui les overlays affichent des emojis génériques sans rapport avec
l'image de la case : 🎁 cadeau pour une case ×2 (`00000020`), 🏆 trophée pour
le pouvoir de Zeus (`00000027`), 🍺 chope pour une case rouge (`00000033`).

**Critères d'acceptation**
- [ ] Chaque message d'action affiche la **vignette de la case** concernée
- [ ] La vignette est la même image que sur le plateau
- [ ] Le texte de l'effet est conservé à côté
- [ ] Couvre tous les types de case (multiplicateurs, dieux, Poulet, Mouton, Schmitt, flèche)

**Priorité** : 🟡 Confort — recoupe SCH-10 et SCH-14

**Note** : à traiter en une passe avec l'épique 3 (même composant d'overlay).
