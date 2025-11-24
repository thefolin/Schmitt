# 📱 Configuration Mobile Complétée - Schmitt Odyssée

## ✅ Ce qui a été fait

### 1. Configuration Capacitor

- ✅ Capacitor 6 installé et configuré
- ✅ Plateforme Android ajoutée et synchronisée
- ✅ Plugins natifs installés :
  - `@capacitor/app` - Lifecycle de l'app
  - `@capacitor/camera` - Caméra et photos
  - `@capacitor/geolocation` - Géolocalisation
  - `@capacitor/preferences` - Stockage persistant
  - `@capacitor/push-notifications` - Notifications push

### 2. Configuration du Projet

- ✅ [vite.config.ts](vite.config.ts) adapté pour mobile
- ✅ [package.json](package.json) scripts ajoutés pour Android/iOS
- ✅ [capacitor.config.ts](capacitor.config.ts) configuré
- ✅ Permissions Android ajoutées dans [AndroidManifest.xml](android/app/src/main/AndroidManifest.xml)
- ✅ [.gitignore](.gitignore) mis à jour

### 3. GitHub Actions CI/CD

Trois workflows créés dans [.github/workflows/](.github/workflows/) :

- ✅ [android-build.yml](.github/workflows/android-build.yml) - Build APK/AAB
- ✅ [ios-build.yml](.github/workflows/ios-build.yml) - Build iOS (préparatoire)
- ✅ [firebase-distribution.yml](.github/workflows/firebase-distribution.yml) - Distribution Firebase

### 4. Documentation

- ✅ [docs/DEPLOIEMENT-MOBILE.md](docs/DEPLOIEMENT-MOBILE.md) - Guide complet
- ✅ [docs/QUICKSTART-MOBILE.md](docs/QUICKSTART-MOBILE.md) - Quick start
- ✅ [.github/workflows/README.md](.github/workflows/README.md) - Workflows doc
- ✅ [src/features/native/capacitor-plugins.ts](src/features/native/capacitor-plugins.ts) - Exemples plugins

### 5. Tests et Validation

- ✅ Build web mobile fonctionne : `npm run build:mobile`
- ✅ Sync Android fonctionne : `npx cap sync android`
- ✅ 5 plugins Capacitor détectés et configurés
- ✅ Node.js mis à jour vers v20.19.5

---

## 🚀 Prochaines Étapes

### Court Terme (Aujourd'hui / Demain)

1. **Tester le build Android local** :
   ```bash
   npm run android:open
   # → Android Studio s'ouvre
   # → Run (▶️) pour tester sur émulateur
   ```

2. **Configurer Firebase App Distribution** :
   - Suivre [docs/QUICKSTART-MOBILE.md](docs/QUICKSTART-MOBILE.md)
   - Créer projet Firebase
   - Configurer les secrets GitHub
   - Durée estimée : 1-2h

3. **Premier déploiement de test** :
   - GitHub Actions → "Distribute to Firebase App Distribution"
   - Distribuer aux premiers testeurs
   - Recueillir feedback

### Moyen Terme (Cette Semaine)

4. **Intégrer les plugins natifs dans le jeu** :
   - Utiliser [src/features/native/capacitor-plugins.ts](src/features/native/capacitor-plugins.ts)
   - Exemples :
     - Sauvegarder l'état du jeu avec `Preferences`
     - Détecter quand l'app passe en background
     - Prendre des photos pour les profils joueurs

5. **Optimisations mobile** :
   - Compresser les images dans `public/assets/`
   - Tester sur plusieurs devices Android
   - Ajuster le UI pour petits écrans

6. **Tests utilisateurs** :
   - Distribuer à 5-10 testeurs
   - Collecter feedback
   - Itérer rapidement

### Long Terme (Ce Mois)

7. **iOS** (si Mac disponible) :
   ```bash
   npx cap add ios
   npm run ios:open
   ```

8. **Publication** :
   - Google Play Store (Internal Testing)
   - Apple App Store (TestFlight)

---

## 📋 Commandes Utiles

