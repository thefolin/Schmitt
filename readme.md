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
```

Voir `docs/` pour les guides de déploiement mobile détaillés.

---

## Technologies

- **TypeScript** vanilla — pas de framework front
- **Vite** — build tool
- **CSS 3D Transforms** — rendu pseudo-3D façon Monopoly GO
- **Capacitor** — apps natives iOS/Android

---

## Règles du Jeu

1. Chaque joueur lance un dé à son tour
2. Avancez sur le plateau selon le résultat
3. Respectez les effets des cases spéciales :
   - **START** : Point de départ
   - **FINISH** : Arrivée (premier joueur gagne)
   - **Boire X** : Boire des gorgées
   - **Pouvoir Schmitt** : Avantage spécial
   - **Rejouer** : Relancer le dé
4. Le premier joueur à atteindre la case finale gagne

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
