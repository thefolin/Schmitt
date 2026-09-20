# EPIC-7 — Refonte du rendu en 3D (Three.js)

**Branche** : `refonte-3d` · **Kanban** : issues #35 à #40

> « on a un effet 2D et je voulais comme un peu le monopoly […] le plateau
> n'est pas ajusté avec le dé, c'est pour cela que l'on a un effet de merde »
> — Quentin, 18/09/2026

---

## Le problème de fond

Les trois bugs successifs du dé ([#13](https://github.com/thefolin/Schmitt/issues/13))
n'étaient pas trois bugs. C'était **le même défaut structurel** qui revenait :

| # | Cause trouvée | Erreur mesurée |
|---|---|---|
| 1 | Inclinaison codée en dur à 40°, scène passée à 58° | 48,6 % |
| 2 | Dé figé en pleine culbute après une chute | — |
| 3 | Lacet appliqué entre les deux redressements | 6,2 % |
| 4 | Dé sans l'écrasement vertical du plateau | visuel |

À chaque fois : **un désaccord entre deux représentations de la même scène.**

La cause racine est qu'**il n'existe pas de scène unique**. Des transformations
CSS réparties dans plusieurs fichiers tentent de rester synchronisées à la
main. Les corriger une à une revient à traiter les symptômes.

### Ce qu'on garde, ce qu'on refait

| | Lignes | Sort |
|---|---|---|
| Règles du jeu (`game.logic`, modèles, cases, faveurs) | 2 346 | ✅ **intact** — zéro dépendance au DOM, vérifié |
| Rendu (`main-camera`, `board.renderer`, CSS) | 5 571 | ♻️ **refait** |
| Tests de règles (17 fichiers sur 22) | — | ✅ filet de sécurité pendant toute la refonte |
| Tests de rendu (5 fichiers) | — | ♻️ à adapter |

**Les règles sont bonnes et les tests sont bons.** C'est le rendu qui est à
reprendre, et lui seul.

---

## Les stories

| # | Story | Prio |
|---|---|---|
| [#35](https://github.com/thefolin/Schmitt/issues/35) | Voir un plateau qui ne se contredit plus lui-même | P0 |
| [#36](https://github.com/thefolin/Schmitt/issues/36) | Retrouver un plateau qui a l'air d'un vrai plateau | P0 |
| [#37](https://github.com/thefolin/Schmitt/issues/37) | Lire sur le dé la valeur qu'on vient de jouer | P0 |
| [#38](https://github.com/thefolin/Schmitt/issues/38) | Suivre les pions et leurs statuts d'un coup d'œil | P1 |
| [#39](https://github.com/thefolin/Schmitt/issues/39) | Voir tout le plateau, sur n'importe quel écran | P0 |
| [#40](https://github.com/thefolin/Schmitt/issues/40) | Jouer sur l'appareil qu'on a sous la main | P1 |

**Ordre conseillé** : #35 (socle) → **#39 (cadrage portrait)** → #36 → #37 → #38 → #40.

Le cadrage en portrait passe **avant** le soin du rendu : c'est lui qui a fait
échouer la tentative précédente, autant le savoir tôt.

---

## Les acquis à ne pas perdre

La refonte remplace le rendu, pas les corrections obtenues dessus :

- **#9** — le vrai multiplicateur d'une case doit rester lisible
- **#25 / #27** — les badges 🐤 🐔 🏆 restent visibles sur les pions
- **#15** — déplacement et zoom manuels de la caméra
- **#13** — **0 % d'erreur** sur la face du dé, mesuré : 6 faces, ±2° de bruit
  de pose, rotation libre

---

## Les risques identifiés

**Le cadrage en portrait.** Une vue en diagonale a déjà été tentée puis
abandonnée (voir [`../TODO.md`](../TODO.md) §2) : le rendu était convaincant,
mais 8 cases sur 23 restaient visibles en portrait. C'est le risque n°1.

**La forme du parcours.** L'éditeur permet des plateaux en U, en cercle, en T.
Le rendu ne doit rien supposer de leur géométrie.

**La cible.** ✅ Tranché le 19/09/2026 : **Android uniquement** (APK,
`minSdk 22` = Android 5.1). iOS, Android TV et Apple TV sont abandonnés.
Le chantier se dimensionne donc sur un téléphone Android tactile — pas de
navigation à la télécommande, pas de seconde pile de rendu.

⚠️ Reste le point technique propre à Android : le contexte WebGL peut être
**perdu** au retour d'arrière-plan. À détecter et rétablir, sans quoi le
joueur retrouve un écran noir.

---

## Pendant ce temps, sur `main`

Le visuel est **gelé** pour éviter des conflits sur ~5 500 lignes. Restent
livrables sur `main` : les règles et les textes, à commencer par
[#34](https://github.com/thefolin/Schmitt/issues/34) (les faveurs 3→7 sortent
sur la mauvaise somme, P0) une fois les arbitrages rendus.

---

## 🧹 À retirer avant la livraison

**Le bouton « 🔱 Test » de la barre du bas** (`#test-poseidon` dans
`index-3d.html`, branché dans `preview.ts`).

Il simule la faveur de Poséidon sans attendre le bon jet — elle sort sur
deux jets sur trente-six, après être tombé sur une case temple, soit une
faveur sur dix-huit.

Visible par défaut, comme l'était celui d'Aphrodite : la recette se fait à
plusieurs autour d'une table, où personne ne tape un paramètre d'URL. C'est
ce qui le rend provisoire — un joueur qui le presse ouvre une faveur qui
n'a pas été tirée.

Le chemin sans bouton subsiste après son retrait : `?favor=11` force
Poséidon, sans rien afficher en partie.

**Pour le retirer :** supprimer le `<button id="test-poseidon">` de
`index-3d.html`, le bloc `test-poseidon` de `preview.ts`, et le bloc de
tests « le bouton de recette de Poséidon » de `test/hud-contract.test.ts`.

**Le bouton « 👟 Test » de la barre du bas** (`#test-hermes` dans
`index-3d.html`, branché dans `preview.ts`).

Même raison, même provisoire : il ouvre l'écran d'Hermès sans attendre le
bon jet. Hermès ne demande AUCUN second jet — sa règle n'en parle pas — donc
le bouton ouvre l'écran directement, sans lancer de dés.

Le chemin sans bouton subsiste après son retrait : `?favor=5` force Hermès,
sans rien afficher en partie.

**Pour le retirer :** supprimer le `<button id="test-hermes">` de
`index-3d.html`, le bloc `test-hermes` de `preview.ts`, et le bloc de tests
« le bouton de recette d'Hermès » de `test/hud-contract.test.ts`.
