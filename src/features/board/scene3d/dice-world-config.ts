import type { DicePhysicsConfig } from '@/features/dice/DiceConfig';

/**
 * Réglages du dé à l'échelle du MONDE 3D.
 *
 * `DEFAULT_DICE_CONFIG` a été calibrée pour un dé de 52 px dans une boîte
 * d'écran de quelques centaines de pixels. Branchée telle quelle dans un monde
 * où une case fait 120 unités et le plateau 1215 × 675, elle produit un dé qui
 * parcourt QUARANTE-CINQ unités en tout : il est lâché sur place, rebondit sur
 * place et s'arrête sur place. C'est ce que Quentin décrivait — « je ne le vois
 * pas se déplacer sur le plateau ».
 *
 * Ces valeurs ne corrigent aucun défaut de `DicePhysics`, qui simule déjà le
 * contact au sol, le rebond, la friction et les collisions. Elles mettent
 * seulement ses nombres à l'échelle du monde où elle travaille maintenant.
 *
 * `DicePhysics` reçoit sa configuration par son constructeur : c'est le point
 * d'extension prévu, et rien n'est modifié dans le module partagé avec le
 * rendu CSS qui tourne sur `main`.
 */

/** Arête du dé, en unités monde. Référence de toutes les autres valeurs. */
export const DIE_EDGE = 86;

/**
 * Vitesse de lancer, en unités par seconde.
 *
 * Choisie POUR SE LIRE À L'ÉCRAN, et non pour un réalisme maximal. La vue
 * suivie de #45 cadre une fenêtre de sept cases de côté : un dé qui la
 * quitterait pendant son roulement disparaîtrait sous les yeux du joueur.
 *
 * Mesuré sur 200 lancers depuis le centre, le rayon parcouru :
 *
 *   700-1400  médiane 3,3 cases, max 4,4  → sort du cadre 80 fois sur 200
 *   500-900   médiane 2,2 cases, max 2,8  → ne sort jamais
 *   350-650   médiane 1,6 case,  max 2,0  → ne sort jamais, mais court
 *   180-380   médiane 0,9 case             → l'ancien réglage d'écran
 *
 * 500-900 est le compromis : le dé traverse deux bonnes cases, ce qui se voit
 * franchement, et reste dans le cadre à tous les coups.
 */
const VELOCITY_MIN = 500;
const VELOCITY_MAX = 900;

export const WORLD_DICE_CONFIG: DicePhysicsConfig = {
  size: DIE_EDGE,

  // La gravité suit l'échelle : un monde dix fois plus grand doit tomber dix
  // fois plus vite pour que la chute dure aussi longtemps qu'à l'écran.
  gravity: 5200,

  // Un peu plus de frottement qu'à l'écran : un dé lancé fort doit s'arrêter
  // en une poignée de cases, pas continuer sur tout le plateau.
  friction: 0.975,

  // Un dé de jeu rebondit peu sur une table : il claque et repart bas.
  bounce: 0.38,

  rotationSpeedMin: 540,
  rotationSpeedMax: 1080,

  velocityMin: VELOCITY_MIN,
  velocityMax: VELOCITY_MAX,

  animationDuration: 3000,

  // Le seuil d'arrêt suit l'échelle, sinon le dé s'immobilise alors qu'il
  // avance encore visiblement d'une demi-case par seconde.
  stopThreshold: 55,
};

/**
 * Vitesse de rotation imposée par le roulement, en radians par seconde.
 *
 * C'est le lien qui manquait, et celui que Quentin appelle « la physique ».
 * Dans `DicePhysics`, la rotation et le déplacement sont indépendants : le dé
 * tourne à 11 rad/s pendant qu'il glisse à 35 unités/s. Sur un dé réel qui
 * roule sans glisser, la rotation est IMPOSÉE par le déplacement — un cube
 * d'arête `a` qui avance de `v` bascule à `2·v/a`.
 *
 * Sans cette liaison on voit un cube qui tourne en glissant ; avec elle, un dé
 * qui roule.
 */
export function rollingSpinRate(speed: number, edge: number = DIE_EDGE): number {
  if (edge <= 0) return 0;

  return (2 * Math.abs(speed)) / edge;
}
