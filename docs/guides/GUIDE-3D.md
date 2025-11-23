# 🎮 Guide Version 3D Isométrique

## ✨ Nouveau rendu style Monopoly GO !

Votre jeu a maintenant un **rendu 3D isométrique** avec CSS 3D transforms :

### 🎯 Caractéristiques

- ✅ **Cases 3D** avec profondeur et ombres
- ✅ **Pions qui "sautent"** entre les cases
- ✅ **Particules dorées** sur les événements spéciaux
- ✅ **Animations fluides** à 60 FPS
- ✅ **0 Ko** de dépendances (CSS pur)
- ✅ **Compatible mobile** (iPhone 5.2" testé)
- ✅ **Architecture features** (logique séparée du rendu)

---

## 🚀 Comment tester

### Ouvrez dans votre navigateur :

```
http://localhost:3000/index-3d.html
```

Le serveur Vite tourne déjà ! Il suffit d'ouvrir cette URL.

---

## 🎨 Effets visuels

### Cases 3D
- **Perspective isométrique** (60° rotateX + 45° rotateZ)
- **6 faces** pour chaque case
- **Couleurs selon le type** :
  - 🏁 Vert = Start
  - 🍺 Rouge = Drink
  - 🎁 Bleu = Give
  - ⚡ Jaune = Power
  - 🏛️ Or = Temple
  - 🏆 Orange = Finish (effet glow animé)

### Pions 3D
- **Sphère avec reflets** (gradient radial)
- **Ombre portée** animée
- **Animation de saut** lors du déplacement
- **Indicateur pouvoir** (⚡ qui pulse)

### Particules
- **20 particules** par événement
- **3 types** :
  - 🟡 Or (temple, victoire)
  - 🔵 Bleu (pouvoir)
  - 🔴 Rouge (boisson)
- **Explosion radiale** en 3D

---

## 📱 Optimisation mobile

### Performance
- **GPU accéléré** (transform3d, will-change)
- **60 FPS** garanti
- **Responsive** : tailles adaptatives selon écran

### Tailles
| Écran | Cases | Pions |
|-------|-------|-------|
| Desktop | 60px | 40px |
| Mobile | 50px | 35px |

---

## 🎮 Utilisation

### Dans le jeu

1. **Lancez le dé** : Le pion saute en 3D vers la nouvelle case
2. **Événement spécial** : Particules explosent
3. **Victoire** : Pluie de particules dorées

### Dans la console

```javascript
// Changer le layout (cercle, carré, spirale)
window.schmittApp.changeLayout('square');
window.schmittApp.changeLayout('spiral');
window.schmittApp.changeLayout('circle');
```

---

## 🏗️ Architecture

### Fichiers créés

```
src/features/board/
├── board.renderer.3d.ts    # Renderer 3D CSS (nouveau)
└── board.renderer.ts        # Renderer 2D Canvas (ancien)

src/styles/
├── board-3d.css             # Styles 3D (nouveau)
└── mobile-optimized.css     # Styles base

src/
├── main-3d.ts               # Point d'entrée 3D (nouveau)
├── main-new.ts              # Point d'entrée 2D features
└── main.ts                  # Point d'entrée ancien (managers)

index-3d.html                # HTML version 3D (nouveau)
index-new.html               # HTML version 2D features
index.html                   # HTML version ancien
```

### Séparation logique/rendu respectée

✅ **Logique** (`game.logic.ts`) - Inchangée
✅ **Rendu 2D** (`board.renderer.ts`) - Canvas
✅ **Rendu 3D** (`board.renderer.3d.ts`) - CSS 3D transforms

---

## 🔄 Comparaison des versions

| Version | Rendu | Fichier | Technologie |
|---------|-------|---------|-------------|
| **Ancienne** | Canvas 2D | [index.html](index.html) | managers/ |
| **Features 2D** | Canvas 2D | [index-new.html](index-new.html) | features/ |
| **Features 3D** | CSS 3D | [index-3d.html](index-3d.html) | features/ + CSS 3D |

---

## 🎯 Prochaines améliorations possibles

### 1. Rotation interactive
```typescript
// Faire tourner le plateau avec le doigt/souris
boardRenderer.rotateBoard(angle);
```

### 2. Zoom pinch
```typescript
// Zoomer avec pinch sur mobile
boardRenderer.setZoom(scale);
```

### 3. Textures personnalisées
```css
/* Ajouter des textures aux cases */
.tile-top {
  background-image: url('/textures/marble.jpg');
}
```

### 4. Sons spatialisés
```typescript
// Son 3D selon la position
soundManager.play3D(position);
```

---

## 🐛 Debug

### Console navigateur

```javascript
// Vérifier le renderer
console.log(window.schmittApp);

// Forcer un rendu
window.schmittApp.updateBoard();
```

### DevTools

- **Performance** : Ouvrez "Performance" et enregistrez
- **Layers** : Vérifiez les couches GPU (Settings > More tools > Layers)
- **3D View** : Chrome > More tools > 3D View

---

## 💡 Astuces

### Tester en mode responsive Chrome

1. F12 → Toggle device toolbar (Cmd+Shift+M)
2. Sélectionnez "iPhone SE"
3. Rafraîchissez la page

### Tester les performances

```javascript
// Dans la console
performance.mark('start');
window.schmittApp.updateBoard();
performance.mark('end');
performance.measure('render', 'start', 'end');
console.log(performance.getEntriesByType('measure'));
```

---

## 🎨 Personnalisation CSS

### Changer la perspective

```css
.board-3d-scene {
  perspective: 800px;  /* Plus proche = plus prononcé */
}
```

### Modifier la rotation isométrique

```css
.tile-3d {
  transform: rotateX(45deg) rotateZ(30deg);  /* Angle custom */
}
```

### Ajuster les ombres

```css
.tile-top {
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);  /* Ombre plus forte */
}
```

---

## ✅ Compatible multiplateforme

Cette version **CSS 3D** fonctionne sur :

- ✅ **Web** (Chrome, Firefox, Safari)
- ✅ **iOS** (Safari, WebView)
- ✅ **Android** (Chrome, WebView)
- ✅ **Capacitor** (compile en app native)

Aucun changement nécessaire pour Capacitor !

---

**Profitez de votre jeu en 3D ! 🎮✨**

Pour toute question, consultez :
- [ARCHITECTURE-FEATURES.md](ARCHITECTURE-FEATURES.md)
- [COMPARAISON-ARCHITECTURES.md](COMPARAISON-ARCHITECTURES.md)
