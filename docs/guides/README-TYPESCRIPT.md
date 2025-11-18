# 🏛️ Schmitt Odyssée - Version TypeScript

Version restructurée en TypeScript avec architecture modulaire moderne.

## 📁 Structure du projet

```
jeux-schimit-2025/
├── src/
│   ├── main.ts                 # Point d'entrée de l'application
│   ├── models/                 # Modèles de données TypeScript
│   │   ├── Player.ts           # Modèle de joueur
│   │   ├── Tile.ts             # Modèle de case
│   │   └── GameState.ts        # État global du jeu
│   ├── managers/               # Gestionnaires de logique métier
│   │   ├── GameManager.ts      # Logique principale du jeu
│   │   ├── SoundManager.ts     # Gestion des sons
│   │   ├── UIManager.ts        # Gestion de l'interface
│   │   └── BoardManager.ts     # Gestion du plateau
│   ├── utils/                  # Utilitaires
│   │   ├── constants.ts        # Constantes du jeu
│   │   └── helpers.ts          # Fonctions utilitaires
│   └── styles/                 # Styles CSS
│       └── main.css
├── public/                     # Assets publics
│   ├── assets/                 # Images des cases
│   └── data/
│       └── power.json          # Configuration des cases
├── index.html                  # HTML minimal
├── package.json
├── tsconfig.json               # Configuration TypeScript
└── vite.config.ts              # Configuration Vite

```

## 🚀 Commandes disponibles

### Développement
```bash
npm run dev
```
Lance le serveur de développement sur [http://localhost:3000](http://localhost:3000)

### Build production
```bash
npm run build
```
Compile le projet TypeScript et crée un build optimisé dans `dist/`

### Preview du build
```bash
npm run preview
```
Prévisualise le build de production

### Vérification TypeScript
```bash
npm run type-check
```
Vérifie les types TypeScript sans compiler

## 🎯 Avantages de cette architecture

### ✅ Code organisé et maintenable
- **Séparation des responsabilités** : Chaque fichier a un rôle clair
- **Modularité** : Les modules sont indépendants et réutilisables
- **Lisibilité** : Code structuré et bien commenté

### ✅ TypeScript pour la sécurité
- **Typage fort** : Évite les erreurs à la compilation
- **Autocomplétion** : Meilleure expérience de développement
- **Refactoring sûr** : Les erreurs sont détectées immédiatement

### ✅ Performance optimale
- **Vite** : Build ultra-rapide avec HMR (Hot Module Replacement)
- **Tree-shaking** : Code mort automatiquement supprimé
- **Optimisation automatique** : Minification, compression, etc.

### ✅ Prêt pour le multiplateforme

Le code est maintenant structuré pour supporter :
- **Web** : Déjà fonctionnel
- **Mobile** : Via Capacitor (iOS/Android)
- **Desktop** : Via Electron ou Capacitor

## 📦 Prochaines étapes : Capacitor (Mobile/Desktop)

Pour rendre le jeu multiplateforme, nous pouvons ajouter Capacitor :

```bash
# Installation de Capacitor
npm install @capacitor/core @capacitor/cli
npx cap init

# Ajouter les plateformes
npm install @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android

# Build et sync
npm run build
npx cap sync
npx cap open ios      # Ouvre Xcode
npx cap open android  # Ouvre Android Studio
```

## 🎮 Fonctionnalités du jeu

- ✅ Plateau de 23 cases avec effets variés
- ✅ Système de joueurs (2-10 joueurs)
- ✅ Lancer de dés avec animation
- ✅ Déplacement automatique des pions
- ✅ Effets de cases interactifs
- ✅ Mode retour (Pouvoir du Schmitt)
- ✅ Historique des actions
- ✅ Sons et effets sonores
- ✅ Écran de victoire avec statistiques
- ✅ Interface responsive (mobile/tablette/desktop)

## 🛠️ Technologies utilisées

- **TypeScript** - Langage typé
- **Vite** - Build tool moderne
- **Canvas API** - Rendu du plateau de jeu
- **Web Audio API** - Sons du jeu
- **CSS3** - Animations et styles modernes

## 📝 Notes de développement

### Alias de chemins
Le projet utilise des alias TypeScript pour faciliter les imports :
- `@/` → `src/`
- `@models/` → `src/models/`
- `@managers/` → `src/managers/`
- `@utils/` → `src/utils/`

Exemple :
```typescript
import { Player } from '@models/Player';
import { GameManager } from '@managers/GameManager';
```

### Anciens fichiers
Les anciens fichiers ont été conservés pour référence :
- `index-old.html` : Ancienne version standalone
- `game.js` : Ancienne version avec Phaser
- `tileEffects.js`, `utils.js` : Anciens modules JavaScript

## 🐛 Résolution de problèmes

### Le serveur ne démarre pas
```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Erreurs TypeScript
```bash
npm run type-check
```

### Build échoue
Vérifiez que tous les chemins d'assets sont corrects dans `public/`

## 📚 Ressources

- [Documentation Vite](https://vitejs.dev/)
- [Documentation TypeScript](https://www.typescriptlang.org/)
- [Documentation Capacitor](https://capacitorjs.com/)

---

**Développé avec ❤️ et TypeScript**
