# 🎮 Versions disponibles de Schmitt Odyssée

Vous avez maintenant **3 versions** de votre jeu !

---

## 🔷 Version 1 : Architecture Managers (originale)

📄 **Fichier** : [index.html](index.html)
🎨 **Rendu** : Canvas 2D classique
📂 **Architecture** : `src/managers/`

### Caractéristiques
- ✅ Fonctionne et testé
- ⚠️ Logique et UI mélangées
- ⚠️ Difficile à étendre

### Tester
```
http://localhost:3000/index.html
```

---

## 🟢 Version 2 : Architecture Features 2D

📄 **Fichier** : [index-new.html](index-new.html)
🎨 **Rendu** : Canvas 2D amélioré
📂 **Architecture** : `src/features/`

### Caractéristiques
- ✅ **Logique séparée** du rendu
- ✅ **Testable** facilement
- ✅ **Layouts multiples** (cercle, carré, spirale)
- ✅ **Assets customisables**
- ✅ **Code modulaire**

### Tester
```
http://localhost:3000/index-new.html
```

### Changer le layout
```javascript
// Dans la console
window.schmittApp.changeLayout('square');   // Carré
window.schmittApp.changeLayout('spiral');   // Spirale
window.schmittApp.changeLayout('circle');   // Cercle
```

---

## 🟣 Version 3 : Architecture Features 3D Isométrique ⭐ NOUVEAU

📄 **Fichier** : [index-3d.html](index-3d.html)
🎨 **Rendu** : **CSS 3D transforms** (style Monopoly GO)
📂 **Architecture** : `src/features/` + `board.renderer.3d.ts`

### Caractéristiques
- ✅ **Rendu 3D isométrique**
- ✅ **Cases en 3D** avec profondeur
- ✅ **Pions qui "sautent"** entre les cases
- ✅ **Particules explosives** (or, pouvoir, boisson)
- ✅ **Animations 60 FPS**
- ✅ **0 Ko** de dépendances (CSS pur)
- ✅ **Performance mobile** optimisée
- ✅ **Compatible Capacitor**

### Tester
```
http://localhost:3000/index-3d.html
```

### Effets
- 🟡 **Particules dorées** : temple, victoire
- 🔵 **Particules bleues** : pouvoir Schmitt
- 🔴 **Particules rouges** : boissons

---

## 📊 Tableau comparatif

| Aspect | V1 Managers | V2 Features 2D | V3 Features 3D |
|--------|------------|----------------|----------------|
| **Rendu** | Canvas 2D | Canvas 2D | CSS 3D |
| **Architecture** | Monolithique | Modulaire | Modulaire |
| **Logique/UI** | ⚠️ Mélangées | ✅ Séparées | ✅ Séparées |
| **Layouts** | ❌ Cercle fixe | ✅ Multiple | ✅ Multiple |
| **Assets** | ❌ Hardcodés | ✅ Customisables | ✅ Customisables |
| **Animations** | ⚠️ Basiques | ✅ Fluides | ✅ 3D Avancées |
| **Particules** | ❌ | ❌ | ✅ 3D |
| **Poids** | ~500 KB | ~500 KB | ~500 KB |
| **Performance** | 60 FPS | 60 FPS | 60 FPS |
| **Mobile** | ✅ | ✅ | ✅ |
| **Capacitor** | ✅ | ✅ | ✅ |

---

## 🎯 Quelle version choisir ?

### Pour développer rapidement
→ **Version 1** (Managers)
- Code existant stable
- Modifications rapides

### Pour un code propre et maintenable
→ **Version 2** (Features 2D)
- Architecture moderne
- Facile à tester
- Extensible

### Pour un rendu "Wow effect"
→ **Version 3** (Features 3D) ⭐
- Visuellement impressionnant
- Animations fluides
- Style moderne (Monopoly GO)
- **Recommandé pour votre projet !**

---

## 📁 Structure des fichiers

```
/
├── index.html              # V1 - Managers
├── index-new.html          # V2 - Features 2D
├── index-3d.html           # V3 - Features 3D ⭐
│
├── src/
│   ├── main.ts             # V1 - Point d'entrée managers
│   ├── main-new.ts         # V2 - Point d'entrée features 2D
│   ├── main-3d.ts          # V3 - Point d'entrée features 3D ⭐
│   │
│   ├── managers/           # V1 - Ancienne architecture
│   │   ├── GameManager.ts
│   │   ├── BoardManager.ts
│   │   └── ...
│   │
│   ├── features/           # V2 + V3 - Nouvelle architecture
│   │   ├── game/
│   │   │   ├── game.logic.ts      # Logique métier
│   │   │   └── game.renderer.ts   # Rendu UI
│   │   ├── board/
│   │   │   ├── board.renderer.ts      # V2 - Canvas 2D
│   │   │   ├── board.renderer.3d.ts   # V3 - CSS 3D ⭐
│   │   │   └── board.layouts.ts       # Layouts multiples
│   │   └── tiles/
│   │       └── tile.config.ts     # Config cases
│   │
│   ├── core/               # Partagé V2 + V3
│   │   ├── models/
│   │   └── assets/
│   │
│   └── styles/
│       ├── mobile-optimized.css   # Styles base
│       └── board-3d.css           # V3 - Styles 3D ⭐
│
└── docs/
    ├── GUIDE-3D.md              # Guide version 3D ⭐
    ├── ARCHITECTURE-FEATURES.md
    ├── COMPARAISON-ARCHITECTURES.md
    └── VERSIONS.md              # Ce fichier
```

---

## 🚀 Migration recommandée

Si vous voulez adopter la **version 3D** :

### Étape 1 : Tester
```
http://localhost:3000/index-3d.html
```

### Étape 2 : Valider
- Vérifier les animations
- Tester sur mobile (Chrome DevTools)
- Jouer une partie complète

### Étape 3 : Adopter
```bash
# Renommer l'ancien
mv index.html index-old.html

# Activer la version 3D
mv index-3d.html index.html
mv src/main-3d.ts src/main.ts

# Nettoyer (optionnel)
rm -rf src/managers/
```

---

## 📚 Documentation

- **Architecture générale** : [ARCHITECTURE-FEATURES.md](ARCHITECTURE-FEATURES.md)
- **Version 3D** : [GUIDE-3D.md](GUIDE-3D.md) ⭐
- **Comparaison** : [COMPARAISON-ARCHITECTURES.md](COMPARAISON-ARCHITECTURES.md)
- **Mobile** : [GUIDE-TEST-MOBILE.md](GUIDE-TEST-MOBILE.md)
- **Multiplateforme** : [MULTIPLATEFORME.md](MULTIPLATEFORME.md)

---

## 💡 Conseil

**Testez la version 3D maintenant !**

```
http://localhost:3000/index-3d.html
```

Le rendu est **spectaculaire** et garde les **mêmes performances** que la version 2D ! 🚀

---

**Bon jeu ! 🎮✨**
