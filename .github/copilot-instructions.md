# Schmitt Odyssée - Instructions pour Agents IA

## Vue d'ensemble du projet
Jeu de plateau interactif avec plusieurs modes de rendu (2D Canvas, 3D isométrique, vue Caméra) construit avec TypeScript + Vite. Le jeu utilise un thème de mythologie grecque avec des mécaniques de jeu à boire.

## Philosophie d'architecture

### Système d'architecture double
Cette base de code possède **deux architectures parallèles** (transition en cours) :

1. **Legacy Managers** (`src/managers/`) - Architecture monolithique originale
   - Utilisée par : `index.html` → `src/2d/main.ts`
   - Mélange logique métier et rendu
   - Imports : `@models/*`, `@managers/*`, `@utils/*`

2. **Features-Based** (`src/features/`) - Séparation moderne des responsabilités
   - Utilisée par : `index-new.html`, `index-3d.html`, `index-camera.html`
   - **Pattern critique** : Séparation logique/rendu dans `.logic.ts` et `.renderer.ts`
   - Exemple : `game.logic.ts` (TypeScript pur, pas de DOM) + `game.renderer.ts` (UI uniquement)
   - Imports : Préfixe `@/` pour tous les chemins

### Variantes de rendu
Le jeu possède **4 points d'entrée différents** avec une logique centrale partagée mais des renderers différents :

- `index.html` → `src/2d/main.ts` - Legacy 2D Canvas (disposition circulaire)
- `index-new.html` → `src/2d/main-new.ts` - Features-based 2D (layouts personnalisables)
- `index-3d.html` → `src/3d/main-3d.ts` - 3D isométrique (CSS 3D transforms, style Monopoly GO)
- `index-camera.html` → `src/camera/main-camera.ts` - Vue caméra avec pan/zoom, physique des dés 3D
- `index-editor.html` → `src/editor/board-editor.ts` - Éditeur visuel de plateau

**Pattern clé** : Chaque point d'entrée instancie `GameLogic` (pure) + renderer spécifique à la variante (ex: `BoardCameraRenderer`, `Board3DRenderer`).

## Alias de chemins critiques

Configurés dans `vite.config.ts` et `tsconfig.json` :
```typescript
@/          → ./src/
@models/*   → ./src/models/*      (legacy uniquement)
@managers/* → ./src/managers/*    (legacy uniquement)
@utils/*    → ./src/utils/*       (legacy uniquement)
```

**En travaillant dans le code features-based** : Toujours utiliser les imports `@/` (ex: `@/core/models/Player`, `@/features/game/game.logic`).

## Workflow de développement

### Commandes
```bash
npm run dev          # Serveur de dev sur localhost:3000
npm run build        # Compilation TypeScript + build Vite
npm run type-check   # Validation TypeScript sans build
npm run preview      # Prévisualiser le build de production
```

### Configuration Multi-Entry Vite
Vite build les 4 points d'entrée HTML simultanément. Lors de l'ajout de fonctionnalités, considérer quels renderers nécessitent des mises à jour :
- Changements de logique centrale → mettre à jour `src/features/game/game.logic.ts`
- Spécifique 2D → `src/features/board/2d/board.renderer.ts`
- Spécifique 3D → `src/features/board/3d/board.renderer.3d.ts`
- Spécifique Caméra → `src/features/board/camera/board.renderer.camera.ts`

## Systèmes clés

### 1. Système de layout du plateau
**Hautement personnalisable** - Layouts basés sur grille définis dans `src/features/board/camera/board-layout.config.ts` :
```typescript
interface BoardLayoutConfig {
  gridRows: number;
  gridCols: number;
  tileSize: number;
  placements: TilePlacement[];  // Chaque tuile peut être de taille quarter/half/full
}
```
- La vue caméra utilise un layout serpentin en grille avec tuiles de tailles variables
- 2D/3D utilisent des layouts algorithmiques (cercle, carré, spirale) depuis `board.layouts.ts`
- Éditeur visuel disponible à `/index-editor.html` pour conception de layout en drag-drop

