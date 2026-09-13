# Scripts de vérification en navigateur réel

Ces scripts pilotent un Chromium headless (Playwright) contre le serveur de
développement. Ils servent à vérifier ce que les tests unitaires ne voient
pas : tailles réelles à l'écran, superpositions, animations, blocages de tour.

Plusieurs bugs n'ont été trouvés que par ce biais — le sélecteur de joueurs
qui figeait la partie, l'animation de saut du pion avalée par une transition
CSS concurrente, le damier de carrés clairs sur les faces du dé.

## Prérequis

Playwright n'est **pas** une dépendance du projet (c'est un gros paquet, et
il ne sert qu'à la vérification manuelle). Il faut l'installer une fois :

```bash
npm install --no-save playwright && npx playwright install chromium
```

Si on préfère ne rien ajouter au projet, on peut aussi l'installer dans un
dossier à part et lancer les scripts depuis là avec `NODE_PATH`.

## Utilisation

```bash
npx vite --port 5179        # dans un terminal
node tools/test-drive/<script>.mjs   # dans un autre
```

Les captures sont écrites dans `tools/test-drive/out/` (ignoré par git).

## Les scripts

| Script | Ce qu'il vérifie |
|---|---|
| `full2.mjs` | Joue une partie complète jusqu'à la victoire. Signale les erreurs console et les cases traversées. Le filet de sécurité principal. |
| `measure2.mjs` | Tailles réelles à l'écran du dé, du pion et d'une case. Sert à juger les proportions. |
| `crowd.mjs` | 6 joueurs sur la case START : vérifie que les pions ne débordent pas. |
| `shot-modal.mjs` | Capture la modale d'effet en paysage, pour vérifier que le plateau reste visible derrière. |
| `shot-dice.mjs` | Capture rapprochée du dé. |
| `check-map.mjs` | Sélection d'un plateau introuvable : doit retomber sur le plateau par défaut. |
| `check-cancel.mjs` | Fermer le sélecteur de joueurs sans choisir doit rendre la main, pas figer le tour. |

## Piège à connaître

Pour tester une case précise, remplacer temporairement
`public/data/board-tiles.json` par un parcours court où la case visée est au
début — puis **restaurer le fichier** et confirmer avec
`git diff --stat public/data/board-tiles.json` qu'il est revenu à l'identique.
