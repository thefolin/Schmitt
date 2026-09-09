/**
 * Configuration de la table de jeu (zone où les dés peuvent tomber)
 */

import { PERSPECTIVE_COMPRESSION_Y } from './board-layout.config';

export interface TableBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface TableBorderConfig {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

export interface TableConfig {
  // Limites de la table
  bounds: TableBounds;

  // Configuration des bordures (true = bordure présente, false = pas de bordure = dé peut tomber)
  borders: TableBorderConfig;

  // Marge en pourcentage pour agrandir la zone (par défaut 20%)
  marginPercent: number;

  // Afficher visuellement les bordures
  showBorders: boolean;

  // Couleur des bordures
  borderColor: string;

  // Épaisseur des bordures
  borderWidth: number;

  // Pénalité en cas de chute du dé (nombre de gorgées)
  fallPenalty?: number;
}

/**
 * Configuration par défaut de la table
 */
export const DEFAULT_TABLE_CONFIG: Partial<TableConfig> = {
  borders: {
    top: true,
    right: true,
    bottom: true,
    left: true
  },
  // Marge en pourcentage d'UNE case (pas du plateau) : 60% de 120px ≈ 72px de
  // tapis autour du jeu. Assez pour que le dé roule, pas au point qu'il finisse
  // hors du champ visible.
  marginPercent: 60,
  showBorders: true,
  // Liseré sombre en bord de tapis, dans le ton du feutre (cf. .game-table)
  borderColor: 'rgba(8, 40, 26, 0.9)',
  borderWidth: 6,
  fallPenalty: 0 // Pas de pénalité par défaut
};

/**
 * Calcule les bounds de la table à partir des positions des cases
 * Prend les deux cases les plus éloignées et ajoute une marge
 */
export function calculateTableBounds(
  tilePlacements: Array<{ gridRow: number; gridCol: number }>,
  tileSize: number,
  tileGap: number,
  marginPercent: number = 20
): TableBounds {
  if (tilePlacements.length === 0) {
    // Valeurs par défaut si pas de cases
    return {
      minX: 0,
      maxX: 800,
      minY: 0,
      maxY: 600
    };
  }

  // Trouver les positions min et max
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;

  tilePlacements.forEach(placement => {
    minRow = Math.min(minRow, placement.gridRow);
    maxRow = Math.max(maxRow, placement.gridRow);
    minCol = Math.min(minCol, placement.gridCol);
    maxCol = Math.max(maxCol, placement.gridCol);
  });

  // Emprise réelle des cases, calculée comme dans calculatePlacementBounds :
  // une case occupe `tileSize` à partir de sa position de grille. L'axe Y
  // reprend la compression de perspective, sinon la table est ~35% trop haute.
  const cellSize = tileSize + tileGap;
  const cellSizeY = cellSize * PERSPECTIVE_COMPRESSION_Y;
  const minX = minCol * cellSize;
  const maxX = maxCol * cellSize + tileSize;
  const minY = minRow * cellSizeY;
  const maxY = maxRow * cellSizeY + tileSize;

  // Marge exprimée en fraction de case plutôt qu'en pourcentage du plateau :
  // un grand plateau n'a pas besoin d'un liseré proportionnellement immense,
  // et le dé resterait alors hors du champ visible.
  const margin = tileSize * (marginPercent / 100);

  return {
    minX: minX - margin,
    maxX: maxX + margin,
    minY: minY - margin,
    maxY: maxY + margin
  };
}
