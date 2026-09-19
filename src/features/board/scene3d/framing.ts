/**
 * Le cadrage : quelle portion du monde la caméra doit montrer.
 *
 * C'est une fonction PURE de (encombrement du parcours, format de l'écran).
 * Elle ne connaît ni Three.js ni le DOM, et c'est délibéré : le cadrage est
 * la première chose qui a fait échouer la tentative précédente de vue en
 * diagonale, et on veut pouvoir le mesurer sans rien afficher.
 *
 * Elle ne suppose rien de la forme du parcours : un plateau en U, en cercle
 * ou en colonne passe par le même calcul que le plateau officiel.
 */

/** Encombrement du parcours dans le plan du plateau, en unités monde. */
export interface BoardExtent {
  width: number;
  depth: number;
}

/** Surface réellement disponible à l'écran, HUD déduit. */
export interface Viewport {
  width: number;
  height: number;
}

export interface Framing {
  /**
   * Rotation du plateau autour de la verticale, en degrés.
   *
   * 0 ou 90 : le plateau est présenté dans le sens qui remplit le mieux
   * l'écran. Ce n'est PAS un réglage esthétique — mesuré sur le plateau
   * officiel, le quart de tour fait passer une case de 33 à 55 px en
   * portrait, et l'inverse ruinerait un plateau en colonne.
   */
  yawDeg: 0 | 90;
  /** Facteur d'échelle à appliquer pour que tout le parcours tienne. */
  scale: number;
  /** Encombrement une fois la rotation appliquée. */
  rotated: BoardExtent;
}

/**
 * Marge autour du plateau, en proportion de la surface disponible.
 *
 * Le plateau collé aux bords donne l'impression d'être coupé, et les pions
 * des cases extérieures mordent sur le vide. 4 % suffisent à poser le
 * plateau sans gaspiller la place qui manque déjà en portrait.
 */
const MARGIN = 0.96;

/**
 * Choisit l'orientation et l'échelle qui montrent le plus grand plateau
 * possible.
 *
 * Le plateau officiel est large et plat (1335 × 795) ; un écran de téléphone
 * en portrait est haut et étroit. Les deux formes sont orthogonales, d'où un
 * plateau minuscule. Le tourner d'un quart de tour lui fait épouser l'écran.
 *
 * L'inverse est vrai pour un parcours en colonne, que le quart de tour
 * ruinerait. On compare donc les deux, à chaque fois, au lieu de figer un
 * angle qui ne vaudrait que pour le plateau officiel.
 */
export function computeFraming(extent: BoardExtent, viewport: Viewport): Framing {
  const usable: Viewport = {
    width: Math.max(1, viewport.width * MARGIN),
    height: Math.max(1, viewport.height * MARGIN),
  };

  const straight = fitScale(extent, usable);
  const turned = fitScale({ width: extent.depth, depth: extent.width }, usable);

  // À égalité on garde le plateau dans son sens naturel : un quart de tour
  // gratuit désoriente le joueur qui a composé son plateau dans l'éditeur.
  if (turned > straight) {
    return {
      yawDeg: 90,
      scale: turned,
      rotated: { width: extent.depth, depth: extent.width },
    };
  }

  return { yawDeg: 0, scale: straight, rotated: { ...extent } };
}

/** Le plus grand facteur qui fait tenir `extent` dans `viewport`. */
function fitScale(extent: BoardExtent, viewport: Viewport): number {
  if (extent.width <= 0 || extent.depth <= 0) return 1;

  return Math.min(viewport.width / extent.width, viewport.height / extent.depth);
}

/**
 * Encombrement d'un ensemble de cases, quelle que soit leur disposition.
 *
 * On part des cases réellement posées plutôt que de la grille déclarée : un
 * plateau en U laisse de grandes zones vides que la grille compte et que
 * l'œil ne voit pas. Les cadrer reviendrait à rétrécir le plateau pour
 * afficher du néant.
 */
export function measureExtent(
  tiles: { x: number; z: number }[],
  tileSize: number
): BoardExtent {
  if (tiles.length === 0) return { width: tileSize, depth: tileSize };

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

  return { width: maxX - minX, depth: maxZ - minZ };
}

/** Centre du parcours, pour savoir où pointer la caméra. */
export function measureCenter(
  tiles: { x: number; z: number }[]
): { x: number; z: number } {
  if (tiles.length === 0) return { x: 0, z: 0 };

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const tile of tiles) {
    minX = Math.min(minX, tile.x);
    maxX = Math.max(maxX, tile.x);
    minZ = Math.min(minZ, tile.z);
    maxZ = Math.max(maxZ, tile.z);
  }

  return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
}
