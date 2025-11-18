# 🔄 Comparaison des deux architectures

Vous avez maintenant **DEUX versions** de votre jeu :

## Version 1 : Architecture Managers (actuelle)
📄 **Fichier** : [index.html](index.html) → [src/main.ts](src/main.ts)

```
src/managers/
├── GameManager.ts    # Logique + UI mélangées
├── BoardManager.ts   # Rendu canvas
├── SoundManager.ts   # Sons
└── UIManager.ts      # UI DOM
```

✅ **Avantages** :
- Fonctionne déjà
- Code testé et stable

⚠️ **Limites** :
- Logique métier et UI mélangées
- Difficile à tester
- Layout cercle hardcodé
- Assets non customisables

---

## Version 2 : Architecture Features (nouvelle)
📄 **Fichier** : [index-new.html](index-new.html) → [src/main-new.ts](src/main-new.ts)

```
src/features/
├── game/
│   ├── game.logic.ts      # ✅ Logique PURE (testable)
│   └── game.renderer.ts   # 🎨 Rendu séparé
├── board/
│   ├── board.renderer.ts  # 🎨 Rendu canvas
│   └── board.layouts.ts   # 📐 Cercle, carré, spirale, custom
├── tiles/
│   └── tile.config.ts     # ⚙️ Config externe
└── ...

src/core/
├── models/               # Types
└── assets/
    └── AssetManager.ts   # 🖼️ Images customisables
```

✅ **Avantages** :
- **Séparation** logique/rendu
- **Testable** (logique pure)
- **Customisable** (layouts, assets)
- **Extensible** facilement

---

## 🧪 Comment tester la nouvelle version ?

### Option 1 : Ouvrir index-new.html

```bash
# Le serveur Vite tourne déjà
# Ouvrez dans votre navigateur :
http://localhost:3000/index-new.html
```

### Option 2 : Remplacer temporairement

```bash
# Renommer l'ancien
mv index.html index-old.html

# Activer le nouveau
mv index-new.html index.html

# Relancer
npm run dev
```

---

## 📊 Exemples de customisation (nouvelle version)

### 1. Changer le layout du plateau

Ouvrez la console JavaScript du navigateur et tapez :

```javascript
// Changer en plateau carré
window.schmittApp.changeLayout('square');

// Changer en spirale
window.schmittApp.changeLayout('spiral');

// Retour au cercle
window.schmittApp.changeLayout('circle');
```

### 2. Modifier les icônes des cases

**Fichier** : [src/features/tiles/tile.config.ts](src/features/tiles/tile.config.ts)

```typescript
{
  type: 'drink_2',
  icon: '🍻',  // Changez ici !
  name: 'BOIS 2 FOIS',
  description: 'Double dose !'
}
```

### 3. Remplacer un emoji par une image

```javascript
// Dans la console
assetManager.replaceAsset(
  'tile-drink',
  '/images/beer.png',
  'image'
);
```

---

## 🎯 Prochaines étapes

1. **Tester** la nouvelle version sur [http://localhost:3000/index-new.html](http://localhost:3000/index-new.html)
2. **Vérifier** que tout fonctionne
3. **Comparer** les deux versions
4. **Choisir** celle que vous préférez
5. Si vous aimez la nouvelle :
   - Migrer les fonctionnalités manquantes
   - Supprimer `src/managers/`
   - Renommer `index-new.html` → `index.html`

---

## 🗂️ Structure complète créée

```
src/
├── features/                    ✅ NOUVEAU
│   ├── game/
│   │   ├── game.logic.ts
│   │   └── game.renderer.ts
│   ├── board/
│   │   ├── board.renderer.ts
│   │   └── board.layouts.ts
│   └── tiles/
│       └── tile.config.ts
│
├── core/                        ✅ NOUVEAU
│   ├── models/
│   │   ├── Player.ts
│   │   ├── Tile.ts
│   │   └── GameState.ts
│   ├── assets/
│   │   └── AssetManager.ts
│   └── utils/
│
├── managers/                    📦 ANCIEN (gardé)
│   ├── GameManager.ts
│   ├── BoardManager.ts
│   ├── SoundManager.ts
│   └── UIManager.ts
│
├── main.ts                      📦 ANCIEN
├── main-new.ts                  ✅ NOUVEAU
└── styles/
    └── mobile-optimized.css
```

---

## 💡 Conseil

Gardez les deux versions en parallèle pendant que vous testez.
Une fois satisfait de la nouvelle architecture, vous pourrez :
- Supprimer `src/managers/`
- Renommer `main-new.ts` → `main.ts`
- Profiter de la nouvelle structure modulaire !

---

**Documentation complète** : [ARCHITECTURE-FEATURES.md](ARCHITECTURE-FEATURES.md)
