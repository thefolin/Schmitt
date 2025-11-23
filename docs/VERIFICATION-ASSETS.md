# Vérification des Assets - Déploiement

## Date : 23 novembre 2025

## ✅ Statut : Assets correctement configurés

### Structure des assets

#### Développement local
```
/assets/              ← Dossier pour le développement (conservé)
  ├── *.png           ← Images des tuiles
  ├── *.json          ← Layouts de test

/public/              ← Dossier copié automatiquement par Vite
  ├── assets/         ← Images des tuiles (utilisées en prod)
  │   ├── start.png
  │   ├── tournerGeneral.png
  │   ├── row.png
  │   ├── drink_2.png
  │   ├── drink_3.png
  │   ├── drink_4.png
  │   ├── donnerDring_2.png
  │   ├── donnerDring_4.png
  │   ├── donnerDrink_3.png
  │   ├── finish.png
  │   ├── image.png
  │   ├── mouton.png
  │   ├── petitPoulet.png
  │   ├── powerG.png
  │   ├── rule.png
  │   └── schimitt.png
  │
  └── data/           ← Données JSON
      └── power.json  ← Configuration des pouvoirs des dieux
```

#### Après build (dist/)
```
/dist/
  ├── assets/         ← Contient TOUS les assets (JS, CSS, images)
  │   ├── *.js        ← Code compilé
  │   ├── *.css       ← Styles compilés
  │   └── *.png       ← ✅ Images copiées depuis public/assets/
  │
  └── data/           ← ✅ Données copiées depuis public/data/
      └── power.json
```

### Vérification du build

```bash
npm run build
```

**Résultat** :
- ✅ 16 images PNG copiées dans `dist/assets/`
- ✅ 1 fichier JSON copié dans `dist/data/`
- ✅ Build réussi en 298ms

### Images présentes dans le déploiement

| Fichier | Utilisation |
|---------|-------------|
| `start.png` | Case START |
| `tournerGeneral.png` | Tournée générale |
| `row.png` | Avancez de 2 cases |
| `drink_2.png` | Buvez 2 gorgées |
| `drink_3.png` | Buvez 3 gorgées |
| `drink_4.png` | Buvez 4 gorgées |
| `donnerDring_2.png` | Donnez 2 gorgées |
| `donnerDring_4.png` | Donnez 4 gorgées |
| `donnerDrink_3.png` | Donnez 3 gorgées |
| `finish.png` | Case arrivée |
| `mouton.png` | Mouton |
| `petitPoulet.png` | Petit poulet |
| `powerG.png` | Faveur des dieux |
| `rule.png` | Règle du jeu |
| `schimitt.png` | Schmitt |
| `image.png` | Image générique |

### Configuration dans le code

Les chemins dans `tile.config.ts` utilisent :
```typescript
image: 'assets/start.png'  // ✅ Relatif à la racine du site
```

Avec la configuration Vite :
```typescript
base: process.env.NODE_ENV === 'production' ? '/Schmitt/' : '/'
```

Les URLs en production deviennent :
```
https://thefolin.github.io/Schmitt/assets/start.png  ✅
https://thefolin.github.io/Schmitt/data/power.json   ✅
```

### Organisation des dossiers

**Pourquoi deux dossiers assets ?**

1. **`/assets/`** (racine)
   - Pour le développement et tests locaux
   - Contient aussi les layouts JSON de test
   - Facilite l'accès rapide pendant le dev
   - **Non utilisé en production**

2. **`/public/assets/`** (dans public)
   - **Source des assets pour la production**
   - Copié automatiquement par Vite dans `dist/`
   - Contient les images utilisées par le jeu

### Workflow

1. **Développement** : Les deux dossiers sont disponibles
2. **Build** : Seul `public/` est copié dans `dist/`
3. **Déploiement** : `dist/` contient tout ce qui est nécessaire

### Test en local

```bash
# Build
npm run build

# Preview (simule GitHub Pages)
npm run preview

# Vérifier les images
curl http://localhost:4173/Schmitt/assets/start.png
# → Devrait retourner l'image
```

## ✅ Conclusion

Les assets sont **correctement configurés** pour le déploiement :
- ✅ Images dans `public/assets/` copiées dans `dist/assets/`
- ✅ Données dans `public/data/` copiées dans `dist/data/`
- ✅ Chemins relatifs corrects dans le code
- ✅ Configuration `base` pour GitHub Pages

**Prêt pour le déploiement !** 🚀
