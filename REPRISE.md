# Reprise du travail — Schmitt Odyssée

Document d'arrêt de session, écrit le 2026-09-13, mis à jour à la reprise.
État : **arbre propre, 15 commits en avance sur `origin/main`, rien de poussé.**

---

## 0. À faire en premier

### 0.1 Pousser les commits

C'est la seule action réellement bloquante : tout le travail des dernières
sessions n'existe que en local.

```bash
git log --oneline origin/main..HEAD   # relire les commits
git push origin main
```

Les commits vont de `fc6d48b` (refonte du menu) à `874f59c` (visibilité du
pion). Rien n'a été poussé depuis le début de la refonte.

### 0.2 Vérifier que la branche de secours reste intacte

`backup/main-avant-bascule` (`96b8d06`) conserve l'ancien `main` d'avant la
bascule `main2` → `main`. **Ne pas la supprimer** tant que le nouveau `main`
n'est pas poussé et validé sur téléphone.

---

## 1. Règles du jeu non implémentées

### 1.1 La case TEMPLE n'a aucun effet

**C'est le même cas que le Poulet avant sa correction** : le type `temple`
est présent dans le parcours (`public/data/board-tiles.json`), la modale
s'affiche avec son icône et son texte, mais aucun `case 'temple':` n'existe
dans le `switch` de `applyTileEffect()` — le pion repart comme si de rien
n'était.

- Fichier : `src/camera/main-camera.ts`, méthode `applyTileEffect()`
- Vérification : `grep -c "case 'temple'" src/camera/main-camera.ts` → `0`
- Préalable : **demander la règle exacte du temple**, elle n'a jamais été
  précisée dans les échanges.

### 1.2 Les zones Enfers et Olympe

Visibles sur les photos du plateau physique, jamais implémentées. Ce ne sont
pas de simples cases mais des **zones** : elles demandent probablement un
modèle à part (un état du joueur, pas un effet ponctuel).

Préalable : demander les règles, et décider si une zone est un état du joueur
ou une famille de cases.

### 1.3 La règle « Double = cul sec »

Visible sur le plateau physique, non implémentée. Elle porte sur le **lancer**
et non sur la case : elle se brancherait dans le flux de lancer de dé, pas
dans `applyTileEffect()`.

Note : le jeu ne lance deux dés que pour la Faveur des dieux et le pouvoir
Schmitt. Il faut clarifier si « double » concerne ces cas-là uniquement.

---

## 2. Bugs connus, identifiés mais non corrigés

### 2.1 `schmitt.json` saute le tileId 17

**Vérifié à l'instant** : `public/assets/schmitt.json` contient 22 placements
pour des tileId allant de 0 à 22 — **le 17 manque**.

Conséquence : à partir de la position 17, l'image affichée et l'effet appliqué
se décalent d'un cran.

L'impact a été **fortement réduit** par le commit `0241686` : l'effet est
désormais lu depuis la case réellement posée (`getTileIdAtPosition()`) et non
depuis l'index du pion. Mais le plateau importé reste amputé d'une case.

À faire : décider si on ajoute le placement manquant dans `schmitt.json`, ou
si on abandonne ce fichier au profit de `board-tiles.json`, qui est désormais
la source de vérité du parcours.

### 2.2 ~~`onMapSelected` laissait un plateau fantôme~~ — CORRIGÉ

Corrigé à la reprise. Le diagnostic initial était imprécis : `importedLayout`
n'était jamais effacé, l'import n'était donc pas perdu.

Le vrai défaut était plus grave : si une branche échouait (entrée sauvegardée
disparue, `'imported'` sans import en mémoire), `selectedLayout` **gardait sa
valeur précédente** pendant que le menu affichait autre chose — on croyait
jouer sur un plateau, on jouait sur un autre.

Chaque branche conclut désormais sur une valeur, et un choix introuvable
ramène explicitement au plateau par défaut. Vérifié par
`tools/test-drive/check-map.mjs`.

### 2.3 L'ordre du parcours vient de l'ordre d'ajout, pas de la géométrie

Dans l'éditeur, l'ordre de parcours est l'ordre dans lequel les cases ont été
posées. Poser une case au mauvais moment oblige à **tout refaire** : il n'y a
aucun moyen de réordonner un chemin existant.

C'est la limite la plus gênante de l'éditeur pour un usage réel. Piste :
soit déduire l'ordre de la géométrie (chaînage par proximité), soit permettre
un glisser-déposer dans une liste ordonnée.

---

## 3. Demandes de l'utilisateur en attente

### 3.1 ~~Le dé blanc à coins arrondis~~ — FAIT

