import { DIE_EDGE } from './dice-world-config';

/**
 * L'aire où le dé a le droit de rouler.
 *
 * Quentin : « le dé reste sur le plateau. Pas d'infini, pas de je jette le dé
 * dans le vide. »
 *
 * Elle est calculée depuis les positions RÉELLES des cases, et non déclarée :
 * un plateau en U, en cercle ou en colonne donne la sienne par le même calcul.
 * Jusqu'ici le dé roulait dans un carré inventé, sans rapport avec les cases
 * posées — il pouvait donc s'arrêter à côté du plateau.
 */

export interface DiceArena {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Marge autour des cases, en unités monde.
 *
 * Une aire calée au ras des cases coincerait le dé dès qu'il s'en approche :
 * il lui faut de quoi tenir entier, plus un peu d'air pour que le rebond se
 * voie.
 */
const PADDING = DIE_EDGE;

/** Aire minimale, quand le parcours n'est pas encore chargé. */
const FALLBACK = DIE_EDGE * 6;

export function diceArena(
  tiles: { x: number; z: number }[],
  tileSize: number
): DiceArena {
  if (tiles.length === 0) {
    return { minX: 0, maxX: FALLBACK, minZ: 0, maxZ: FALLBACK };
  }

  const half = tileSize / 2;

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const tile of tiles) {
    minX = Math.min(minX, tile.x - half);
    maxX = Math.max(maxX, tile.x + half);
    minZ = Math.min(minZ, tile.z - half);
    maxZ = Math.max(maxZ, tile.z + half);
  }

  return {
    minX: minX - PADDING,
    maxX: maxX + PADDING,
    minZ: minZ - PADDING,
    maxZ: maxZ + PADDING,
  };
}
