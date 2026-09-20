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

/**
 * Arête du dé, en unités monde. Référence de toutes les autres valeurs.
 *
 * Quentin (20/09/2026) : « le dé est gros ».
 *
 * Il l'était : 86 sur une case de 120, soit 72 % de la case. Un dé posé sur
 * une case en cachait presque toute l'illustration, et deux dés de faveur
 * côte à côte occupaient la moitié de la largeur du plateau.
 *
 * 58 le met à 48 % de la case — la proportion d'un vrai dé sur un vrai
 * plateau. Il reste largement assez gros pour qu'on lise sa face et qu'on
 * l'attrape au doigt : 58 unités font environ 19 px sur un Pixel 10 en vue
 * suivie, au-dessus des 48 px de cible tactile une fois la zone de prise
 * comptée autour.
 *
 * Elle sert AUSSI au rendu (`dice-3d-scene`), qui ne la redéclare plus : la
 * même valeur à deux endroits finit par diverger, et un dé dessiné plus grand
 * que le dé simulé traverserait les bords du plateau.
 */
export const DIE_EDGE = 58;

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
 * CETTE PLAGE A ÉTÉ ÉLARGIE le 20/09/2026. Quentin : « je voudrais une
 * sensation de lancer ». Il n'y en avait pas, et la mesure le montrait sans
 * ambiguïté : entre un geste tout doux et un geste violent, le dé parcourait
 * 1,75 puis 2,36 case — et au-delà la distance REDESCENDAIT, le dé rebondissant
 * contre les murs. Le joueur pouvait mettre toute la force qu'il voulait, il
 * obtenait toujours la même chose.
 *
 * La cause tenait à la plage elle-même : 500-900 est trop étroite pour que la
 * physique réponde. Mesuré sur 80 lancers par palier, avec le dé ramené à 58 :
 *
 *   400   1,1 case      le geste hésitant
 *   650   2,1 cases
 *   800   2,7 cases
 *   1100  3,5 cases
 *   1200  3,6 cases     le geste franc
 *   1500  saturation, la distance cesse de croître
 *
 * ÉLARGIE ENCORE le 20/09/2026. Quentin : « je ne le vois pas assez rouler,
 * j'ai une sale sensation à voir les dés rouler ».
 *
 * La ROTATION n'était pas en cause, et c'est ce que la mesure a montré : un
 * dé qui roule sans glisser montre une nouvelle face tous les 58 unités,
 * c'est-à-dire tous les demi-pas de case. Avec 2,2 cases parcourues, il ne
 * montrait donc que 4 ou 5 faces sur toute sa course — trop peu pour qu'on
 * voie un dé rouler plutôt que glisser.
 *
 * Le remède n'est pas de le faire tourner plus vite, ce qui donnerait un dé
 * qui patine : c'est de le faire aller PLUS LOIN. La friction n'y change
 * presque rien — la vitesse tombe surtout aux rebonds, pas par frottement —
 * donc tout se joue sur la vitesse de lancer. Mesuré sur 60 lancers par
 * palier, avec le dé à 58 :
 *
 *    400   0,8 case    1,7 face vue
 *    800   1,6 case    3,4 faces
 *   1200   2,5 cases   5,1 faces
 *   1800   3,3 cases   6,9 faces
 *   2400   4,0 cases   8,3 faces
 *   3000   saturation, la distance cesse de croître
 *
 * 500-2300 fait donc parcourir de 1 à 4 cases, soit de 2 à 8 faces montrées :
 * on VOIT le dé rouler. La durée reste autour de la seconde, elle dépend peu
 * de la vigueur.
 *
 * Ce réglage n'est possible que depuis que le dé a été réduit à 58 (#62) : à
 * 86, le même parcours aurait couvert beaucoup plus de plateau.
 *
 * La borne de 900 avait été posée pour que le dé ne quitte pas la fenêtre de
 * sept cases de la vue suivie. Cette crainte était infondée : la caméra SUIT
 * le dé pendant qu'il roule (`followPoint` à chaque image), donc la fenêtre se
 * déplace avec lui et il ne peut pas sortir de l'écran.
 */
const VELOCITY_MIN = 500;
const VELOCITY_MAX = 2300;

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
