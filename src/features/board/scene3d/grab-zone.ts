/**
 * La zone où le doigt attrape un dé, et qui du dé ou de la caméra prend le
 * geste.
 *
 * Quentin (20/09/2026) : « je ne peux toujours pas déplacer le dé ».
 *
 * DEUX DÉFAUTS SE CACHAIENT DERRIÈRE CETTE PHRASE, et ni la physique ni la
 * traduction du geste n'étaient en cause — les deux avaient été mesurées
 * justes.
 *
 * 1. LE CONFLIT D'ÉVÉNEMENTS. Le dé écoute `pointerdown`, la caméra écoute
 *    `touchstart` : deux familles distinctes, où un `stopPropagation` sur
 *    l'une n'empêche pas l'autre. Poser le doigt sur le dé démarrait donc les
 *    DEUX gestes — on tenait le dé pendant que la caméra tournait sous lui,
 *    et le dé, suivant la vue, paraissait immobile. `touchstart` étant de
 *    surcroît passif, il ne peut pas être annulé : la caméra doit se taire
 *    d'elle-même.
 *
 * 2. LA CIBLE TROP PETITE. Le dé est passé de 86 à 58 unités monde parce
 *    qu'il était trop gros (#62) ; à l'écran, en vue d'ensemble sur un
 *    téléphone, il tombe alors à 37 px — sous les 48 px de cible tactile.
 *    Viser le cube demandait une précision qu'un doigt n'a pas.
 *
 * Les deux règles vivent ici, séparées du rendu, parce qu'elles se vérifient
 * sans canevas : jsdom n'a pas de WebGL et ne propage pas les événements
 * comme un navigateur. Un test qui aurait simulé un `touchstart` serait passé
 * avec le défaut présent.
 */

/**
 * Rayon de tolérance autour du doigt, en pixels d'écran.
 *
 * 12 px portent la cible effective d'un dé de 37 px à une soixantaine, au
 * -dessus des 48 px recommandés, sans empiéter sur le reste du plateau.
 */
export const GRAB_PADDING_PX = 12;

/** Les points sondés autour du doigt, en fractions du rayon de tolérance. */
const OFFSETS: readonly (readonly [number, number])[] = [
  [0, 0],
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
];

/**
 * Les points d'écran à sonder pour savoir si le doigt attrape un dé.
 *
 * Le centre d'abord — c'est le cas courant, et il doit rester le moins cher —
 * puis huit points autour. Le dé n'a pas besoin de GROSSIR pour être
 * attrapable : c'est la zone sensible qui s'élargit, pas l'objet.
 */
export function grabProbes(x: number, y: number): { x: number; y: number }[] {
  return OFFSETS.map(([dx, dy]) => ({
    x: x + dx * GRAB_PADDING_PX,
    y: y + dy * GRAB_PADDING_PX,
  }));
}

/** Qui prend un geste qui commence à cet endroit. */
export type GestureOwner = 'dice' | 'camera';

/**
 * Le dé passe AVANT la caméra.
 *
 * La rotation n'est pas désactivée, elle est seulement précédée : un appui
 * ailleurs que sur un dé continue de tourner la vue. Corriger un défaut en
 * supprimant la rotation en créerait un autre.
 */
export function gestureOwner(onDice: boolean): GestureOwner {
  return onDice ? 'dice' : 'camera';
}
