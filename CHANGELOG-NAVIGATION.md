# Changements - Vue Caméra par défaut

## Date : 23 novembre 2025

## Objectif
Faire de la vue caméra (avec physique des dés 3D) la version par défaut du jeu, avec navigation facile vers l'éditeur.

## Changements effectués

### 1. Renommage des fichiers HTML
```bash
index.html → index-legacy.html          # Ancienne version 2D
index-camera.html → index.html          # Vue caméra devient par défaut
```

### 2. Ajout de la navigation

#### Dans `index.html` (vue caméra)
Ajout d'un bouton "✏️ Éditeur de plateau" en haut à droite :
```html
<a href="index-editor.html" class="editor-link">Éditeur de plateau</a>
```
- Style : Bleu (#3498db)
- Position : Fixed top-right
- Animation au survol
- z-index: 10000 pour rester visible

#### Dans `index-editor.html`
Ajout d'un bouton "🎮 Retour au jeu" en haut à droite :
```html
<a href="index.html" class="game-link">Retour au jeu</a>
```
- Style : Vert (#2ecc71)
- Position : Fixed top-right
- Animation au survol
- z-index: 10000 pour rester visible

### 3. Correction du build

#### `index-new.html`
Correction du chemin du script :
```html
<!-- Avant -->
<script type="module" src="/src/main-new.ts"></script>

<!-- Après -->
<script type="module" src="/src/2d/main-new.ts"></script>
```

#### `vite.config.ts`
Mise à jour des points d'entrée :
```typescript
input: {
  main: path.resolve(__dirname, 'index.html'),        // Vue caméra
  legacy: path.resolve(__dirname, 'index-legacy.html'), // 2D legacy
  '3d': path.resolve(__dirname, 'index-3d.html'),
  new: path.resolve(__dirname, 'index-new.html'),
  editor: path.resolve(__dirname, 'index-editor.html'),
}
```

### 4. Documentation mise à jour

#### `readme.md`
- Mise à jour du tableau des versions
- Vue Caméra marquée comme version par défaut avec ⭐
- Ajout de la section "Navigation intégrée"

#### `docs/guides/GUIDE-DEPLOYMENT.md`
- Mise à jour de la structure du déploiement
- Correction de la liste des versions

## Résultat

✅ **Page par défaut** : Vue caméra avec physique des dés 3D
✅ **Navigation fluide** : Boutons visibles pour basculer entre jeu et éditeur
✅ **Build fonctionnel** : Toutes les 5 versions compilent correctement
✅ **URLs préservées** : Les anciennes URLs restent accessibles

## URLs après déploiement

- `https://thefolin.github.io/Schmitt/` → **Vue caméra** (par défaut)
- `https://thefolin.github.io/Schmitt/index-editor.html` → Éditeur
- `https://thefolin.github.io/Schmitt/index-3d.html` → Version 3D
- `https://thefolin.github.io/Schmitt/index-new.html` → 2D features
- `https://thefolin.github.io/Schmitt/index-legacy.html` → 2D legacy

## Commandes de test

```bash
# Build
npm run build

# Preview local
npm run preview
# → http://localhost:4173/Schmitt/

# Tester la navigation
# 1. Ouvrir http://localhost:4173/Schmitt/
# 2. Cliquer sur "✏️ Éditeur de plateau"
# 3. Cliquer sur "🎮 Retour au jeu"
```

## Prochaines étapes

1. Tester en local avec `npm run preview`
2. Vérifier la navigation entre jeu et éditeur
3. Commiter les changements
4. Pusher sur GitHub pour déploiement automatique
