# 🏗️ Architecture Features-Based

## 📁 Nouvelle structure

```
src/
├── features/                    # Organisation par fonctionnalités
│   ├── game/
│   │   ├── game.logic.ts       # ✅ Logique métier PURE (état, règles)
│   │   └── game.renderer.ts    # 🎨 Rendu visuel (DOM, modales)
│   │
│   ├── board/
│   │   ├── board.renderer.ts   # 🎨 Rendu du plateau (canvas)
│   │   └── board.layouts.ts    # 📐 Layouts customisables (cercle, carré, spirale)
│   │
│   ├── player/
│   │   └── (future)            # Logique et rendu des joueurs
│   │
│   ├── tiles/
│   │   └── tile.config.ts      # ⚙️ Configuration des cases (FACILEMENT MODIFIABLE)
│   │
│   └── ui/
│       └── (future)            # Composants UI réutilisables
│
├── core/                        # Code partagé
│   ├── models/                  # Types/interfaces TypeScript
│   │   ├── Player.ts
│   │   ├── Tile.ts
│   │   └── GameState.ts
│   │
│   ├── assets/                  # Système d'assets customisables
│   │   └── AssetManager.ts     # 🖼️ Gère images/emojis des pions et cases
│   │
│   └── utils/                   # Helpers
│
├── styles/
│   └── mobile-optimized.css    # Styles
│
├── main.ts                      # Point d'entrée ACTUEL (ancien système)
└── main-new.ts                  # Point d'entrée NOUVEAU (features-based)
```

---

## 🎯 Principes de séparation

### 1. **Logique métier** (`.logic.ts`)
- Code **PUR TypeScript**
- **Aucune dépendance** au DOM ou Canvas
- Gère uniquement l'**état** et les **règles du jeu**
- Testable unitairement facilement

**Exemple : `game.logic.ts`**
```typescript
public rollDice(): number {
  const roll = Math.floor(Math.random() * 6) + 1;
  this.lastDiceRoll = roll;
  return roll; // Pas de rendu, juste la logique
}
```

### 2. **Rendu visuel** (`.renderer.ts`)
- Code **UI/Canvas**
- Reçoit les données de la logique métier
- S'occupe uniquement de l'**affichage**

**Exemple : `game.renderer.ts`**
```typescript
public showDiceResult(value: number): void {
  const diceElement = document.getElementById('diceResult');
  diceElement.textContent = `🎲 ${value}`;
}
```

### 3. **Configuration** (`.config.ts`)
- Fichiers de configuration **facilement modifiables**
- Pas de logique complexe
- Juste des **données**

**Exemple : `tile.config.ts`**
```typescript
export const TILE_CONFIGS: TileConfig[] = [
  { type: 'start', icon: '🏁', name: 'START' },
  { type: 'drink_2', icon: '🍺', name: 'BOIS 2' },
  // Facile à modifier !
];
```

---

## 🚀 Utilisation

### Lancer l'ancienne version (main.ts)
```bash
npm run dev
# Utilise src/main.ts (ancien système avec managers/)
```

### Lancer la nouvelle version (main-new.ts)
Modifiez `index.html` ligne 73 :
```html
<!-- Ancien -->
<script type="module" src="/src/main.ts"></script>

<!-- Nouveau -->
<script type="module" src="/src/main-new.ts"></script>
```

Puis :
```bash
npm run dev
```

---

## 🎨 Customisation facile

### 1. Changer le layout du plateau

```typescript
// Dans la console du navigateur
window.schmittApp.changeLayout('square');   // Plateau carré
window.schmittApp.changeLayout('spiral');   // Spirale
window.schmittApp.changeLayout('circle');   // Cercle (par défaut)
```

### 2. Modifier les icônes des cases

**Fichier : `src/features/tiles/tile.config.ts`**
```typescript
{
  type: 'drink_2',
  icon: '🍺',  // Changez ici ! (emoji ou laissez vide pour image)
  name: 'BOIS 2',
  description: 'Tu bois 2 gorgées'
}
```

### 3. Remplacer un emoji par une image

```typescript
import { assetManager } from './core/assets/AssetManager';

// Remplacer l'emoji par une image custom
assetManager.replaceAsset('tile-drink', '/images/beer-custom.png', 'image');
```

### 4. Ajouter un nouveau layout

**Fichier : `src/features/board/board.layouts.ts`**
```typescript
export class HexagonLayout implements BoardLayout {
  name = 'Hexagone';
  type: LayoutType = 'custom';

  calculatePositions(...) {
    // Votre logique de positionnement hexagonal
  }
}

// Enregistrer
LayoutFactory.layouts.set('hexagon', new HexagonLayout());
```

---

## 📦 Avantages de cette architecture

| Aspect | Avant (managers/) | Après (features/) |
|--------|-------------------|-------------------|
| **Séparation** | ❌ Logique + UI mélangées | ✅ Séparées clairement |
| **Testabilité** | ⚠️ Difficile (dépend du DOM) | ✅ Facile (logique pure) |
| **Customisation** | ⚠️ Modifier le code partout | ✅ Fichiers de config dédiés |
| **Layouts** | ❌ Cercle hardcodé | ✅ Multiple layouts disponibles |
| **Assets** | ❌ Emojis hardcodés | ✅ Système d'assets flexible |
| **Organisation** | ⚠️ Par type (managers, models) | ✅ Par fonctionnalité |

---

## 🔮 Évolutions futures

### Ajouter des images personnalisées pour les pions
```typescript
// Dans main-new.ts, après init()
assetManager.registerAsset({
  id: 'pawn-player1',
  type: 'pawn',
  source: 'image',
  value: '/assets/pawns/knight.png'
});
```

### Créer un éditeur de plateau visuel
- Drag & drop des cases
- Positionnement custom
- Export/import de layouts

### Mode multijoueur en ligne
- La logique métier est déjà séparée
- Facile d'ajouter une couche réseau

---

## 🆚 Comparaison des fichiers

| Ancien système | Nouveau système | Différence |
|----------------|-----------------|------------|
| `src/managers/GameManager.ts` | `src/features/game/game.logic.ts` | Logique pure seulement |
| `src/managers/UIManager.ts` | `src/features/game/game.renderer.ts` | Rendu seulement |
| `src/managers/BoardManager.ts` | `src/features/board/board.renderer.ts` | Rendu canvas |
| ❌ N/A | `src/features/board/board.layouts.ts` | **NOUVEAU** : Layouts multiples |
| ❌ N/A | `src/core/assets/AssetManager.ts` | **NOUVEAU** : Gestion assets |
| `src/utils/constants.ts` | `src/features/tiles/tile.config.ts` | Config externalisée |

---

## 📝 Prochaines étapes

1. **Tester** la nouvelle architecture (`main-new.ts`)
2. **Migrer** progressivement les anciennes fonctionnalités
3. **Supprimer** `src/managers/` une fois la migration terminée
4. **Ajouter** vos images personnalisées
5. **Créer** de nouveaux layouts custom

---

**Votre code est maintenant :**
- ✅ **Modulaire** (features séparées)
- ✅ **Testable** (logique pure)
- ✅ **Customisable** (config externalisée)
- ✅ **Extensible** (layouts, assets, etc.)

🎮 **Bon développement !**
