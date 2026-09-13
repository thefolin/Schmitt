# 🔄 GitHub Actions Workflows - Schmitt Odyssée

## 📋 Workflows Disponibles

### 1. **deploy.yml** - Déploiement GitHub Pages
**Trigger** : Push sur `main`
**Actions** :
- Build du projet web
- Déploiement sur GitHub Pages
- URL : https://votre-username.github.io/Schmitt/

### 2. **android-build.yml** - Build Android APK/AAB ⭐
**Trigger** : Manuel (`workflow_dispatch`)

**Paramètres** :
| Paramètre | Options | Description |
|-----------|---------|-------------|
| `build_type` | `debug` / `release` | Type de build |
| `output_format` | `apk` / `aab` | Format de sortie |

**Artifacts générés** :
- `schmitt-odyssee-debug.apk` (30 jours)
- `schmitt-odyssee-release.apk` (90 jours)
- `schmitt-odyssee-debug.aab` (30 jours)
- `schmitt-odyssee-release.aab` (90 jours)

**Utilisation** :

```bash
1. GitHub → Actions → "Build Android APK/AAB"
2. Click "Run workflow"
3. Choisir build_type et output_format
4. Run workflow
5. Attendre 5-10 min
6. Télécharger l'artifact dans "Summary"
```

**Secrets requis (release seulement)** :
- `ANDROID_KEYSTORE_BASE64` - Keystore encodé
- `ANDROID_KEYSTORE_PASSWORD` - Mot de passe keystore
- `ANDROID_KEY_ALIAS` - Alias de la clé
- `ANDROID_KEY_PASSWORD` - Mot de passe clé

### 3. **ios-build.yml** - Build iOS IPA 🚧
**Trigger** : Manuel (`workflow_dispatch`)
**Status** : Préparatoire

**Paramètres** :
| Paramètre | Options | Description |
|-----------|---------|-------------|
| `build_type` | `debug` / `release` | Type de build |

**Notes** :
- ⚠️ Nécessite configuration iOS (`npx cap add ios`)
- ⚠️ Release nécessite certificats Apple Developer
- ✅ Debug fonctionne (archive .xcarchive)

**Secrets requis (release)** :
- `P12_BASE64` - Certificat Apple (.p12)
- `P12_PASSWORD` - Mot de passe certificat
- `PROVISIONING_PROFILE_BASE64` - Provisioning profile

### 4. **firebase-distribution.yml** - Distribution Firebase 🔥
**Trigger** : Manuel (`workflow_dispatch`)

**Paramètres** :
| Paramètre | Options | Description |
|-----------|---------|-------------|
| `platform` | `android` / `ios` | Plateforme cible |
| `release_notes` | Texte | Notes de version |

**Actions** :
- Build APK debug
- Upload sur Firebase App Distribution
- Notification aux testeurs

**Secrets requis** :
- `FIREBASE_APP_ID_ANDROID` - ID app Firebase Android
- `FIREBASE_SERVICE_ACCOUNT_JSON` - JSON service account

**Utilisation** :

```bash
1. Configurer Firebase (voir docs/DEPLOIEMENT-MOBILE.md)
2. Ajouter les secrets GitHub
3. GitHub → Actions → "Distribute to Firebase App Distribution"
4. Run workflow avec platform=android
5. Les testeurs reçoivent un email
```

---

## ⚙️ Configuration des Secrets

### Accéder aux Secrets

```
GitHub Repo → Settings → Secrets and variables → Actions → New repository secret
```

### Secrets à Configurer

#### Pour Android Release

**Générer un keystore** :

```bash
keytool -genkey -v \
  -keystore release.keystore \
  -alias schmitt \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# Encoder en base64
base64 -i release.keystore | pbcopy  # macOS
base64 -w 0 release.keystore         # Linux
```

**Ajouter les secrets** :

1. `ANDROID_KEYSTORE_BASE64` : Coller le résultat du base64
2. `ANDROID_KEYSTORE_PASSWORD` : Mot de passe du keystore
3. `ANDROID_KEY_ALIAS` : `schmitt` (ou votre alias)
4. `ANDROID_KEY_PASSWORD` : Mot de passe de la clé

⚠️ **IMPORTANT** : Ne JAMAIS commit le fichier `.keystore` dans Git !

#### Pour Firebase App Distribution

**Obtenir Firebase App ID** :

