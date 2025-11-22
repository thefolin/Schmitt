/**
 * Configuration physique des dés
 * Permet d'ajuster le comportement physique
 */

export interface DicePhysicsConfig {
  // Taille du dé
  size: number;

  // Gravité
  gravity: number;

  // Friction (ralentissement sur la surface)
  friction: number;

  // Rebond (elasticité)
  bounce: number;

  // Vitesse de rotation initiale (min/max)
  rotationSpeedMin: number;
  rotationSpeedMax: number;

  // Vitesse linéaire initiale (min/max)
  velocityMin: number;
  velocityMax: number;

  // Durée de l'animation
  animationDuration: number;

  // Seuil d'arrêt (vitesse en dessous de laquelle le dé s'arrête)
  stopThreshold: number;
}

export interface DiceVisualConfig {
  // Couleurs
  faceColor: string;
  faceBorderColor: string;
  dotColor: string;

  // Taille des points (pour afficher les valeurs)
  dotSize: number;

  // Ombre
  shadowBlur: number;
  shadowColor: string;

  // Perspective 3D
  perspective: number;
}

/**
 * Configuration par défaut pour un dé normal
 */
export const DEFAULT_DICE_CONFIG: DicePhysicsConfig = {
  size: 60,
  gravity: 980, // pixels/s²
  friction: 0.88,
  bounce: 0.6,
  rotationSpeedMin: 1440, // degrés/s (4 tours/sec min)
  rotationSpeedMax: 2880, // degrés/s (8 tours/sec max)
  velocityMin: 300, // pixels/s
  velocityMax: 600,
  animationDuration: 2500, // ms
  stopThreshold: 3 // pixels/s
};

/**
 * Configuration visuelle par défaut
 */
export const DEFAULT_VISUAL_CONFIG: DiceVisualConfig = {
  faceColor: '#ffffff',
  faceBorderColor: '#dddddd',
  dotColor: '#333333',
  dotSize: 8,
  shadowBlur: 15,
  shadowColor: 'rgba(0, 0, 0, 0.4)',
  perspective: 600
};

/**
 * Configuration pour le dé des pouvoirs des dieux (doré)
 */
export const GOD_POWER_VISUAL_CONFIG: DiceVisualConfig = {
  faceColor: '#ffd700',
  faceBorderColor: '#b8860b',
  dotColor: '#8b4513',
  dotSize: 8,
  shadowBlur: 20,
  shadowColor: 'rgba(255, 215, 0, 0.6)',
  perspective: 600
};

/**
 * Paramètres de lancer prédéfinis
 */
export const THROW_PRESETS = {
  gentle: {
    velocityMin: 100,
    velocityMax: 200,
    rotationSpeedMin: 360,
    rotationSpeedMax: 720
  },
  normal: {
    velocityMin: 200,
    velocityMax: 400,
    rotationSpeedMin: 720,
    rotationSpeedMax: 1440
  },
  strong: {
    velocityMin: 400,
    velocityMax: 600,
    rotationSpeedMin: 1440,
    rotationSpeedMax: 2160
  }
};
