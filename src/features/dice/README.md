# Système de Dés 3D Physiques

Ce module fournit un système complet de dés 3D avec physique réaliste pour Schmitt Odyssée.

## Architecture

```
src/features/dice/
├── DiceConfig.ts      # Configuration physique et visuelle
├── DicePhysics.ts     # Moteur physique (gravité, friction, collisions)
├── Dice3D.ts          # Classe principale d'un dé
├── DiceManager.ts     # Gestionnaire de dés multiples
├── index.ts           # Point d'entrée du module
└── README.md          # Ce fichier
```

## Utilisation

### Initialisation

```typescript
import { DiceManager } from '@/features/dice';

// Créer le gestionnaire de dés
const diceManager = new DiceManager('boardCamera');
```

### Lancer un dé normal

```typescript
// Lancer le dé avec une valeur aléatoire
const result = await diceManager.rollNormalDice();
console.log(`Résultat: ${result}`); // 1-6

// Lancer le dé avec une valeur spécifique (pour le debug)
const result = await diceManager.rollNormalDice(5);
```

### Lancer deux dés (normal + pouvoir des dieux)

```typescript
const result = await diceManager.rollBothDice();
console.log(`Dé normal: ${result.normalDice}`);
console.log(`Dé pouvoir: ${result.godPowerDice}`);
console.log(`Total: ${result.total}`);
```

## Configuration Physique

Vous pouvez personnaliser le comportement physique des dés :

```typescript
import { DiceManager } from '@/features/dice';

const diceManager = new DiceManager('boardCamera', {
  gravity: 980,           // Gravité (pixels/s²)
  friction: 0.92,         // Friction (0-1)
  bounce: 0.5,            // Rebond (0-1)
  rotationSpeedMin: 720,  // Vitesse rotation min (degrés/s)
  rotationSpeedMax: 1440, // Vitesse rotation max (degrés/s)
  velocityMin: 200,       // Vitesse linéaire min (pixels/s)
  velocityMax: 400,       // Vitesse linéaire max (pixels/s)
  animationDuration: 2000,// Durée max de l'animation (ms)
  stopThreshold: 5        // Seuil d'arrêt (pixels/s)
});
```

### Presets de lancer

```typescript
import { THROW_PRESETS } from '@/features/dice';

// Lancer doux
diceManager.updatePhysicsConfig(THROW_PRESETS.gentle);

// Lancer normal
diceManager.updatePhysicsConfig(THROW_PRESETS.normal);

// Lancer fort
diceManager.updatePhysicsConfig(THROW_PRESETS.strong);
```

## Configuration Visuelle

Les dés ont deux apparences différentes :

### Dé Normal (blanc)
- Face: blanc
- Bordure: gris clair
- Points: noir

### Dé Pouvoir des Dieux (doré)
- Face: or (#ffd700)
- Bordure: or foncé (#b8860b)
- Points: marron (#8b4513)
- Ombre: dorée lumineuse

## API du DiceManager

### Méthodes principales

- `rollNormalDice(targetValue?: number): Promise<number>`
  - Lance le dé normal
  - Retourne la valeur (1-6)

- `rollBothDice(normalTarget?: number, godPowerTarget?: number): Promise<DiceRollResult>`
  - Lance les deux dés en même temps
  - Retourne `{ normalDice, godPowerDice, total }`

- `hideAll(): void`
  - Cache tous les dés

- `showNormalDice(): void`
  - Affiche uniquement le dé normal

- `isAnyDiceRolling(): boolean`
  - Vérifie si un dé est en mouvement

- `updatePhysicsConfig(config: Partial<DicePhysicsConfig>): void`
  - Met à jour la configuration physique

- `destroy(): void`
  - Nettoie les ressources

## Physique Implémentée

Le moteur physique simule :

✅ **Gravité** - Les dés "tombent" (simulation simplifiée au sol)
✅ **Friction** - Les dés ralentissent progressivement
✅ **Rebond** - Les dés rebondissent sur les bords
✅ **Rotation** - Les dés tournent de manière réaliste
✅ **Collisions** - Détection des collisions avec les bords
✅ **Inertie** - Les dés conservent leur moment

## Exemple d'intégration complète

```typescript
import { DiceManager } from '@/features/dice';

class Game {
  private diceManager: DiceManager;

  constructor() {
    this.diceManager = new DiceManager('boardCamera');
  }

  async playerTurn() {
    // Joueur normal
    const result = await this.diceManager.rollNormalDice();
    this.movePlayer(result);

    // Joueur avec pouvoir des dieux activé
    const godResult = await this.diceManager.rollBothDice();
    this.movePlayer(godResult.total);
  }

  cleanup() {
    this.diceManager.destroy();
  }
}
```

## Notes Techniques

- Les dés sont rendus en CSS 3D (pas de WebGL)
- La physique utilise `requestAnimationFrame` pour des animations fluides
- Les collisions sont gérées avec des AABB (Axis-Aligned Bounding Boxes)
- Le système est optimisé pour fonctionner à 60 FPS

## Améliorations Futures

- [ ] Collisions entre dés
- [ ] Effets sonores
- [ ] Effets de particules au lancer
- [ ] Support de plus de 2 dés simultanés
- [ ] Rejouer l'animation au clic
- [ ] Statistiques de lancer (historique)
