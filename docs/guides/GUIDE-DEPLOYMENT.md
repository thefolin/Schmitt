# Déploiement GitHub Pages

## Configuration automatique ✅

Le projet est configuré pour se déployer automatiquement sur GitHub Pages à chaque push sur la branche `main`.

## Étapes pour activer GitHub Pages

1. **Allez dans les paramètres du repo sur GitHub**
   - `Settings` → `Pages`

2. **Configurez la source**
   - Source: `GitHub Actions`
   - Cliquez sur `Save`

3. **Pushez vos changements**
   ```bash
   git add .
   git commit -m "Configure GitHub Pages deployment"
   git push origin main
   ```

4. **Le déploiement se lance automatiquement**
   - Allez dans l'onglet `Actions` pour voir la progression
   - Une fois terminé, votre site sera accessible à :
   - `https://thefolin.github.io/Schmitt/`

## Configuration Vite

Le fichier `vite.config.ts` contient la configuration importante :

```typescript
base: process.env.NODE_ENV === 'production' ? '/Schmitt/' : '/'
```

**Important** : Le `/Schmitt/` doit correspondre au nom exact de votre repository GitHub.

## Tester le build en local

```bash
# Build
npm run build

# Preview du build (comme sur GitHub Pages)
npm run preview
```

Le preview sera accessible sur `http://localhost:4173/Schmitt/`

## Structure du déploiement

- `/.github/workflows/deploy.yml` - Workflow GitHub Actions
- `/dist/` - Dossier de build (généré, ne pas commiter)
- Les 5 versions du jeu sont déployées :
  - `index.html` - **Version caméra (PAR DÉFAUT)** avec physique des dés 3D
  - `index-editor.html` - Éditeur visuel de plateau
  - `index-3d.html` - Version 3D isométrique
  - `index-new.html` - Version 2D features
  - `index-legacy.html` - Version 2D legacy

**Navigation intégrée** :
- Bouton "✏️ Éditeur de plateau" en haut à droite du jeu
- Bouton "🎮 Retour au jeu" en haut à droite de l'éditeur

## Résolution de problèmes

### Les styles ne s'appliquent pas
✅ **Résolu** - Les imports CSS sont maintenant dans les fichiers TypeScript

### Les assets ne chargent pas
✅ **Résolu** - Le dossier `public/` est copié automatiquement dans `dist/`

### Erreur 404 sur les sous-pages
✅ **Résolu** - La configuration `base` dans `vite.config.ts` gère les chemins correctement

## Workflow de développement

1. Développer en local : `npm run dev`
2. Tester le build : `npm run build && npm run preview`
3. Pusher sur main : Le déploiement se fait automatiquement
4. Vérifier sur : `https://thefolin.github.io/Schmitt/`

## Changements effectués pour GitHub Pages

1. ✅ Ajout de `base: '/Schmitt/'` dans `vite.config.ts`
2. ✅ Workflow GitHub Actions (`.github/workflows/deploy.yml`)
3. ✅ Import du type `Player` dans `main-camera.ts`
4. ✅ Correction des erreurs TypeScript
5. ✅ Ajustement des règles TypeScript strictes
6. ✅ Installation de `@types/estree`
