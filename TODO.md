# TODO — Schmitt Odyssée

Dernière mise à jour : 2026-09-13
État : **tout est poussé** sur `origin/main` (dernier commit `041c052`).

---

## 🔴 Priorité haute

### 1. Rendre le plateau beau

Demande explicite : « je veux un plateau beau, là c'est pas cool ».

Références fournies par l'utilisateur (captures Monopoly Go / Monopoly Plus) :
plateau vu **en biais depuis un coin**, piste continue lisible d'un coup
d'œil, plateau **épais posé sur un décor**, personnages debout dessus.

Ce qui est déjà fait : projection isométrique, cases jointives de taille
égale, épaisseur des cases, tapis solidaire du plateau.

Ce qui manque :
- **La vue en diagonale** (voir §2, c'est le même sujet)
- Un **sol qui s'étend** au-delà du tapis, au lieu du fond bleu uni
- Une **ombre portée** du plateau sur ce sol
- Une élévation visuelle de la case active

Contrainte à ne pas perdre de vue : le rendu ne doit **rien supposer de la
forme du parcours**. Les joueurs créeront leurs propres plateaux (U, cercle,
T…) et tous doivent avoir la même sensation.

### 2. La vue en diagonale (rotation du plateau)

**Tentée puis abandonnée**, l'état stable a été restauré. Le rendu obtenu
était convaincant et très proche des références, mais le cadrage se cassait
en portrait : 8 cases visibles sur 23.

Cause identifiée : la rotation doit s'appliquer dans la **même chaîne de
transformation** que le zoom et le déplacement (`Camera.getTransform()`),
sinon elle pivote autour d'un autre point et déporte le plateau.

Pistes explorées et **écartées par la mesure** (ne pas y revenir) :
- `transform-origin` du calque isométrique → l'origine était déjà correcte
- Taille explicite du calque → sans effet
- Zoom périmé dans `centerOn` → `setZoom` met bien l'état à jour

**Méthode recommandée** : écrire d'abord un test de cadrage automatisé sur
plusieurs formats, PUIS modifier le code, pour valider chaque étape au lieu
de deviner. C'est le manque de ce garde-fou qui a fait tourner en rond.

Bénéfice secondaire : réglerait le **plateau trop petit en portrait**
(il occupe un tiers de l'écran, voir §5).

---

## 🟡 Priorité moyenne

### 3. Vérifier que le bug dé / déplacement est bien clos

Une cause certaine a été corrigée (`041c052`) : après une Faveur des dieux,
`hideAll()` masquait aussi le dé normal, et plus aucun dé n'était visible aux
tours suivants.

**Mais ce n'est peut-être pas la seule.** Les scripts de test n'ont capté que
2 lancers sur 8 — assez pour confirmer la cohérence observée, pas assez pour
être catégorique.

À faire : demander à l'utilisateur si l'écart persiste, et dans quelle
situation précise (après une faveur ? au retour vers START ? toujours ?).

### 4. Athéna — la dernière faveur non implémentée

Seule faveur des dieux sans effet réel. Un `// TODO` explicite dans le code.

Particularité : elle touche la **condition de victoire**. Le bouclier renvoie
une fois toutes les gorgées sur un joueur au choix, et **tant qu'on le
possède, on ne peut pas gagner**. À brancher sur `checkVictory()`.

Le champ `hasAthenaShield` existe déjà dans le modèle `Player`, mais n'est
jamais utilisé — même situation que `chickenPlayer` et `isReturning` avant
leur implémentation.

### 5. Le plateau est trop petit en portrait

Il occupe environ un tiers de l'écran sur téléphone. Jouable, pas agréable.

**Cause mesurée** : c'est la **largeur** qui limite, pas la hauteur — un
plateau large dans un écran étroit. Augmenter les marges verticales ne change
rien (essayé, annulé).

La vue en diagonale (§2) est la vraie réponse : elle ferait tenir un plateau
large dans un écran étroit.

En attendant, suggérer aux joueurs de tourner l'écran : **le paysage est
excellent**.

---

## 🟢 Priorité basse

### 6. Illustrations manquantes

`temple` et `big_chicken` n'ont pas d'illustration propre : Zeus et le poulet
sont réutilisés. Si de nouveaux visuels arrivent, les brancher dans
`public/data/board-tiles.json`.

Trois polices Gelio restent inutilisées (Kleftiko, Greek Diner, Fasolada) si
l'on veut varier les titres.

### 7. Ordre du parcours dans l'éditeur

L'ordre de parcours suit l'**ordre d'ajout** des cases, pas la géométrie.
Poser une case au mauvais moment oblige à tout refaire.

C'est la limite la plus gênante de l'éditeur pour un usage réel, et elle
compte d'autant plus que les joueurs sont censés créer leurs plateaux.

Pistes : déduire l'ordre par chaînage de proximité, ou permettre un
glisser-déposer dans une liste ordonnée.

### 8. Décor personnalisable par la communauté

Idée retenue avec l'utilisateur : « on donne l'outil, on laisse la
créativité ». Un fichier de thème (couleur du sol, du tapis, ambiance)
fourni avec le plateau, plutôt qu'un décor figé.

À concevoir une fois §1 et §2 terminés.

---

## ⚖️ Droits — avant toute publication

Documenté dans le README, rappelé ici car c'est bloquant pour une sortie.

- **Polices Gelio Greek** (S. John Ross, Cumberland Games) : licence
  « usage privé uniquement ». Une publication, même gratuite, demande une
  licence — contact : sjohn@cumberlandgames.com. Alternative : basculer sur
  une police libre au rendu proche (Cinzel est déjà le repli).
- **Illustrations des cases** : confirmer les droits d'exploitation
  numérique.

Le projet reste à **usage privé** tant que ces points ne sont pas réglés.

---

## 📌 Notes utiles

### Vérifier que rien n'est cassé

```bash
npm run type-check     # types
npm test               # 177 tests
npm run build          # build de production
```

Vérification en navigateur réel (là où vivent les bugs d'affichage) :
`tools/test-drive/` — voir son README. Playwright n'est volontairement pas
une dépendance du projet.

### Piège connu

Pour tester une case précise, remplacer temporairement
`public/data/board-tiles.json` par un parcours court où la case visée est au
début — puis **restaurer le fichier** et confirmer avec
`git diff --stat public/data/board-tiles.json`.

### Contraintes du projet

- `proposition/` est gitignoré : ne jamais le commiter
- `package-lock.json` est volontairement gitignoré
- TypeScript vanilla, pas de framework
- Le **paysage** est l'orientation principale de jeu
- Cibles tactiles jamais sous 48px
- Les règles de base sont les vraies règles : on n'y touche pas
- La branche `backup/main-avant-bascule` est **locale uniquement** — elle
  n'existe pas sur GitHub
