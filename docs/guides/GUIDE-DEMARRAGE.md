# 🎮 Guide de démarrage - Schmitt Odyssée TypeScript

## ✅ Ce qui a été fait

Votre jeu a été **complètement restructuré** en TypeScript avec une architecture moderne et modulaire !

### 📁 Nouvelle structure

```
src/
├── models/          # Types et modèles de données
├── managers/        # Logique métier (Game, Sound, UI, Board)
├── utils/           # Constantes et helpers
└── styles/          # CSS

public/              # Assets (images, JSON)
```

### 🎯 Avantages

- ✅ **Code propre et maintenable** : Architecture modulaire
- ✅ **TypeScript** : Sécurité des types
- ✅ **Vite** : Build ultra-rapide
- ✅ **Prêt pour mobile** : Structure compatible Capacitor

## 🚀 Commandes principales

### Lancer le jeu en développement
```bash
npm run dev
```
→ Ouvre [http://localhost:3000](http://localhost:3000)

### Compiler pour production
```bash
npm run build
```
→ Génère le build dans `dist/`

### Vérifier les types TypeScript
```bash
npm run type-check
```

## 📱 Prochaines étapes

### 1. Tester le jeu
Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur

### 2. Développer des nouvelles features
Modifiez les fichiers dans `src/` :
- `src/managers/GameManager.ts` → Logique du jeu
- `src/models/` → Ajouter de nouveaux types
- `src/styles/main.css` → Modifier l'apparence

### 3. Rendre multiplateforme
Suivez le guide [MULTIPLATEFORME.md](./MULTIPLATEFORME.md)

## 📝 Fichiers importants

| Fichier | Description |
|---------|-------------|
| `src/main.ts` | Point d'entrée |
| `src/managers/GameManager.ts` | Logique principale |
| `index.html` | HTML minimaliste |
| `package.json` | Dépendances et scripts |
| `tsconfig.json` | Config TypeScript |
| `vite.config.ts` | Config Vite |

## 🔧 Anciens fichiers conservés

Pour référence, les anciens fichiers ont été renommés :
- `index-old.html` → Ancienne version standalone
- `index.html.backup` → Backup original
- `game.js`, `utils.js`, `tileEffects.js` → Anciens modules JS

## 🆘 Besoin d'aide ?

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

### Voir les logs du serveur
Le serveur Vite affiche les erreurs directement dans le terminal

## 📚 Ressources

- [README-TYPESCRIPT.md](./README-TYPESCRIPT.md) → Documentation complète
- [MULTIPLATEFORME.md](./MULTIPLATEFORME.md) → Guide mobile/desktop
- [Documentation Vite](https://vitejs.dev/)
- [Documentation TypeScript](https://www.typescriptlang.org/)

---

**Bon développement ! 🚀**
