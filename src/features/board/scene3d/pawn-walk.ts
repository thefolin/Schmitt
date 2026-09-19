/**
 * Le découpage temporel de la marche d'un pion.
 *
 * Quentin : « animation fluide, vitesse constante ».
 *
 * Ce module dit, pour un instant donné, entre quelles cases le pion se trouve
 * et où il en est de son pas. Il ne connaît ni Three.js ni le DOM : c'est ce
 * qui le rend vérifiable sans rien afficher, comme le cadrage.
 */

/**
 * Durée d'un pas, en millisecondes.
 *
 * Chaque case prend le MÊME temps — un déplacement de 6 dure six fois un pas.
 * C'est ce qui permet de compter les cases à l'œil, et le joueur les compte
 * forcément : le dé décide de ce qu'il boit.
 *
 * 180 ms tient le compromis : un déplacement de 6 prend un peu plus d'une
 * seconde, assez lent pour être suivi, assez vif pour ne pas faire attendre à
 * chaque tour.
 */
export const WALK_MS_PER_TILE = 180;

export interface WalkFrame {
  /** Case quittée. */
  from: number;
  /** Case visée par le pas en cours. */
  to: number;
  /** Avancement dans le pas courant, de 0 à 1. */
  progress: number;
  /** La marche est-elle terminée ? */
  done: boolean;
}

/** Durée totale d'une marche, en millisecondes. */
export function walkDuration(steps: number): number {
  return Math.max(0, steps) * WALK_MS_PER_TILE;
}

/**
 * Où en est le pion après `elapsed` millisecondes.
 *
 * `path` est la suite des cases traversées, sans la case de départ — celle
 * que renvoie `walkPath`.
 */
export function walkFrame(path: number[], start: number, elapsed: number): WalkFrame {
  if (path.length === 0) {
    return { from: start, to: start, progress: 1, done: true };
  }

  // Un temps qui repart en arrière — cela arrive sur certains appareils — ne
  // doit pas faire remonter le pion.
  const time = Math.max(0, elapsed);
  const total = walkDuration(path.length);

  if (time >= total) {
    const last = path[path.length - 1];
    return { from: path[path.length - 2] ?? start, to: last, progress: 1, done: true };
  }

  const index = Math.floor(time / WALK_MS_PER_TILE);
  const progress = (time - index * WALK_MS_PER_TILE) / WALK_MS_PER_TILE;

  return {
    from: index === 0 ? start : path[index - 1],
    to: path[index],
    progress,
    done: false,
  };
}
