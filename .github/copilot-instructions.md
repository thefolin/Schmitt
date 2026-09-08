# Schmitt Odyssée - Instructions pour Agents IA

## Vue d'ensemble du projet
Jeu de plateau interactif (thème mythologie grecque, mécaniques à boire) construit en TypeScript + Vite pur (pas de framework front). Vue "caméra" en pseudo-3D (perspective CSS façon Monopoly GO) avec pan/zoom et physique de dés.

## Points d'entrée (2 seulement)

- `index.html` → `src/camera/main-camera.ts` - Le jeu. Vue caméra pan/zoom, physique des dés 3D, déplacement des pions.
- `index-editor.html` → `src/editor/board-editor.ts` - Éditeur visuel de plateau (drag & drop, export/import JSON).

Il n'y a plus de variantes 2D/3D/legacy : ce sont d'anciennes explorations, supprimées lors du nettoyage de 2026-09.

## Architecture

Une seule architecture, sous `src/features/` :
- `.logic.ts` = logique métier pure, pas de DOM (ex: `game.logic.ts`)
- `.renderer.ts` = UI uniquement (ex: `game.renderer.ts`, `board.renderer.camera.ts`)
- Imports toujours via l'alias `@/` (ex: `@/core/models/Player`, `@/features/game/game.logic`)

## Systèmes clés

### 1. Layout du plateau (le "Schmitt")
Layout basé sur une grille, défini par `BoardLayoutConfig` dans `src/features/board/camera/board-layout.config.ts` :
```typescript
interface BoardLayoutConfig {
  gridRows: number;
  gridCols: number;
  tileSize: number;
  placements: TilePlacement[];  // chaque tuile: quarter/half/full
}
```
- Layout par défaut chargé au démarrage depuis `public/assets/schmitt.json` (fetch `/assets/schmitt.json`)
- Layouts custom : import/export JSON + sauvegarde dans `localStorage['schmitt-board-layouts']`
- Éditeur visuel à `/index-editor.html` pour créer/modifier un layout et l'exporter en JSON

**Point d'attention** : `public/assets/` est le seul dossier servi par Vite (`publicDir`). Un JSON de layout ajouté ailleurs ne sera jamais chargé en prod.

### 2. Configuration des tuiles
23 tuiles principales + pouvoirs des dieux, définis dans `src/features/tiles/tile.config.ts`. Toute modification d'effet de tuile doit être répercutée à la fois dans `tile.config.ts` et dans la logique de `main-camera.ts`.

### 3. Gestion des assets
`src/core/assets/AssetManager.ts` fournit les assets (pions, icônes de tuiles, symboles de pouvoirs, arrière-plans), chargés via `assetManager.loadDefaultAssets()`.

### 4. Dés 3D
`src/features/dice/` - simulation physique (gravité, friction, collisions). ~1400 lignes à date, identifié comme candidat à simplification (comportement à préserver, code à challenger).
```typescript
const diceManager = new DiceManager('boardCamera');
const result = await diceManager.rollNormalDice();
const both = await diceManager.rollBothDice();
```

### 5. État du jeu
`GameLogic` (`src/features/game/game.logic.ts`) : état pur, pas de DOM. Les renderers appellent ces méthodes puis affichent le résultat.

## Pièges courants

1. **Nombre de tuiles** : toujours exactement 23 tuiles principales (indices 0-22)
2. **`assets/` vs `public/assets/`** : seul `public/assets/` est servi ; ne pas recréer de dossier `assets/` racine
3. **Console debugging** : `window.schmittApp` exposé en runtime pour déboguer la vue caméra

## Tests
Aucun test automatisé à date. Tests manuels requis pour la logique des effets de tuiles (notamment les boucles de déplacement avant) et le responsive mobile (`styles/common/mobile-optimized.css`).