Appliqué à la reprise. Note : `proposition/des/dees.png` est en réalité une
**image AVIF** malgré son extension `.png` (et non une vidéo, comme noté par
erreur précédemment) ; `sips -s format png` permet de la lire.

Coins arrondis proportionnels à la taille (22 %), blanc légèrement cassé,
points noirs plus gros et creusés dans la face.

Un défaut d'affichage a été découvert au passage : le sélecteur
`.dice-face div div` (board-camera.css) frappait les **9 cellules** de la
grille, y compris les vides, qui recevaient une ombre et dessinaient un
damier de carrés clairs sur chaque face. Corrigé.

Rappel : `proposition/` est gitignoré et **ne doit jamais être commité**.

### 3.2 La nouvelle version du plateau (photos)

L'utilisateur a fourni 3 photos d'une **nouvelle version** du plateau physique
en disant explicitement : « ne le prend pas en compte ».

C'est respecté : le parcours actuel suit l'ancienne version. La configuration
est prête pour basculer quand il le décidera — il suffira d'éditer
`public/data/board-tiles.json`, sans recompilation.

**Ne pas basculer sans son accord explicite.**

---

## 4. Où se trouve quoi

| Quoi | Où |
|---|---|
| Le parcours (ordre = ordre de jeu) | `public/data/board-tiles.json` |
| Chargement + repli défensif | `src/features/tiles/tile.config.ts` → `loadTileConfigs()` |
| Effets des cases | `src/camera/main-camera.ts` → `applyTileEffect()` |
| Règles de partie (Poulet, règles inventées) | `src/features/game/game.logic.ts` |
| Tokens du design system | `src/styles/common/design-system.css` |
| HUD de jeu, tiroir, modale de règle | `src/styles/game/hud.css` |
| Réalignement des modales héritées | `src/styles/common/surfaces.css` (chargé en dernier) |
| Éditeur | `src/editor/board-editor.ts` + `src/styles/editor/editor-theme.css` |

### Pour changer une case du plateau

Éditer `public/data/board-tiles.json`. **Aucune recompilation.** L'ordre du
tableau est l'ordre de parcours. Le fichier porte en tête un `_usage` et un
`_types` qui listent les types disponibles. Le jeu **et** l'éditeur lisent la
même source, donc la palette ne peut pas diverger du plateau joué.

---

## 5. Comment vérifier que rien n'est cassé

```bash
npm run type-check     # types
npm test               # 160 tests
npm run build          # build de production
```

Pour une vérification en navigateur réel (c'est là que vivent les bugs
d'affichage, invisibles en test unitaire) :

Les scripts sont désormais **dans le dépôt**, sous `tools/test-drive/`
(ils vivaient dans `/tmp` et auraient été perdus au redémarrage).
Voir `tools/test-drive/README.md` pour le détail.

```bash
npx vite --port 5179                  # dans un terminal
node tools/test-drive/full2.mjs       # dans un autre
```

Playwright n'est pas une dépendance du projet ; l'installer une fois avec
`npm install --no-save playwright && npx playwright install chromium`.

### Piège à connaître

Pour tester une case précise, la méthode qui marche est de **remplacer
temporairement `board-tiles.json`** par un parcours court où la case visée
est au début — puis de **restaurer le fichier** et de confirmer avec
`git diff --stat public/data/board-tiles.json` qu'il est bien revenu à
l'identique.

---

## 6. Contraintes à ne pas oublier

- `proposition/` est gitignoré : **ne jamais le commiter**.
- `package-lock.json` est volontairement gitignoré par le projet.
- Rester en **TypeScript vanilla** : pas de framework.
- Garder la caméra pseudo-3D « façon Monopoly ».
- Garder l'import/export JSON du plateau.
- **Le paysage est l'orientation principale de jeu** (soirée, téléphone).
- Les cibles tactiles ne descendent jamais sous 48px : « la place se gagne
  sur les marges, jamais sur les cibles tactiles ».
- Les règles de base sont les **vraies** règles : on n'y touche pas. Le
  joueur peut construire un autre plateau, pas d'autres règles.

---

## 7. État vérifié à l'arrêt

- 160 tests passent (11 fichiers)
- `tsc --noEmit` propre
- `npm run build` propre
- Partie complète jouée jusqu'à la victoire, zéro erreur console
- Portrait et paysage vérifiés par capture d'écran
- Cas 6 joueurs sur la case START vérifié (pions à 34px, grille 3×3, sans
  débordement)

### Connecteurs à autoriser

Gmail, Google Calendar et Google Drive demandent une autorisation OAuth qui
n'a pas pu être faite en session non interactive. À activer depuis les
réglages de connecteurs claude.ai si le besoin se présente.
