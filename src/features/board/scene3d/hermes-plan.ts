/**
 * Le calcul d'HERMÈS : qui bouge, et où il arrive.
 *
 * « Choisissez un adversaire et déplacez-vous sur sa case OU déplacez-le sur
 * votre case. Appliquez l'effet de la case du nouvel emplacement. » — la
 * faveur de somme 5.
 *
 * DEUX SENS, ET UN SEUL PION BOUGE. Le croquis de Quentin les montre par
 * deux flèches : « Me déplacer » pointe VERS la liste déroulante — je vais
 * sur la case de celui que j'ai choisi — et « Ramener » part de la liste
 * VERS moi — je le tire sur ma case.
 *
 * UN SEUL PION APPLIQUE SA CASE, celui qui a bougé, et c'est Quentin qui l'a
 * tranché : « ça applique l'effet de la case, pour le joueur qui se déplace ».
 * Les deux pions finissent pourtant sur la MÊME case — celui qui n'a pas
 * bougé ne rejoue rien, sinon la case se jouerait deux fois par déplacement.
 *
 * LE DÉPLACEMENT COMPTE MÊME SANS MOUVEMENT. Quand les deux pions étaient
 * déjà sur la même case, l'arrivée vaut quand même arrivée et la case se
 * rejoue : « même s'il se trouve sur la même case d'origine, il est déplacé
 * comme déplacé, et du coup il applique sa case ». C'est une décision de
 * Quentin, pas une déduction — sans elle, Hermès pourrait ne RIEN produire.
 *
 * AUCUN DÉ ICI. Contrairement à Aphrodite et à Poséidon, Hermès ne demande
 * pas de second jet : sa règle n'en parle pas, et Quentin l'a confirmé.
 *
 * Le module ne touche NI aux règles NI à la scène : il dit quel pion va où,
 * et c'est l'appelant qui l'applique.
 */

/** La somme qui désigne HERMÈS sur la table des faveurs. */
export const HERMES_SUM = 5;

/**
 * Les deux sens du croquis.
 *
 * `move` — « Me déplacer » : je vais sur sa case.
 * `bring` — « Ramener » : je le tire sur la mienne.
 */
export type HermesDirection = 'move' | 'bring';

/** Ce que le joueur a arrêté sur l'écran. */
export interface HermesChoice {
  /** Le rang du joueur qui a tiré la faveur. */
  player: number;
  /** Le rang de l'adversaire désigné dans la liste. */
  target: number;
  direction: HermesDirection;
}

/** Le pion à déplacer, et sa case d'arrivée. */
export interface HermesMove {
  /** Le rang du pion qui bouge — LUI SEUL appliquera la case. */
  player: number;
  from: number;
  to: number;
}

/**
 * Qui bouge, et vers quelle case.
 *
 * `positions` est indexé par le RANG des joueurs dans la partie, et non par
 * leur rang dans la liste déroulante : lire la mauvaise entrée déplacerait
 * le pion sur la case d'un tiers.
 */
export function hermesPlan(
  choice: HermesChoice,
  positions: number[]
): HermesMove {
  const mine = positions[choice.player] ?? 0;
  const theirs = positions[choice.target] ?? 0;

  // « ME DÉPLACER » fait bouger MON pion vers LUI ; « RAMENER » fait bouger
  // le SIEN vers moi. Confondre les deux déplacerait le mauvais pion, et
  // ferait appliquer la case au mauvais joueur.
  return choice.direction === 'move'
    ? { player: choice.player, from: mine, to: theirs }
    : { player: choice.target, from: theirs, to: mine };
}
