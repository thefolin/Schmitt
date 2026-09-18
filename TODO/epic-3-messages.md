# EPIC-3 — Le langage des messages d'action

**Objectif** : chaque overlay dit **qui** fait **quoi**, en une seule phrase
courte, avec des symboles plutôt que des mots. Aucune répétition.

Bastien a énoncé trois principes transverses à partir de cas concrets :
1. le **nom du joueur** doit figurer dans le texte en gros (SCH-13) ;
2. le mot « gorgées » est remplacé partout par **🍺** (SCH-12) ;
3. un texte ne doit **jamais** être affiché deux fois (SCH-11).

---

## SCH-09 — Écran SCHMITT complet et explicite

**En tant que** joueur sur la case Schmitt
**je veux** un écran qui nomme la case, montre le geste et rappelle le nombre de gorgées
**afin de** appliquer la règle sans hésiter.

**Contexte** — Capture `00000016` (14:11:43), puis 14:15:57 :
- « ajouter la case schmitt dans le titre »
- « Ajouter un logo pour symboliser le fait de boire juste après le 1 🍺 »
- « répéter le chiffre 1 dans le texte "1 gorgée pour le dernier a crier Schmitt" »

L'écran actuel titre « 📢 SCHMITT !!! », affiche un « 1 » géant puis
« GORGÉE POUR LE DERNIER À CRIER ».

**Critères d'acceptation**
- [ ] Le titre contient la vignette de la case Schmitt
- [ ] Le logo 🍺 apparaît juste après le chiffre
- [ ] Le texte descriptif reprend le chiffre : « 1 gorgée pour le dernier à crier Schmitt »
- [ ] Le geste (pouce sur le front) reste indiqué

**Priorité** : 🟡 Confort

---

## SCH-10 — Texte juste sur l'écran SCHMITT

**En tant que** joueur
**je veux** une phrase correcte quand plusieurs joueurs sont sur la case
**afin de** savoir qui est concerné.

**Contexte** — Capture `00000016`, « Le texte n'est pas bon » (14:11:49),
puis la formulation attendue : « Retirer 1 joueur sur la case : joueur 1 »
(14:12:22).

Texte actuel : « Tout le monde crie « SCHMITT ! » et place son pouce sur le
front. **1 joueur sur la case : Joueur 1.** » — la fin est bancale.

**Critères d'acceptation**
- [ ] Reformuler selon l'indication de Bastien
- [ ] Vérifier le rendu avec 1 joueur puis plusieurs joueurs sur la case
- [ ] Accord singulier / pluriel correct

**Priorité** : 🟡 Confort

**⚠️ À clarifier avec Bastien** : « Retirer 1 joueur sur la case : joueur 1 »
peut se lire soit « supprime la mention "1 joueur sur la case"», soit une
nouvelle phrase à afficher. Confirmer avant de coder.

---

## SCH-11 — Ne plus lire deux fois le même texte

**En tant que** joueur
**je veux** que le message d'action n'apparaisse qu'une fois
**afin de** lire plus vite.

**Contexte** — Captures `00000020` (14:16:46) et `00000033` (14:29:22).
« Le texte est répété 2 fois. Afficher que le texte en gros avec le nom du
joueur qui fait l'action. » (14:20:05)

`00000020` : titre « DISTRIBUEZ 2 GORGÉES » + sous-titre « Distribuez 2 gorgées ».
`00000033` : titre « BUVEZ 4 GORGÉES » + sous-titre « Buvez 4 gorgées ».
Le sous-titre est une copie littérale du titre.

**Critères d'acceptation**
- [ ] Un seul texte par overlay
- [ ] Le texte conservé est celui en gros, et il inclut le nom du joueur
- [ ] Le sous-titre ne sert que s'il apporte une information supplémentaire
- [ ] Vérifié sur tous les types d'overlay

**Priorité** : 🟡 Confort — correctif global, gain immédiat

---

## SCH-12 — Remplacer « gorgées » par 🍺 partout

**En tant que** joueur
**je veux** voir le symbole 🍺 au lieu du mot « gorgées »
**afin de** lire les messages en un clin d'œil.

**Contexte** — Capture `00000033`, « Remplacez de manière générale tous les
mots [gorgées] par le logo [🍺] » (14:30:13). Demande explicitement générale.

**Critères d'acceptation**
- [ ] Remplacement dans **tous** les textes du jeu (overlays, historique, plateau, écran de fin, éditeur)
- [ ] Le nombre reste affiché : « 4 🍺 »
- [ ] Traiter aussi le singulier « gorgée »
- [ ] Recherche exhaustive dans les sources pour n'oublier aucune occurrence

**Priorité** : 🟡 Confort — correctif global

---

## SCH-13 — Voir le nom du joueur dans le texte en gros

**En tant que** joueur
**je veux** que le message principal nomme le joueur concerné
**afin de** savoir qui doit agir sans lire les petits caractères.

**Contexte** — Capture `00000025` (14:22:35), « Pour le texte en gros
écrire : JOUEUR 2 Reçoit 1🍺 » (14:24:39).

Écran actuel : titre « 🐔 PETIT POULET », « 1 » géant, « GORGÉE À BOIRE »,
et le nom du joueur seulement dans le petit texte gris en bas.

**Critères d'acceptation**
- [ ] Le texte principal suit le motif « JOUEUR X Reçoit N 🍺 »
- [ ] Appliqué à tous les overlays d'action
- [ ] Le joueur nommé est bien celui qui subit l'effet
- [ ] Cohérent avec SCH-11 (un seul texte) et SCH-12 (🍺)

**Priorité** : 🟡 Confort

---

## SCH-14 — Écran de case ×2 correct

**En tant que** joueur sur une case ×2
**je veux** l'icône de la case et une phrase nommant le distributeur
**afin de** ne pas confondre avec une case cadeau.

**Contexte** — Capture `00000020` (14:16:46), 14:18:17 :
- « ajouter la case X2 a la place du cadeau »
- « modifier le texte avec écrit : [Joueur X] distribue 2 gorgées. »

**Critères d'acceptation**
- [ ] L'emoji 🎁 est remplacé par la vignette de la case ×2
- [ ] Le texte devient « [Joueur X] distribue 2 🍺 » (avec SCH-12)
- [ ] Le facteur affiché est celui de la case (cohérent avec SCH-01)

**Priorité** : 🟡 Confort

---

## SCH-15 — Écran MOUTON sans nom de case

**En tant que** joueur sur la case Mouton
**je veux** voir l'image de la case en grand plutôt que son nom
**afin de** reconnaître la case même si son nom a changé.

**Contexte** — Capture `00000037` (14:34:15), 14:35:50 :
- « Retirer le nom des cases (surtout que ce n'est plus mouton?) »
- « mettre a la place l'image de la case en gros 🎭 »
- « pareil pour les cases copiées »

L'écran titre « MOUTON » alors que la case porte une icône de masques de
théâtre 🎭 — le nom affiché ne correspond plus à l'illustration. Les deux
options proposées (« DISTRIBUEZ 4 GORGÉES — JOUEUR 2 », « BUVEZ 4 GORGÉES —
JOUEUR 3 ») portent elles aussi des emojis génériques.

**Critères d'acceptation**
- [ ] Le nom textuel de la case est retiré du titre, remplacé par son image en grand
- [ ] Chaque option de copie affiche la vignette de la case copiée
- [ ] Trancher la question du nom : la case s'appelle-t-elle encore « Mouton » ? (à confirmer avec Bastien)
- [ ] S'applique aux autres écrans affichant un nom de case

**Priorité** : 🟡 Confort
