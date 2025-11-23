# 📱 Guide Multiplateforme avec Capacitor

Ce guide explique comment transformer votre jeu en application multiplateforme (iOS, Android, Desktop).

## 🎯 Qu'est-ce que Capacitor ?

Capacitor permet de :
- ✅ Transformer votre app web en app native iOS/Android
- ✅ Créer des apps Desktop (macOS, Windows, Linux)
- ✅ Garder **UN SEUL codebase TypeScript**
- ✅ Accéder aux fonctionnalités natives (caméra, stockage, etc.)

## 📦 Installation rapide

```bash
# 1. Installer Capacitor
npm install @capacitor/core @capacitor/cli

# 2. Initialiser
npx cap init

# 3. Ajouter les plateformes
npm install @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android

# 4. Build et sync
npm run build
npx cap sync

# 5. Ouvrir dans l'IDE natif
npx cap open ios      # Xcode
npx cap open android  # Android Studio
```

## 🚀 Workflow de développement

### Test sur mobile
```bash
npm run build
npx cap sync
npx cap run ios
npx cap run android
```

### Publication
- **iOS** : Via Xcode → App Store Connect
- **Android** : Via Android Studio → Play Console

---

**Votre jeu, partout !** 🎮📱💻
