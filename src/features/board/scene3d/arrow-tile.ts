/**
 * Ce qui fait qu'une case est une flèche, et de quel côté elle pousse.
 *
 * Quentin : « besoin de pouvoir tourner les flèches visuellement, certaines
 * doivent faire reculer au lieu d'avancer ».
 *
 * Le critère vit ICI et pas en deux endroits. Les règles décident du
 * déplacement, le rendu décide du dessin : si chacun jugeait de son côté ce
 * qu'est une flèche, un type ajouté plus tard bougerait le pion sans tourner
 * l'image, ou l'inverse. Une flèche qui ment sur son sens est pire qu'une
 * flèche absente — le joueur anticipe son déplacement en la regardant.
 */

import type { TileConfig } from '@/core/models/Tile';

/**
 * Une case flèche pousse de son propre nombre de cases : le nombre est dans
 * son type, `forward_2` pousse de deux.
 */
export function isArrowTile(tile: Pick<TileConfig, 'type'>): boolean {
  return typeof tile.type === 'string' && tile.type.startsWith('forward_');
}

/**
 * Le sens où la flèche pousse.
 *
 * La flèche est DESSINÉE sur le plateau : elle envoie toujours du même côté,
 * qu'on soit à l'aller ou au retour. Absent, le champ vaut `forward` — les
 * cases du plateau officiel ne déclaraient pas toutes leur sens, et le défaut
 * ne doit pas retourner un dessin au hasard.
 */
export function arrowDirection(
  tile: Pick<TileConfig, 'type' | 'direction'>
): 'forward' | 'backward' {
  if (!isArrowTile(tile)) return 'forward';
  return tile.direction === 'backward' ? 'backward' : 'forward';
}
