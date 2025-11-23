/**
 * Configuration de la table de jeu (zone où les dés peuvent tomber)
 */

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
  marginPercent: 20,
  showBorders: true,
  borderColor: '#8b4513',
  borderWidth: 4,
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

  // Calculer les positions en pixels
  const cellSize = tileSize + tileGap;
  const minX = minCol * cellSize;
  const maxX = (maxCol + 1) * cellSize;
  const minY = minRow * cellSize;
  const maxY = (maxRow + 1) * cellSize;

  // Calculer la marge
  const width = maxX - minX;
  const height = maxY - minY;
  const marginX = (width * marginPercent) / 100;
  const marginY = (height * marginPercent) / 100;

  return {
    minX: minX - marginX,
    maxX: maxX + marginX,
    minY: minY - marginY,
    maxY: maxY + marginY
  };
}
