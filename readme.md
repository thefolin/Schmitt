# Schmitt Odyssée - Jeu de Plateau Interactif

Bienvenue dans **Schmitt Odyssée**, un jeu de plateau interactif développé en **TypeScript vanilla** (pas de framework front) avec **Vite**. Vue pseudo-3D en perspective CSS façon Monopoly GO.

**Jouer en ligne** : [Schmitt Odyssée - web](https://thefolin.github.io/Schmitt)

---

## Versions du jeu

| Version | Description | URL |
|---------|-------------|-----|
| **Jeu** ⭐ | Vue caméra 3/4 avec pan/zoom, physique des dés 3D | `http://localhost:3000/` |
| **Éditeur** | Éditeur visuel de plateau (drag & drop, export/import JSON) | `http://localhost:3000/index-editor.html` |

Navigation intégrée entre les deux (bouton "Éditeur de plateau" dans le jeu, bouton "Retour au jeu" dans l'éditeur).

---

## Installation

### Prérequis
- Node.js 18+
- npm

### Étapes

```bash
git clone https://github.com/thefolin/Schmitt.git
cd Schmitt
npm install
npm run dev
```

Accédez au jeu : [http://localhost:3000](http://localhost:3000)

---

## Structure du Projet

```
schmitt-odyssee/
├── index.html               # Point d'entrée du jeu
├── index-editor.html        # Point d'entrée de l'éditeur
│
├── public/
│   └── assets/               # Images de tuiles + schmitt.json (layout par défaut)
│
├── src/
│   ├── camera/main-camera.ts        # Point d'entrée du jeu (vue caméra)
│   ├── editor/board-editor.ts       # Point d'entrée de l'éditeur
│   │
│   ├── core/
│   │   ├── models/           # Types (Player, Tile)
│   │   └── assets/           # AssetManager
│   │
│   ├── features/
│   │   ├── board/camera/     # Layout, rendu de plateau, caméra pan/zoom
│   │   ├── dice/              # Physique des dés 3D
│   │   ├── game/              # Logique de jeu, rendu, sélection joueurs, déplacement manuel
│   │   └── tiles/             # Configuration des tuiles (effets, icônes)
│   │
│   └── styles/
│       ├── common/
│       ├── camera/
│       └── game/
│
└── docs/                     # Guides (déploiement, mobile)
```

Le layout du plateau ("le Schmitt") est un JSON de grille (`public/assets/schmitt.json`), éditable visuellement dans l'éditeur et exportable/importable en JSON — ce mécanisme permet de créer facilement de nouvelles variantes de plateau sans toucher au code.

---

## Fonctionnalités

- **Lancer de dés** : physique 3D (gravité, friction, collisions)
- **Plateau interactif** : cases personnalisées avec effets, layout JSON éditable
- **Gestion des joueurs** : noms et couleurs personnalisés (2-10 joueurs)
- **Effets de cases** : bonus, malus, pouvoir Schmitt
- **Déplacement manuel** des pions
- **Mobile** : Capacitor (Android/iOS)

---

## Scripts npm

```bash
npm run dev          # Serveur de développement
npm run build        # Build production (jeu + éditeur)
npm run type-check   # Vérification TypeScript
npm run preview      # Preview du build
npm run android:dev  # Build + sync + run sur Android (Capacitor)
npm run ios:dev      # Build + sync + run sur iOS (Capacitor)
npm test             # Tests unitaires (Vitest)
```

Voir `docs/` pour les guides de déploiement mobile détaillés.

### Vérification en navigateur réel

En plus des tests unitaires, `tools/test-drive/` contient des scripts qui
pilotent un vrai Chrome sans fenêtre : ils jouent une partie complète,
mesurent les tailles à l'écran et prennent des captures. Ils servent à
trouver ce que les tests unitaires ne voient pas — un bouton invisible, une
animation avalée, un tour qui se fige.

**Playwright n'est volontairement pas une dépendance du projet** : il
télécharge un navigateur complet (~1,1 Go, dans un cache global de la
machine). L'ajouter à `package.json` ferait payer ce téléchargement à tout
clone du projet, pour un outil qui ne sert qu'au diagnostic ponctuel.

Pour s'en servir, l'installer une fois :

```bash
npm install --no-save playwright && npx playwright install chromium
npx vite --port 5179                  # dans un terminal
node tools/test-drive/full2.mjs       # dans un autre
```

Détail des scripts : `tools/test-drive/README.md`.

---

## Technologies

- **TypeScript** vanilla — pas de framework front
- **Vite** — build tool
- **CSS 3D Transforms** — rendu pseudo-3D façon Monopoly GO
- **Capacitor** — apps natives iOS/Android

---

## Règles du Jeu

La partie se joue en **deux phases** :

1. **L'aller** — chaque joueur lance 1 dé, avance et applique l'effet de sa
   case. Le but est d'atteindre la dernière case **par une valeur exacte** :
   un jet trop grand fait reculer du surplus. Le premier à y parvenir
   s'empare du **pouvoir du Schmitt**, dont il reste l'unique porteur.
2. **Le retour** — dès que le pouvoir est pris, tous les pions font
   demi-tour. La victoire revient au premier joueur qui **revient exactement
   sur START**.

Atteindre la dernière case ne fait donc pas gagner : ce n'est que la moitié
du voyage.

Quelques cases notables :

- **PETIT POULET** — vous devenez le Poulet et buvez 1 gorgée à chaque 3 ou 6
  de n'importe quel joueur. Y retomber vous promeut **GROS POULET** : vous
  distribuez au lieu de boire.
- **SCHMITT !!!** — le dernier à crier boit 1 gorgée par joueur présent sur
  la case.
- **FAVEUR DES DIEUX** — lancez 2 dés et consultez la faveur correspondante.
  Un double déclenche la **colère des dieux** : pas de faveur, et 1 cul sec.

Règles complètes : [Schmitt Odyssée](https://unoff31.wixsite.com/schmittodyssee)

---

## Contribuer

1. Créez une branche : `git checkout -b feature/ma-fonctionnalite`
2. Committez : `git commit -m "feat: ma nouvelle fonctionnalité"`
3. Push : `git push origin feature/ma-fonctionnalite`
4. Ouvrez une Pull Request

---

## Licence

MIT - Libre d'utilisation, modification et partage.
