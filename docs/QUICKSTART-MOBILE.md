# ⚡ Quick Start - Déploiement Mobile

Guide rapide pour tester l'application sur Android avant la fin du mois.

---

## 🎯 Objectif

**Distribuer l'app Android à des testeurs via Firebase App Distribution** (sans passer par Google Play Store).

**Timeline** : 1-2 jours maximum

---

## 📋 Checklist Rapide

### Étape 1 : Vérification Locale (30 min)

```bash
# 1. Vérifier Node.js
node --version  # Doit être >=18 (actuellement v20.19.5)

# 2. Build web
npm run build:mobile

# 3. Sync Android
npx cap sync android

# 4. Ouvrir Android Studio
npx cap open android

# 5. Dans Android Studio : Run (▶️)
# → L'app doit se lancer sur l'émulateur
```

✅ **Si l'app se lance** → Passer à l'étape 2
❌ **Si erreur** → Voir [DEPLOIEMENT-MOBILE.md](DEPLOIEMENT-MOBILE.md#troubleshooting)

---

### Étape 2 : Configuration Firebase (1h)

#### 2.1 Créer un Projet Firebase

1. Aller sur [console.firebase.google.com](https://console.firebase.google.com)
2. **"Ajouter un projet"**
3. Nom : **Schmitt Odyssée**
4. Désactiver Google Analytics (pas nécessaire pour l'instant)
5. **Créer le projet**

#### 2.2 Ajouter l'App Android

1. Cliquer sur l'icône **Android** (⚙️)
2. **Nom du package Android** : `com.schmittodyssee.app`
3. **Ignorer** le téléchargement de `google-services.json` (pas obligatoire pour App Distribution)
4. **Continuer** → **Terminer**

#### 2.3 Activer App Distribution

1. Dans le menu Firebase → **App Distribution**
2. **Premiers pas** (si c'est votre première fois)

#### 2.4 Créer un Groupe de Testeurs

1. App Distribution → **Testeurs et groupes**
2. **Ajouter un groupe** → Nom : `testers`
3. **Ajouter des testeurs** → Entrer les emails (séparés par virgule)
4. **Enregistrer**

#### 2.5 Récupérer les Identifiants

**Firebase App ID** :

1. Firebase Console → ⚙️ **Project Settings** → **General**
2. Descendre vers "Vos applications"
3. Copier le **Firebase App ID** (format : `1:123456789:android:abc123`)

**Service Account JSON** :

1. Firebase Console → ⚙️ **Project Settings** → **Service accounts**
2. **Générer une nouvelle clé privée**
3. Télécharger le fichier JSON
4. Ouvrir le fichier et **copier tout le contenu**

---

### Étape 3 : Configuration GitHub Secrets (15 min)

1. Aller sur votre repo GitHub
2. **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret**

**Ajouter 2 secrets** :

#### Secret 1 : `FIREBASE_APP_ID_ANDROID`

```
Nom : FIREBASE_APP_ID_ANDROID
Valeur : 1:123456789:android:abc123
(collez votre Firebase App ID)
```

#### Secret 2 : `FIREBASE_SERVICE_ACCOUNT_JSON`

```
Nom : FIREBASE_SERVICE_ACCOUNT_JSON
Valeur : { "type": "service_account", "project_id": "...", ... }
(collez tout le contenu du JSON téléchargé)
```

✅ **Vérifier** : Vous devez avoir 2 secrets configurés

---

### Étape 4 : Premier Déploiement (10 min)

#### 4.1 Lancer le Workflow GitHub Actions

1. GitHub → **Actions** → **"Distribute to Firebase App Distribution"**
2. **Run workflow** (bouton bleu)
3. **Paramètres** :
   - `platform` : **android**
   - `release_notes` : `Version de test initiale`
4. **Run workflow** ✅

#### 4.2 Attendre le Build

⏱️ Durée : **5-10 minutes**

**Statut** : Vous verrez des checkmarks verts ✅ au fur et à mesure

#### 4.3 Vérifier le Succès

✅ **Si tout est vert** :
- Le workflow est complété
- L'APK est uploadé sur Firebase

❌ **Si erreur rouge** :
- Cliquer sur le workflow
- Lire les logs de l'étape qui a échoué
- Voir [Troubleshooting](#troubleshooting-rapide)

---

### Étape 5 : Distribution aux Testeurs (5 min)

#### 5.1 Vérifier dans Firebase Console

1. Firebase → **App Distribution** → **Versions**
2. Vous devez voir votre version avec "Version de test initiale"

#### 5.2 Les Testeurs Reçoivent un Email

Sujet : **"You're invited to test Schmitt Odyssée"**

Contenu :
- Lien pour télécharger l'app
- Instructions d'installation

#### 5.3 Installation sur Android

**Pour les testeurs** :

1. Ouvrir l'email sur le téléphone Android
2. Cliquer sur **"Download the latest build"**
3. **Autoriser l'installation d'apps inconnues** (si demandé)
4. Installer l'APK
5. Ouvrir **"Schmitt Odyssée"** ✅

---

## 🎉 Succès !

Vous avez maintenant :

- ✅ Build Android fonctionnel
- ✅ Firebase App Distribution configuré
- ✅ Workflow CI/CD automatisé
- ✅ Testeurs peuvent télécharger l'app

---

## 🔄 Itérations Futures

Pour distribuer une nouvelle version :

```bash
1. Faire vos modifications dans le code
2. Commit + Push sur GitHub
3. GitHub → Actions → "Distribute to Firebase App Distribution"
4. Run workflow avec nouvelles release notes
5. Les testeurs reçoivent automatiquement la notification
```

**Fréquence recommandée** : 1-2 fois par semaine pendant la phase de test

---

## 🐛 Troubleshooting Rapide

### ❌ Workflow échoue : "Firebase App ID not found"

**Cause** : Secret `FIREBASE_APP_ID_ANDROID` mal configuré

**Solution** :

1. Vérifier que le secret existe dans GitHub
2. Vérifier le format : `1:123456789:android:abc123`
3. Pas d'espaces avant/après

### ❌ Workflow échoue : "Service account error"

**Cause** : JSON invalide ou permissions manquantes

**Solution** :

1. Re-télécharger le JSON depuis Firebase
2. Vérifier que vous avez copié **tout** le contenu
3. Le JSON doit commencer par `{` et finir par `}`

### ❌ Testeurs ne reçoivent pas l'email

**Solutions** :

1. Vérifier que les emails sont corrects dans Firebase
2. Vérifier les spams
3. Firebase → App Distribution → Versions → **Distribuer** manuellement

### ❌ "App not installed" sur Android

**Solutions** :

1. Désinstaller l'ancienne version (si existe)
2. Activer "Install unknown apps" pour le navigateur
3. Réessayer l'installation

### ❌ L'app crash au lancement

**Diagnostic** :

```bash
# Connecter le device via USB
# Activer USB Debugging
# Lancer l'app et voir les logs :
adb logcat | grep Schmitt
```

**Solution** : Partager les logs pour debug

---

## 📞 Besoin d'Aide ?

- **Documentation complète** : [DEPLOIEMENT-MOBILE.md](DEPLOIEMENT-MOBILE.md)
- **Workflows GitHub** : [.github/workflows/README.md](../.github/workflows/README.md)
- **Plugins natifs** : [../src/features/native/capacitor-plugins.ts](../src/features/native/capacitor-plugins.ts)

---

## 📅 Timeline Réaliste

| Jour | Actions | Durée |
|------|---------|-------|
| **Jour 1** | Steps 1-3 : Local + Firebase + GitHub | 2h |
| **Jour 2** | Step 4 : Premier déploiement | 30 min |
| **Jour 2** | Step 5 : Distribution testeurs | 15 min |
| **Jour 3-7** | Tests, feedback, itérations | Variable |

**Total avant premiers tests** : ~3h de configuration + quelques itérations

🎯 **Objectif de fin du mois** : ✅ Atteignable !

---

**Bon déploiement ! 🚀**
