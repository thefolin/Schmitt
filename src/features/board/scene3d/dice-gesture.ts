import { WORLD_DICE_CONFIG } from './dice-world-config';

/**
 * Traduire un geste du doigt en lancer de dé.
 *
 * Quentin : « faire comme un vrai joueur — le doigt appuie, on saisit, on
 * glisse, on relâche ».
 *
 * La traduction vit ici, séparée de la scène, parce qu'elle décide de la
 * SENSATION du lancer — et qu'une sensation se règle par la mesure plutôt
 * qu'à l'estime. Le module ne connaît ni Three.js ni le DOM.
 *
 * LE PIÈGE : le geste est en pixels d'écran, la physique en unités monde. Un
 * glissement de 200 px n'est pas un lancer de 200 unités, et le rapport entre
 * les deux dépend de la distance à laquelle le plateau est vu. Sans en tenir
 * compte, le même geste lancerait deux fois plus fort en vue rapprochée qu'en
 * vue d'ensemble — et le joueur ne saurait jamais quelle force il met.
 */

/** Hauteur dont le dé se soulève quand on le tient, en unités monde. */
export const GRAB_LIFT = 34;

/** En deçà, le doigt n'a pas lancé : il a hésité. */
const MIN_SWIPE_PIXELS = 24;

/**
 * Lancer minimal, en unités par seconde.
 *
 * Un effleurement doit quand même faire rouler le dé. Sans plancher, le
 * joueur croit que l'application n'a pas répondu et il réessaie.
 */
export const MIN_SWIPE_SPEED = WORLD_DICE_CONFIG.velocityMin;

/** Au-delà, on plafonne : un dé expédié trop fort rebondit contre les murs. */
const MAX_SWIPE_SPEED = WORLD_DICE_CONFIG.velocityMax;

/**
 * Vigueur de geste qui donne un lancer à pleine puissance.
 *
 * Mesuré sur des gestes plausibles : un glissement vif de 300 px en 120 ms,
 * vu à l'échelle du plateau entier, produit environ 10 000 unités/s. C'est le
 * geste franc qu'on fait pour lancer un dé sur une table ; au-delà, on
 * plafonne.
 */
const REFERENCE_SWIPE = 10000;

export interface SwipeRequest {
  /** Déplacement du doigt, en pixels écran. */
  dx: number;
  dy: number;
  /** Durée du geste, en millisecondes. */
  ms: number;
  /** Combien d'unités monde vaut un pixel, à la distance où l'on regarde. */
  worldPerPixel: number;
}

export interface ThrowRequest {
  /** Le geste était-il un lancer, ou un simple appui ? */
  thrown: boolean;
  /** Vitesse dans le plan du plateau, en unités par seconde. */
  velocity: { x: number; y: number };
  /** Norme de cette vitesse. */
  speed: number;
  /** Vitesse verticale donnée au dé, pour qu'il décolle un peu. */
  verticalVelocity: number;
}

export function swipeToThrow(request: SwipeRequest): ThrowRequest {
  const { dx, dy, ms, worldPerPixel } = request;

  const pixels = Math.hypot(dx, dy);

  if (pixels < MIN_SWIPE_PIXELS) {
    return { thrown: false, velocity: { x: 0, y: 0 }, speed: 0, verticalVelocity: 0 };
  }

  // Une durée plancher : deux événements dans la même image donneraient une
  // division par zéro, donc une vitesse infinie.
  const seconds = Math.max(ms, 16) / 1000;

  // Pixels par seconde, convertis à l'échelle où le plateau est vu.
  const raw = (pixels / seconds) * worldPerPixel;

  // Le geste est RAMENÉ sur la plage de lancer, il n'y est pas simplement
  // rogné. Mesuré, un geste réel produit de 60 à 20 000 unités/s selon sa
  // vivacité et la distance de la caméra, alors que la plage utile du dé va
  // de 500 à 900 : tout rogner écraserait la quasi-totalité des gestes sur
  // l'une ou l'autre borne, et le joueur n'aurait aucun contrôle.
  //
  // La progression est en RACINE plutôt que linéaire : un geste deux fois
  // plus vif ne lance pas deux fois plus loin. C'est ce qui donne du contrôle
  // dans les gestes courants sans rendre les gestes violents inutilisables.
  const normalised = Math.min(1, Math.sqrt(raw / REFERENCE_SWIPE));
  const speed = MIN_SWIPE_SPEED + (MAX_SWIPE_SPEED - MIN_SWIPE_SPEED) * normalised;

  // La direction suit le doigt. L'écran a son Y vers le bas et le plateau sa
  // profondeur vers l'avant : glisser vers le haut doit ÉLOIGNER le dé, ce
  // que le signe conserve tel quel puisque les deux axes pointent dans le
  // même sens une fois la caméra en plongée.
  const nx = dx / pixels;
  const ny = dy / pixels;

  return {
    thrown: true,
    velocity: { x: nx * speed, y: ny * speed },
    speed,
    // Le dé décolle proportionnellement à la vigueur : un lancer mou le fait
    // glisser, un lancer franc le fait sauter.
    verticalVelocity: -(200 + (speed / MAX_SWIPE_SPEED) * 400),
  };
}
