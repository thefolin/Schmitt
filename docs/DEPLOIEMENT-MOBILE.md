# 📱 Guide de Déploiement Mobile - Schmitt Odyssée

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Prérequis](#prérequis)
3. [Configuration Locale](#configuration-locale)
4. [Build et Test Local](#build-et-test-local)
5. [Déploiement via GitHub Actions](#déploiement-via-github-actions)
6. [Distribution Firebase](#distribution-firebase)
7. [Publication sur les Stores](#publication-sur-les-stores)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Vue d'ensemble

Le projet **Schmitt Odyssée** utilise **Capacitor** pour le déploiement mobile. Cette stack permet :

- ✅ Code unique TypeScript/JavaScript
- ✅ Accès aux APIs natives (caméra, géolocalisation, notifications)
- ✅ Build automatisé via GitHub Actions
- ✅ Distribution interne via Firebase App Distribution
- ✅ Publication sur Google Play Store et Apple App Store

### Architecture

```
Web (Vite + TypeScript)
        ↓
   Capacitor Core
        ↓
    ┌───────┴────────┐
Android            iOS
(APK/AAB)         (IPA)
```

---

## 🛠️ Prérequis

### Obligatoire

- ✅ **Node.js >=18** (actuellement v20.19.5)
- ✅ **npm** ou **yarn**
- ✅ **Git**

### Pour Android

- ✅ **Android Studio** (Electric Eel ou plus récent)
- ✅ **Java JDK 17** (inclus avec Android Studio)
- ✅ **Android SDK** (API 33+)

### Pour iOS (macOS uniquement)

- ⏳ **Xcode 14+** (depuis App Store)
- ⏳ **CocoaPods** : `sudo gem install cocoapods`
- ⏳ **Apple Developer Account** (99$/an pour distribution)

### Pour Distribution Firebase

- 📦 **Compte Firebase** (gratuit)
- 📦 **Firebase CLI** : `npm install -g firebase-tools`

---

## ⚙️ Configuration Locale

### 1. Installation des dépendances

```bash
# Installer les dépendances npm
npm install

# Vérifier que Capacitor est bien installé
npx cap --version
```

### 2. Configuration Capacitor

Le fichier [capacitor.config.ts](../capacitor.config.ts) est déjà configuré :

```typescript
{
  appId: 'com.schmittodyssee.app',
  appName: 'Schmitt Odyssée',
  webDir: 'dist',
  // ... plugins configurés
}
```

**Pour changer l'App ID** (si nécessaire pour publication) :

```bash
# Éditer capacitor.config.ts
appId: 'com.votredomaine.schmittodyssee'
```

### 3. Scripts npm disponibles

```bash
# Build web pour mobile
npm run build:mobile

# Synchroniser avec Android
npm run cap:sync:android

# Ouvrir dans Android Studio
npm run cap:open:android

# Build + Sync + Open Android
npm run android:open

# Même chose + Run sur device/émulateur
npm run android:dev
```

---

## 📱 Build et Test Local

### Android

#### 1. Premier build

```bash
# Build le projet web
npm run build:mobile

# Synchroniser avec Android
npx cap sync android

# Ouvrir dans Android Studio
npx cap open android
```

#### 2. Dans Android Studio

1. **Attendre l'indexation et sync Gradle** (première fois : 5-10 min)
2. **Connecter un device Android** (USB + Debug USB activé) ou démarrer un émulateur
3. **Cliquer sur "Run" (▶️)** ou `Shift + F10`

L'app s'installe sur le device et se lance automatiquement !

#### 3. Debug APK en ligne de commande

```bash
cd android
./gradlew assembleDebug

# APK disponible dans :
# android/app/build/outputs/apk/debug/app-debug.apk
```

#### 4. Tester l'APK sur device

```bash
# Installer via adb
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Ou simplement transférer le fichier APK sur le téléphone et l'ouvrir
```

### iOS (si vous avez un Mac)

#### 1. Ajouter la plateforme iOS

```bash
npx cap add ios
```

#### 2. Premier build

```bash
# Build le projet web
npm run build:mobile

# Synchroniser avec iOS
npx cap sync ios

# Ouvrir dans Xcode
npx cap open ios
```

#### 3. Dans Xcode

1. **Attendre l'indexation** (première fois : 5-10 min)
2. **Sélectionner un simulateur** ou votre iPhone connecté
3. **Signing & Capabilities** :
   - Sélectionner votre Apple ID (Team)
   - Xcode génère automatiquement un provisioning profile
4. **Run (⌘R)** pour lancer sur simulateur/device

---

## 🚀 Déploiement via GitHub Actions

### Workflows Disponibles

Trois workflows GitHub Actions ont été configurés :

#### 1. **android-build.yml** - Build Android APK/AAB

**Déclenchement manuel** : Actions → "Build Android APK/AAB" → Run workflow

**Paramètres** :
- `build_type` : `debug` ou `release`
- `output_format` : `apk` ou `aab`

**Outputs** :
- APK/AAB disponible dans "Artifacts" après le build
- Retention : 30 jours (debug) / 90 jours (release)

#### 2. **ios-build.yml** - Build iOS IPA (préparatoire)

⚠️ **Status** : Préparatoire (nécessite configuration iOS)

**Ce qui fonctionne** :
- Build web
- Sync Capacitor
- Build debug (archive Xcode)

**Ce qui manque** :
- Certificats Apple Developer
- Provisioning profiles
- Configuration signing

#### 3. **firebase-distribution.yml** - Distribution Firebase

**Déclenchement manuel** : Actions → "Distribute to Firebase App Distribution" → Run workflow

**Paramètres** :
- `platform` : `android` ou `ios`
- `release_notes` : Notes de version

**Outputs** :
- APK uploadé sur Firebase App Distribution
- Notifications envoyées aux testeurs

### Configuration des Secrets GitHub

Pour utiliser les workflows, configurez ces secrets dans **Settings → Secrets and variables → Actions** :

#### Pour Android Release

```bash
# 1. Générer un keystore (NE PAS faire en production pour l'instant)
keytool -genkey -v -keystore release.keystore -alias schmitt -keyalg RSA -keysize 2048 -validity 10000

# 2. Encoder en base64
base64 -i release.keystore | pbcopy

# 3. Ajouter dans GitHub Secrets
```

**Secrets nécessaires** :
- `ANDROID_KEYSTORE_BASE64` : Keystore encodé en base64
- `ANDROID_KEYSTORE_PASSWORD` : Mot de passe du keystore
- `ANDROID_KEY_ALIAS` : Alias de la clé (ex: `schmitt`)
- `ANDROID_KEY_PASSWORD` : Mot de passe de la clé

#### Pour Firebase App Distribution

**Secrets nécessaires** :
- `FIREBASE_APP_ID_ANDROID` : ID de l'app Firebase (ex: `1:123456789:android:abc123`)
- `FIREBASE_SERVICE_ACCOUNT_JSON` : JSON du service account Firebase

**Obtenir ces secrets** :

1. **Créer un projet Firebase** : [console.firebase.google.com](https://console.firebase.google.com)
2. **Ajouter une app Android** :
   - Package name : `com.schmittodyssee.app`
   - Copier le `FIREBASE_APP_ID`
3. **Générer un service account** :
   - Project Settings → Service accounts
   - Generate new private key
   - Copier tout le JSON dans `FIREBASE_SERVICE_ACCOUNT_JSON`

#### Pour iOS (plus tard)

**Secrets nécessaires** :
- `P12_BASE64` : Certificat Apple Developer (.p12) en base64
- `P12_PASSWORD` : Mot de passe du certificat
- `PROVISIONING_PROFILE_BASE64` : Provisioning profile en base64
- `FIREBASE_APP_ID_IOS` : ID de l'app Firebase iOS

---

## 🔥 Distribution Firebase

### Configuration Firebase

#### 1. Créer un projet Firebase

1. Aller sur [console.firebase.google.com](https://console.firebase.google.com)
2. Cliquer sur "Ajouter un projet"
3. Nom : **Schmitt Odyssée**
4. Activer Google Analytics (optionnel)

#### 2. Ajouter l'app Android

1. Cliquer sur l'icône Android
2. **Package Android** : `com.schmittodyssee.app`
3. Télécharger `google-services.json` (optionnel pour App Distribution)
4. Noter le **Firebase App ID** (dans Project Settings → General)

#### 3. Activer App Distribution

1. Dans Firebase Console → App Distribution
2. Inviter des testeurs :
   - Créer un groupe "testers"
   - Ajouter les emails des testeurs

#### 4. Installer Firebase CLI

```bash
npm install -g firebase-tools

# Login
firebase login

# Déployer manuellement (alternative à GitHub Actions)
firebase appdistribution:distribute \
  android/app/build/outputs/apk/debug/app-debug.apk \
  --app YOUR_FIREBASE_APP_ID \
  --groups testers \
  --release-notes "Version de test"
```

### Distribution via GitHub Actions

Une fois les secrets configurés :

1. **GitHub** → **Actions** → **"Distribute to Firebase App Distribution"**
2. **Run workflow**
3. Choisir `android`
4. Ajouter des notes de version
5. **Run workflow** ✅

Les testeurs recevront un email avec un lien pour télécharger l'APK !

---

## 🏪 Publication sur les Stores

### Google Play Store (Android)

#### Prérequis

- ✅ Compte Google Play Console (25$ one-time)
- ✅ Keystore de release configuré
- ✅ Build AAB signé

#### Étapes

1. **Créer un compte Play Console** : [play.google.com/console](https://play.google.com/console)

2. **Créer une app** :
   - Nom : Schmitt Odyssée
   - Package : `com.schmittodyssee.app`

3. **Préparer le contenu** :
   - Screenshots (min. 2)
   - Icône (512x512)
   - Feature Graphic (1024x500)
   - Description courte/longue

4. **Build AAB de production** :

```bash
# Via GitHub Actions
Actions → "Build Android APK/AAB"
→ build_type: release
→ output_format: aab

# Télécharger l'AAB depuis Artifacts
```

5. **Upload AAB** :
   - Play Console → Release → Production
   - Upload `app-release.aab`
   - Remplir le formulaire de release
   - Soumettre pour review (⏱️ 3-7 jours)

#### Testing Track (recommandé avant production)

1. Play Console → Release → Internal testing
2. Créer une liste d'emails testeurs
3. Upload AAB
4. Les testeurs reçoivent un lien de test

### Apple App Store (iOS)

#### Prérequis

- ⏳ Apple Developer Account (99$/an)
- ⏳ Certificats de signature configurés
- ⏳ App Store Connect access

#### Étapes (résumé)

1. **Créer un compte Apple Developer** : [developer.apple.com](https://developer.apple.com)

2. **Créer une app dans App Store Connect** :
   - Nom : Schmitt Odyssée
   - Bundle ID : `com.schmittodyssee.app`

3. **Configurer signing dans Xcode** :
   - Automatic signing (pour commencer)
   - Ou manual signing (production)

4. **Archive et upload** :
   - Xcode → Product → Archive
   - Distribute App → App Store Connect
   - Upload

5. **Remplir les métadonnées** dans App Store Connect

6. **Soumettre pour review** (⏱️ 1-3 jours)

#### TestFlight (recommandé avant production)

1. Upload via Xcode (comme ci-dessus)
2. App Store Connect → TestFlight
3. Ajouter testeurs externes (max 10 000)
4. Testeurs reçoivent une invitation TestFlight

---

## 🔧 Troubleshooting

### Problèmes Fréquents

#### ❌ `The Capacitor CLI requires NodeJS >=18.0.0`

**Solution** :

```bash
# Installer nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Installer Node 20
nvm install 20
nvm use 20
nvm alias default 20

# Vérifier
node --version  # doit afficher v20.x.x
```

#### ❌ Gradle Build Failed

**Solutions** :

1. **Vérifier Java version** :
```bash
java -version  # doit être 17
```

2. **Clean Gradle** :
```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

3. **Invalidate Caches (Android Studio)** :
   - File → Invalidate Caches → Invalidate and Restart

#### ❌ App ne se lance pas sur device Android

**Solutions** :

1. **Activer Developer Mode** sur le téléphone
2. **Activer USB Debugging** dans Developer Options
3. **Autoriser l'installation d'apps inconnues**
4. **Vérifier adb** :
```bash
adb devices  # doit lister votre device
```

#### ❌ Xcode Signing Error

**Solutions** :

1. **Xcode → Signing & Capabilities**
2. **Cocher "Automatically manage signing"**
3. **Sélectionner votre Team (Apple ID)**
4. **Clean Build Folder** (⌘⇧K)
5. **Rebuild** (⌘B)

#### ❌ Firebase Distribution échoue

**Solutions** :

1. **Vérifier les secrets GitHub** :
   - `FIREBASE_APP_ID_ANDROID` est correct
   - `FIREBASE_SERVICE_ACCOUNT_JSON` est valide

2. **Tester en local** :
```bash
firebase appdistribution:distribute \
  android/app/build/outputs/apk/debug/app-debug.apk \
  --app YOUR_FIREBASE_APP_ID \
  --groups testers
```

3. **Vérifier les permissions** du service account dans Firebase IAM

---

## 📚 Ressources

### Documentation Officielle

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Android Developer Guide](https://developer.android.com)
- [iOS Developer Guide](https://developer.apple.com)
- [Firebase App Distribution](https://firebase.google.com/docs/app-distribution)

### Liens Utiles

- [GitHub Actions for Android](https://github.com/marketplace/actions/android-actions)
- [Fastlane](https://fastlane.tools/) - Automation avancée
- [Capacitor Community Plugins](https://github.com/capacitor-community)

### Support

- **Issues GitHub** : [github.com/votre-repo/issues](https://github.com)
- **Capacitor Community** : [forum.ionicframework.com](https://forum.ionicframework.com)

---

## 🎯 Prochaines Étapes

### Court Terme (Avant Tests)

- [ ] Tester le build Android en local
- [ ] Configurer Firebase App Distribution
- [ ] Ajouter des testeurs dans Firebase
- [ ] Lancer un build via GitHub Actions
- [ ] Distribuer aux testeurs via Firebase

### Moyen Terme (1-2 semaines)

- [ ] Intégrer les plugins natifs dans le jeu
- [ ] Optimiser les assets pour mobile
- [ ] Tester sur plusieurs devices Android
- [ ] Créer les screenshots pour les stores

### Long Terme (1-2 mois)

- [ ] Configuration iOS complète
- [ ] Publication sur Play Store (Internal Testing)
- [ ] Publication sur App Store (TestFlight)
- [ ] Production release sur les deux stores

---

**Bon déploiement ! 🚀**

*Dernière mise à jour : Novembre 2024*
