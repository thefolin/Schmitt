/**
 * Quels dés sont posés sur le plateau, et à quel moment.
 *
 * Quentin (20/09/2026) : « il en sort 3, tu dois en avoir 2 ».
 *
 * LE DÉFAUT : le dé du tour et les deux dés de la faveur sont trois objets
 * distincts dans la même scène. Faire apparaître les deux dés de la faveur
 * sans retirer celui du tour en laissait TROIS sur le plateau, et la somme
 * annoncée ne correspondait à aucune paire évidente — le joueur ne pouvait
 * plus recompter, ce qu'il fait forcément dans un jeu à boire.
 *
 * La règle est simple et tient en une phrase : PENDANT LA FAVEUR, seuls les
 * deux dés de la faveur sont visibles ; le reste du temps, seul le dé du
 * tour. Jamais les trois.
 *
 * Elle vit ici, séparée du rendu, pour être vérifiable : jsdom n'a pas de
 * WebGL, mais la visibilité d'un objet est un simple booléen, et c'est
 * exactement ce que le défaut a mis en défaut.
 */

/** Ce qui doit être visible, selon le moment de la partie. */
export interface DiceVisibility {
  /** Le dé du tour, celui qu'on lance pour avancer. */
  turn: boolean;
  /** Les deux dés de la faveur des dieux. */
  favor: boolean;
}

/**
 * Ce qu'on montre pendant un tirage de faveur.
 *
 * Le dé du tour S'EFFACE. Il n'est pas seulement inutile pendant la faveur :
 * laissé en place, il fait trois dés sur le plateau et rend la somme
 * illisible.
 */
export function duringFavor(): DiceVisibility {
  return { turn: false, favor: true };
}

/** Ce qu'on montre le reste du temps : le dé du tour, et lui seul. */
export function betweenFavors(): DiceVisibility {
  return { turn: true, favor: false };
}

/**
 * Le nombre de dés posés sur le plateau, quel que soit le moment.
 *
 * C'est la vérification qui compte, et celle que Quentin a faite à l'œil :
 * on ne doit jamais en voir trois.
 */
export function diceOnStage(visibility: DiceVisibility): number {
  return (visibility.turn ? 1 : 0) + (visibility.favor ? 2 : 0);
}