### 2. Configuration des tuiles
Le jeu possède exactement **23 tuiles** + **10 pouvoirs des dieux** définis dans `src/features/tiles/tile.config.ts` :
```typescript
export const TILE_CONFIGS: TileConfig[] = [
  { type: 'start', icon: '🏁', name: 'START', description: '...', image: 'assets/start.png' },
  { type: 'forward_2', icon: '⏩', name: 'AVANCEZ DE 2 CASES', ... },
  // ... toutes les tuiles doivent être configurées ici
];
```
**Important** : Lors de la modification des effets de tuiles, mettre à jour à la fois `tile.config.ts` ET la logique correspondante dans `game.logic.ts` ou `main-camera.ts` (la caméra a une logique de tuiles plus avancée).

### 3. Gestion des assets
`src/core/assets/AssetManager.ts` fournit des assets personnalisables (emojis, images, SVG) pour :
- Pions des joueurs
- Icônes des tuiles
- Symboles des pouvoirs
- Arrière-plans

Assets par défaut chargés via `assetManager.loadDefaultAssets()` dans chaque point d'entrée.

### 4. Physique des dés 3D (Vue caméra uniquement)
`src/features/dice/` - Simulation physique complète avec gravité, friction, collisions :
```typescript
const diceManager = new DiceManager('boardCamera');
const result = await diceManager.rollNormalDice();  // Retourne 1-6
const both = await diceManager.rollBothDice();      // Dé normal + dé pouvoir des dieux
```
Presets configurables : `THROW_PRESETS.gentle`, `.normal`, `.strong`.

### 5. Gestion de l'état du jeu
État pur dans la classe `GameLogic` (`src/features/game/game.logic.ts`) :
- Pas de dépendances au DOM - juste des transformations de données
- Méthodes comme `rollDice()`, `movePlayer()`, `addDrinks()` retournent des valeurs au lieu de faire du rendu
- Les renderers s'abonnent aux changements d'état en appelant ces méthodes puis affichent les résultats

## Patterns spécifiques au projet

### Séparation Logique/Renderer
Lors de l'ajout de fonctionnalités, TOUJOURS séparer les responsabilités :
```typescript
// game.logic.ts - Logique métier pure
public rollDice(): number {
  const roll = Math.floor(Math.random() * 6) + 1;
  this.lastDiceRoll = roll;
  return roll;  // Pas de rendu !
}

// game.renderer.ts - UI uniquement
public showDiceResult(value: number): void {
  document.getElementById('diceResult').textContent = `🎲 ${value}`;
}
```

### Implémentation des effets de tuiles
La vue caméra possède des effets de tuiles complexes dans `main-camera.ts` (lignes 400-1000+) incluant :
- Déplacement vers l'avant avec prévention de boucles (compteur `consecutiveForwardMoves`)
- Lancer de dés pour pouvoir des dieux (flag `isRollingForGodPower`)
- Mécanique du bouclier d'Athéna (`hasAthenaShield`)
- Système de rejeu (`canReplay`)

Lors de la modification des effets de tuiles, vérifier d'abord l'implémentation caméra - c'est la plus complète.

### Fichiers de données
- `public/data/power.json` - Configuration des pouvoirs des dieux (10 pouvoirs)
- `data/board-layout.json` - Configurations de layout sauvegardées
- `assets/*.json` - Variations de layout historiques

## Pièges courants

1. **Imports de chemins** : Le code features utilise `@/`, le legacy utilise `@models`, `@managers`, `@utils` - ne pas les mélanger
2. **Points d'entrée multiples** : Les changements de logique partagée nécessitent de tester les 4 vues
3. **Nombre de tuiles** : Toujours exactement 23 tuiles principales (indices 0-22)
4. **Caméra vs 2D/3D** : La vue caméra possède des fonctionnalités significativement plus avancées (physique des dés, déplacement manuel, sélecteur de joueur)
5. **Console debugging** : L'app caméra expose `window.schmittApp` pour le débogage en runtime

## Documentation
Documentation extensive dans `/docs/` :
- `guides/GUIDE-3D.md` - Détails de l'implémentation 3D
- `architecture/ARCHITECTURE-FEATURES.md` - Explication de l'architecture features-based
- `architecture/COMPARAISON-ARCHITECTURES.md` - Comparaison Legacy vs Features

## Tests
Actuellement **aucun test automatisé**. Tests manuels requis pour :
- Les 4 points d'entrée après les changements centraux
- Logique des effets de tuiles (surtout les boucles de déplacement avant)
- Responsive mobile (`styles/common/mobile-optimized.css`)
