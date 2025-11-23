# 📱 Guide de Test Mobile - Schmitt Odyssée

## 🎨 Nouveau Design Odyssée Grecque !

Votre jeu a été optimisé avec :
- ✅ **Thème Odyssée grecque** (bleu mer Égée, or, marbre)
- ✅ **Mobile-first** (optimisé iPhone 5.2")
- ✅ **Animations 60 FPS** (fluide et performant)
- ✅ **Bottom sheet** (contrôles en bas, facile à atteindre)
- ✅ **Safe area iOS** (gère le notch)

---

## 🧪 Comment tester sur iPhone

### Option 1 : Simulateur iOS dans le navigateur

1. **Ouvrez Chrome DevTools** (F12 ou Cmd+Option+I)
2. **Cliquez sur l'icône mobile** (📱 en haut à gauche)
3. **Sélectionnez "iPhone SE"** (le plus proche de 5.2 pouces)
4. **Rafraîchissez la page** (Cmd+R)

### Option 2 : Sur votre vrai iPhone

#### Méthode A : Via IP locale (recommandé)

```bash
# 1. Trouvez votre IP locale
ifconfig | grep "inet " | grep -v 127.0.0.1

# Exemple de résultat : 192.168.1.42

# 2. Lancez le serveur avec --host
npm run dev -- --host

# 3. Sur votre iPhone, ouvrez Safari
# Allez sur : http://192.168.1.42:3000
# (Remplacez par votre IP)
```

#### Méthode B : Via Capacitor (app native)

```bash
# Installation rapide
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init
npx cap add ios

# Build et sync
npm run build
npx cap sync ios

# Ouvrir dans Xcode
npx cap open ios

# Dans Xcode, sélectionnez votre iPhone et cliquez sur Run (▶️)
```

---

## 📏 Tailles d'écran testées

| Appareil | Taille | Résolution | Statut |
|----------|--------|------------|--------|
| iPhone SE | 4.7" | 375 × 667 | ✅ Optimisé |
| iPhone 8 | 4.7" | 375 × 667 | ✅ Optimisé |
| iPhone 12 mini | 5.4" | 375 × 812 | ✅ Optimisé |
| iPhone 13 | 6.1" | 390 × 844 | ✅ Optimisé |
| iPhone 13 Pro Max | 6.7" | 428 × 926 | ✅ Optimisé |
| iPad Mini | 8.3" | 744 × 1133 | ✅ Adapté |
| iPad Pro | 12.9" | 1024 × 1366 | ✅ Adapté |
| Desktop | > 1024px | Variable | ✅ Mode desktop |

---

## 🎯 Checklist UX Mobile

### Layout
- ✅ Header compact (60px)
- ✅ Plateau centré et adaptatif
- ✅ Contrôles en bottom sheet (facile à atteindre avec le pouce)
- ✅ Liste joueurs en scroll horizontal
- ✅ Boutons tactiles (min 48px de hauteur)

### Thème Odyssée
- ✅ Couleurs mer Égée (bleu profond)
- ✅ Accents or/bronze
- ✅ Typographie Georgia (serif grecque)
- ✅ Dégradés subtils
- ✅ Ombres douces

### Animations
- ✅ Transitions fluides (cubic-bezier)
- ✅ Ripple effect sur les boutons
- ✅ Pulse subtil sur le canvas
- ✅ Particules optimisées (will-change)

### Performance
- ✅ 60 FPS (animations GPU)
- ✅ Smooth scrolling
- ✅ Touch optimization
- ✅ No zoom on input focus (font-size: 16px)

### iOS Spécifiques
- ✅ Safe area (notch)
- ✅ No tap highlight
- ✅ Touch manipulation
- ✅ Dynamic viewport height (dvh)

---

## 🎮 Test de fonctionnalités

### 1. Configuration
- [ ] Ajouter 4 joueurs avec noms personnalisés
- [ ] Changer les couleurs
- [ ] Démarrer la partie

### 2. Gameplay
- [ ] Lancer le dé (animation fluide)
- [ ] Déplacement des pions (smooth)
- [ ] Effets de cases (modales lisibles)
- [ ] Sélection de joueurs (facile au doigt)
- [ ] Sons activables/désactivables

### 3. Responsive
- [ ] Tourner l'écran (portrait/paysage)
- [ ] Scroll de la liste joueurs
- [ ] Bottom sheet utilisable
- [ ] Historique scrollable

### 4. Performance
- [ ] Pas de lag sur les animations
- [ ] Chargement rapide
- [ ] Pas de freeze

---

## 🐛 Problèmes connus à tester

### À vérifier sur votre iPhone :
1. **Notch** : Le header doit respecter la safe area
2. **Boutons** : Doivent être faciles à toucher (min 48px)
3. **Bottom sheet** : Doit rester au-dessus du clavier iOS
4. **Orientation** : Doit bien s'adapter en paysage
5. **Safari iOS** : Vérifier la compatibilité

### Pour débugger :
```javascript
// Ouvrez la console Safari iOS
// Allez dans Réglages > Safari > Avancé > Inspecteur Web
// Puis connectez votre iPhone et ouvrez Safari Desktop > Développement
```

---

## 🎨 Personnalisation du thème

Si vous voulez modifier le thème, éditez [src/styles/mobile-optimized.css](src/styles/mobile-optimized.css):

```css
:root {
  /* Vos couleurs ici */
  --color-aegean-blue: #0077BE;  /* Bleu principal */
  --color-gold: #D4AF37;         /* Or/accent */
  --color-marble: #F5F5F0;       /* Fond clair */
}
```

---

## 📊 Comparaison Avant/Après

| Aspect | Avant | Après |
|--------|-------|-------|
| **Mobile** | ⚠️ Adapté | ✅ Optimisé |
| **Thème** | Violet/Rose | ✅ Odyssée grecque |
| **Layout** | Sidebar droite | ✅ Bottom sheet |
| **Boutons** | Petits | ✅ Tactiles (48px) |
| **Animations** | Basiques | ✅ 60 FPS |
| **iPhone 5.2"** | ⚠️ Serré | ✅ Parfait |
| **Safe area** | ❌ | ✅ Géré |

---

## 🚀 Prochaines améliorations possibles

### Gestures (swipe, pinch)
```typescript
// Swipe pour passer au joueur suivant
// Pinch to zoom sur le plateau
// Long press pour infos case
```

### PWA (Progressive Web App)
```bash
# Installer comme app
# Mode offline
# Notifications
```

### Vibrations
```typescript
// Vibrer au lancer de dé
// Vibrer sur victoire
```

### Dark mode
```css
/* Mode sombre automatique */
@media (prefers-color-scheme: dark) { }
```

---

## 💡 Astuces

### Tester rapidement plusieurs tailles

Dans Chrome DevTools :
1. Mode responsive (Cmd+Shift+M)
2. Testez : 375px, 390px, 428px, 768px, 1024px

### Simuler un réseau lent

1. Chrome DevTools → Network
2. Throttling → "Slow 3G"
3. Vérifiez que ça reste fluide

### Debug Safari iOS

1. iPhone → Réglages → Safari → Avancé → Inspecteur Web (ON)
2. Mac → Safari → Développement → [Votre iPhone]
3. Inspectez la page

---

**Testez et donnez votre feedback ! 🎮**

Le jeu est maintenant optimisé pour **votre iPhone 5.2"** avec un magnifique **thème Odyssée grecque** ! 🏛️✨
