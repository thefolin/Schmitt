# Schmitt Odyssée - Jeu de Plateau Interactif

Bienvenue dans **Schmitt Odyssée**, un jeu de plateau interactif développé avec **TypeScript** et **Vite**. Ce projet propose deux versions : une version 2D Canvas et une version 3D isométrique style Monopoly GO.

**Jouer en ligne** : [Schmitt Odyssée - web](https://thefolin.github.io/Schmitt)

---

## Navigation

### Guides
- [Guide de démarrage](docs/guides/GUIDE-DEMARRAGE.md) - Installation et premier lancement
- [Guide TypeScript](docs/guides/README-TYPESCRIPT.md) - Migration et utilisation TypeScript
- [Guide 3D](docs/guides/GUIDE-3D.md) - Version 3D isométrique
- [Guide Test Mobile](docs/guides/GUIDE-TEST-MOBILE.md) - Tester sur mobile

### Architecture
- [Architecture Features](docs/architecture/ARCHITECTURE-FEATURES.md) - Structure du code
- [Comparaison Architectures](docs/architecture/COMPARAISON-ARCHITECTURES.md) - 2D vs 3D
- [Versions](docs/architecture/VERSIONS.md) - Historique des versions
- [Multiplateforme](docs/architecture/MULTIPLATEFORME.md) - iOS, Android, Web
- [Résumé Migration](docs/architecture/RESUME-MIGRATION.md) - De JS à TypeScript

---

## Versions du jeu

| Version | Description | URL |
|---------|-------------|-----|
| **Vue Caméra** ⭐ | **VERSION PAR DÉFAUT** - Vue 3/4 avec pan/zoom, physique des dés 3D | `http://localhost:3000/` |
| **Éditeur** | Éditeur visuel de plateau (drag & drop) | `http://localhost:3000/index-editor.html` |
| **3D Isométrique** | Style Monopoly GO avec CSS 3D | `http://localhost:3000/index-3d.html` |
| **2D Features** | Version 2D avec layouts personnalisables | `http://localhost:3000/index-new.html` |
| **2D Legacy** | Version classique avec rendu Canvas | `http://localhost:3000/index-legacy.html` |

**Navigation intégrée** :
- Depuis le jeu → Bouton "✏️ Éditeur de plateau" en haut à droite
- Depuis l'éditeur → Bouton "🎮 Retour au jeu" en haut à droite

---

## Installation

### Prérequis
- Node.js 18+
- npm ou yarn

### Étapes

```bash
# Cloner le projet
git clone https://github.com/votre-repo/schmitt-odyssee.git
cd schmitt-odyssee

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

Accédez au jeu : [http://localhost:3000](http://localhost:3000)

---

## Structure du Projet

```
schmitt-odyssee/
├── public/                  # Fichiers HTML
│   ├── index.html           # Version 2D
│   └── index-3d.html        # Version 3D
│
├── src/
│   ├── 2d/                  # Points d'entrée 2D
│   │   ├── main.ts          # Version legacy
│   │   └── main-new.ts      # Version features
│   │
│   ├── 3d/                  # Points d'entrée 3D
│   │   └── main-3d.ts       # Version isométrique
│   │
│   ├── core/                # Logique commune
│   │   ├── models/          # Types et interfaces
│   │   └── assets/          # Gestion des assets
│   │
│   ├── features/            # Features partagées
│   │   ├── board/           # Renderers (2d/3d)
│   │   ├── game/            # Logique et UI
│   │   └── tiles/           # Configuration cases
│   │
│   └── styles/
│       ├── common/          # Styles partagés
│       └── 3d/              # Styles 3D spécifiques
│
├── docs/                    # Documentation
│   ├── guides/              # Guides utilisateur
│   └── architecture/        # Documentation technique
│
└── legacy/                  # Anciens fichiers JS
```

---

## Fonctionnalités

- **Lancer de dés** : Animation et logique de déplacement
- **Plateau interactif** : Cases personnalisées avec effets
- **Gestion des joueurs** : Noms et couleurs personnalisés (2-10 joueurs)
- **Effets de cases** : Bonus, malus, pouvoir Schmitt
- **Version 3D** : Vue isométrique avec particules et animations
- **Mobile-first** : Optimisé pour iPhone et Android

---

## Scripts npm

```bash
npm run dev          # Serveur de développement
npm run build        # Build production
npm run type-check   # Vérification TypeScript
npm run preview      # Preview du build
```

---

## Technologies

- **TypeScript** - Typage statique
- **Vite** - Build tool rapide
- **CSS 3D Transforms** - Rendu 3D performant
- **Canvas API** - Rendu 2D
- **Capacitor** (prévu) - Apps natives iOS/Android

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

## Historique

- **Mars 2025** : Version initiale JavaScript/Phaser
- **Novembre 2025** : Migration TypeScript + Vite
- **Novembre 2025** : Version 3D isométrique style Monopoly GO
- **Novembre 2025** : Réorganisation projet (docs, public, src)

---

## Contribuer

1. Forkez le dépôt
2. Créez une branche : `git checkout -b feature/ma-fonctionnalite`
3. Committez : `git commit -m "feat: ma nouvelle fonctionnalité"`
4. Push : `git push origin feature/ma-fonctionnalite`
5. Ouvrez une Pull Request

---

## Licence

MIT - Libre d'utilisation, modification et partage.

---

## Remerciements

Merci aux contributeurs et à la communauté TypeScript/Vite pour leurs ressources.