### Build et Développement

```bash
# Build web pour mobile
npm run build:mobile

# Sync avec Android
npm run cap:sync:android

# Ouvrir Android Studio
npm run android:open

# Build + Sync + Open + Run (tout-en-un)
npm run android:dev

# Type checking
npm run type-check
```

### Capacitor

```bash
# Sync toutes les plateformes
npx cap sync

# Ouvrir Android Studio
npx cap open android

# Ouvrir Xcode (macOS)
npx cap open ios

# Update Capacitor
npm update @capacitor/core @capacitor/cli
```

### Android Build Manual

```bash
cd android

# Debug APK
./gradlew assembleDebug

# Release APK (si keystore configuré)
./gradlew assembleRelease

# AAB pour Play Store
./gradlew bundleRelease
```

---

## 🔑 Secrets GitHub à Configurer

### Pour Release Android (plus tard)

```
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

### Pour Firebase Distribution (maintenant)

```
FIREBASE_APP_ID_ANDROID
FIREBASE_SERVICE_ACCOUNT_JSON
```

### Pour iOS (plus tard)

```
P12_BASE64
P12_PASSWORD
PROVISIONING_PROFILE_BASE64
FIREBASE_APP_ID_IOS
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [DEPLOIEMENT-MOBILE.md](docs/DEPLOIEMENT-MOBILE.md) | Guide complet de déploiement |
| [QUICKSTART-MOBILE.md](docs/QUICKSTART-MOBILE.md) | Quick start pour tests rapides |
| [.github/workflows/README.md](.github/workflows/README.md) | Documentation workflows |
| [capacitor-plugins.ts](src/features/native/capacitor-plugins.ts) | Exemples d'utilisation plugins |

---

## 🎯 Objectif : Tests Avant Fin du Mois

**Timeline** :

- ✅ **Jour 1** : Configuration complétée (FAIT)
- 📅 **Jour 2-3** : Firebase + Premier déploiement
- 📅 **Jour 4-7** : Tests + Feedback + Itérations
- 📅 **Avant fin du mois** : Version testable distribuée ✅

**C'est atteignable !** 🚀

---

## 💡 Conseils

### Debug sur Device Android

```bash
# Connecter le device via USB
# Activer USB Debugging

# Voir les logs en temps réel
adb logcat | grep -i "schmitt\|capacitor\|error"
```

### Tester sans Android Studio

```bash
# Build l'APK
cd android
./gradlew assembleDebug

# Installer sur device connecté
adb install app/build/outputs/apk/debug/app-debug.apk

# Ou transférer l'APK sur le téléphone et l'ouvrir
```

### Vérifier la Configuration

```bash
# Vérifier Node.js
node --version  # doit être v20.19.5

# Vérifier Capacitor
npx cap doctor

# Lister les devices Android connectés
adb devices
```

---

## ⚠️ Notes Importantes

1. **Ne JAMAIS commit** :
   - `*.keystore` ou `*.jks`
   - `google-services.json` avec des secrets
   - Fichiers de secrets Firebase

2. **Node.js v20** requis :
   - Utilisez `nvm use 20` avant chaque commande Capacitor

3. **Build web avant sync** :
   - Toujours faire `npm run build:mobile` avant `npx cap sync`

4. **Chunks vides "vendor/plugins"** :
   - C'est normal pour l'instant (plugins pas encore utilisés dans le code)
   - Disparaîtront quand vous utiliserez les plugins natifs

---

## 🆘 Aide

**Problème lors du build ?**
→ Voir [docs/DEPLOIEMENT-MOBILE.md#troubleshooting](docs/DEPLOIEMENT-MOBILE.md#troubleshooting)

**Questions sur les workflows ?**
→ Voir [.github/workflows/README.md](.github/workflows/README.md)

**Besoin d'exemples de code ?**
→ Voir [src/features/native/capacitor-plugins.ts](src/features/native/capacitor-plugins.ts)

---

**Configuration mobile terminée ! Prêt pour le déploiement. 🎉**

*Créé le 24 novembre 2024*