1. [Firebase Console](https://console.firebase.google.com)
2. Project Settings → General
3. Copier l'App ID (ex: `1:123456789:android:abc123`)

**Obtenir Service Account JSON** :

1. Firebase Console → Project Settings
2. Service accounts
3. Generate new private key
4. Télécharger le JSON
5. Copier tout le contenu dans le secret

**Ajouter les secrets** :

1. `FIREBASE_APP_ID_ANDROID` : ID de l'app
2. `FIREBASE_SERVICE_ACCOUNT_JSON` : Contenu du JSON

#### Pour iOS (plus tard)

**Générer certificat .p12** :

1. Keychain Access (macOS) → Certificate Assistant → Request a Certificate
2. Apple Developer Portal → Certificates → Create
3. Download et installer
4. Export from Keychain as .p12

```bash
# Encoder
base64 -i Certificates.p12 | pbcopy
```

**Ajouter les secrets** :

1. `P12_BASE64` : Certificat encodé
2. `P12_PASSWORD` : Mot de passe du .p12
3. `PROVISIONING_PROFILE_BASE64` : Profile encodé

---

## 🚀 Utilisation Recommandée

### Workflow de Développement

```
1. Développement local → npm run dev
2. Tests locaux → npm run android:dev
3. Build CI/CD → GitHub Actions (android-build.yml)
4. Distribution testeurs → Firebase (firebase-distribution.yml)
5. Release → Manual signing + Stores
```

### Avant Chaque Release

**Checklist** :

- [ ] Tests locaux passent
- [ ] Version incrémentée dans [android/app/build.gradle](../../android/app/build.gradle)
- [ ] Release notes préparées
- [ ] Secrets GitHub configurés
- [ ] Firebase testeurs group mis à jour

### Build Debug vs Release

| Critère | Debug | Release |
|---------|-------|---------|
| Signing | Auto (debug key) | Keystore requis |
| Taille | Plus large | Optimisé (minify) |
| Performance | Standard | Optimisé |
| Distribution | Firebase / Direct | Stores / Firebase |
| Secrets | Aucun | Keystore secrets |

---

## 🐛 Troubleshooting

### ❌ Workflow échoue : "Gradle build failed"

**Solutions** :

1. Vérifier que `android/` est bien dans le repo
2. Check Java version (doit être 17)
3. Lire les logs Gradle dans Actions

### ❌ Workflow échoue : "No space left on device"

**Solutions** :

1. Le runner GitHub a épuisé son espace
2. Réessayer (rare, généralement temporaire)
3. Optimiser build (réduire assets)

### ❌ Release build non signé

**Vérifier** :

```bash
# Le workflow doit afficher :
✅ "Keystore configuré, signing activé"

# Si affiche :
⚠️  "Pas de keystore configuré, build en mode release non signé"
→ Secrets non configurés
```

**Solution** : Ajouter les secrets `ANDROID_KEYSTORE_*`

### ❌ Firebase distribution échoue

**Causes fréquentes** :

1. `FIREBASE_APP_ID_ANDROID` incorrect
2. Service account JSON invalide
3. App pas créée dans Firebase Console
4. Permissions manquantes dans Firebase IAM

**Solution** :

```bash
# Tester en local d'abord
firebase appdistribution:distribute \
  android/app/build/outputs/apk/debug/app-debug.apk \
  --app YOUR_APP_ID \
  --groups testers
```

---

## 📊 Monitoring

### Voir les Builds

```
GitHub → Actions → Workflows
```

### Télécharger les Artifacts

```
GitHub → Actions → Workflow run → Summary → Artifacts
```

### Logs Détaillés

```
GitHub → Actions → Workflow run → Job → Step
```

---

## 🔗 Liens Utiles

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Android Gradle Plugin](https://developer.android.com/studio/build)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [Capacitor Android Documentation](https://capacitorjs.com/docs/android)

---

**Besoin d'aide ?** Consultez [docs/DEPLOIEMENT-MOBILE.md](../../docs/DEPLOIEMENT-MOBILE.md)

---

## 🎲 Publier une release Android

`android-release.yml` construit l'APK **et publie une release GitHub**, avec
un lien stable à partager. C'est ce qu'il faut pour distribuer le jeu, là où
`android-build.yml` ne produit qu'un artifact temporaire visible dans l'onglet
Actions.

### Lancer une release

Deux façons, au choix :

```bash
# 1. Par un tag (recommandé) — la version vient du tag
git tag v1.0.0
git push origin v1.0.0
```

Ou depuis l'onglet **Actions** → **Release Android** → *Run workflow*, en
saisissant la version à la main.

Le workflow vérifie les types et lance les tests avant de construire : une
release ne part pas si le jeu est cassé.

### ⚠️ Signature de l'APK

**Sans keystore configuré, l'APK produit n'est pas signé — donc pas
installable sur un téléphone.** Le workflow ne bloque pas, mais l'indique
dans la release.

Pour signer, créer une clé une seule fois :

```bash
keytool -genkey -v -keystore schmitt.keystore \
  -alias schmitt -keyalg RSA -keysize 2048 -validity 10000
```

Puis l'encoder et l'ajouter aux secrets du dépôt
(*Settings → Secrets and variables → Actions*) :

```bash
base64 -i schmitt.keystore | pbcopy   # macOS : copie dans le presse-papier
```

| Secret | Contenu |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | le keystore encodé en base64 |
| `ANDROID_KEYSTORE_PASSWORD` | mot de passe du keystore |
| `ANDROID_KEY_ALIAS` | l'alias (`schmitt` ci-dessus) |
| `ANDROID_KEY_PASSWORD` | mot de passe de la clé |

**Garder le fichier keystore en lieu sûr et ne jamais le commiter** : sans
lui, il devient impossible de publier une mise à jour de l'application, et il
faut recréer une fiche Play Store.

### versionCode

Il est fixé automatiquement au numéro de run GitHub, qui croît à chaque
exécution. C'est nécessaire : le Play Store refuse un `versionCode` qui
n'augmente pas.
