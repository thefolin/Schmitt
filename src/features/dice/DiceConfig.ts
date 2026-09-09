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
  size: 80, // Volume lisible face à des cases de 120px, et facile à saisir
  gravity: 2200, // px/s² : chute franche, le dé retombe vite au lieu de flotter
  // Friction appliquée PAR FRAME : 0.90 tuait 99,8% de la vitesse en 0,5s
  // (le dé ne roulait pas). 0.985 laisse le dé rouler puis s'arrêter naturellement.
  friction: 0.985,
  bounce: 0.45, // Rebonds courts et amortis, comme sur une vraie table
  rotationSpeedMin: 540, // 1,5 tour/s : le dé roule, il ne fait plus la toupie
  rotationSpeedMax: 1080, // 3 tours/s
  velocityMin: 180, // px/s : lancer contenu, le dé ne traverse plus le plateau
  velocityMax: 380,
  animationDuration: 3000,
  stopThreshold: 12 // px/s : s'immobilise franchement au lieu de dériver
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
