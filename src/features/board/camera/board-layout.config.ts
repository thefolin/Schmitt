/**
 * Configuration du layout du plateau
 * Permet de définir la taille et position de chaque case jeu sur la grille
 */

export interface TilePlacement {
  tileId: number;           // ID de la case jeu
  gridRow: number;          // Ligne sur la grille
  gridCol: number;          // Colonne sur la grille
  size: 'quarter' | 'half' | 'full';  // Taille: 1/4, 1/2, ou 1 case complète
  slot?: number;            // Pour 'quarter': quel slot (0-3), pour 'half': direction (0=horizontal, 1=vertical)
}

export interface BoardLayoutConfig {
  gridRows: number;
  gridCols: number;
  tileSize: number;         // Taille d'une case complète en pixels
  tileGap: number;
  placements: TilePlacement[];
  godPowersZone?: {
    startRow: number;
    startCol: number;
    rows: number;
    cols: number;
  };
}

/**
 * Configuration par défaut - Layout serpentin avec placements variés
 */
export const DEFAULT_BOARD_LAYOUT: BoardLayoutConfig = {
  gridRows: 9,
  gridCols: 6,
  tileSize: 120,
  tileGap: 15,
  placements: [
    // Ligne 0 - Cases complètes
    { tileId: 0, gridRow: 0, gridCol: 0, size: 'full' },    // START
    { tileId: 1, gridRow: 0, gridCol: 1, size: 'full' },
    { tileId: 2, gridRow: 0, gridCol: 2, size: 'full' },
    { tileId: 3, gridRow: 0, gridCol: 3, size: 'full' },
    { tileId: 4, gridRow: 0, gridCol: 4, size: 'full' },
    { tileId: 5, gridRow: 0, gridCol: 5, size: 'full' },

    // Ligne 1 - Serpentin retour
    { tileId: 6, gridRow: 1, gridCol: 5, size: 'full' },
    { tileId: 7, gridRow: 1, gridCol: 4, size: 'full' },
    { tileId: 8, gridRow: 1, gridCol: 3, size: 'full' },
    { tileId: 9, gridRow: 1, gridCol: 2, size: 'full' },
    { tileId: 10, gridRow: 1, gridCol: 1, size: 'full' },
    { tileId: 11, gridRow: 1, gridCol: 0, size: 'full' },

    // Descente gauche
    { tileId: 12, gridRow: 2, gridCol: 0, size: 'full' },
    { tileId: 13, gridRow: 5, gridCol: 0, size: 'full' },

    // Ligne 6
    { tileId: 14, gridRow: 6, gridCol: 0, size: 'full' },
    { tileId: 15, gridRow: 6, gridCol: 1, size: 'full' },
    { tileId: 16, gridRow: 6, gridCol: 2, size: 'full' },
    { tileId: 17, gridRow: 6, gridCol: 3, size: 'full' },
    { tileId: 18, gridRow: 6, gridCol: 4, size: 'full' },
    { tileId: 19, gridRow: 6, gridCol: 5, size: 'full' },

    // Ligne 7 - Serpentin retour
    { tileId: 20, gridRow: 7, gridCol: 5, size: 'full' },
    { tileId: 21, gridRow: 7, gridCol: 4, size: 'full' },

    // Ligne 8 - Arrivée
    { tileId: 22, gridRow: 8, gridCol: 5, size: 'full' },  // FINISH
  ],
  godPowersZone: {
    startRow: 3,
    startCol: 1,
    rows: 2,
    cols: 4
  }
};

/**
 * Exemple de layout avec cases de tailles variées
 */
export const VARIED_SIZE_LAYOUT: BoardLayoutConfig = {
  gridRows: 9,
  gridCols: 6,
  tileSize: 120,
  tileGap: 15,
  placements: [
    // Ligne 0 - Mix de tailles
    { tileId: 0, gridRow: 0, gridCol: 0, size: 'full' },    // START - grande
    { tileId: 1, gridRow: 0, gridCol: 1, size: 'half', slot: 0 },  // Demi horizontal haut
    { tileId: 2, gridRow: 0, gridCol: 2, size: 'quarter', slot: 0 }, // Quart top-left
    { tileId: 3, gridRow: 0, gridCol: 2, size: 'quarter', slot: 3 }, // Quart bottom-right
    { tileId: 4, gridRow: 0, gridCol: 3, size: 'full' },
    { tileId: 5, gridRow: 0, gridCol: 4, size: 'half', slot: 1 },  // Demi vertical gauche

    // Ligne 1 - Serpentin avec espaces
    { tileId: 6, gridRow: 1, gridCol: 5, size: 'full' },
    { tileId: 7, gridRow: 1, gridCol: 4, size: 'quarter', slot: 1 },
    { tileId: 8, gridRow: 1, gridCol: 3, size: 'full' },
    { tileId: 9, gridRow: 1, gridCol: 2, size: 'half', slot: 0 },
    { tileId: 10, gridRow: 1, gridCol: 1, size: 'quarter', slot: 2 },
    { tileId: 11, gridRow: 1, gridCol: 0, size: 'full' },

    // Reste en taille normale
    { tileId: 12, gridRow: 2, gridCol: 0, size: 'full' },
    { tileId: 13, gridRow: 5, gridCol: 0, size: 'full' },
    { tileId: 14, gridRow: 6, gridCol: 0, size: 'full' },
    { tileId: 15, gridRow: 6, gridCol: 1, size: 'full' },
    { tileId: 16, gridRow: 6, gridCol: 2, size: 'full' },
    { tileId: 17, gridRow: 6, gridCol: 3, size: 'full' },
    { tileId: 18, gridRow: 6, gridCol: 4, size: 'full' },
    { tileId: 19, gridRow: 6, gridCol: 5, size: 'full' },
    { tileId: 20, gridRow: 7, gridCol: 5, size: 'full' },
    { tileId: 21, gridRow: 7, gridCol: 4, size: 'full' },
    { tileId: 22, gridRow: 8, gridCol: 5, size: 'full' },
  ],
  godPowersZone: {
    startRow: 3,
    startCol: 1,
    rows: 2,
    cols: 4
  }
};

/**
 * Calcule la position et taille en pixels d'un placement
 */
export function calculatePlacementBounds(
  placement: TilePlacement,
  config: BoardLayoutConfig
): { x: number; y: number; width: number; height: number } {
  const step = config.tileSize + config.tileGap;
  const baseX = placement.gridCol * step;
  const baseY = placement.gridRow * step;
  const halfSize = config.tileSize / 2;

  switch (placement.size) {
    case 'full':
      return {
        x: baseX,
        y: baseY,
        width: config.tileSize,
        height: config.tileSize
      };

    case 'half':
      if (placement.slot === 0) {
        // Horizontal (haut ou bas)
        return {
          x: baseX,
          y: baseY,
          width: config.tileSize,
          height: halfSize
        };
      } else {
        // Vertical (gauche ou droite)
        return {
          x: baseX,
          y: baseY,
          width: halfSize,
          height: config.tileSize
        };
      }

    case 'quarter':
      const slotOffsets = [
        { x: 0, y: 0 },           // 0: top-left
        { x: halfSize, y: 0 },    // 1: top-right
        { x: 0, y: halfSize },    // 2: bottom-left
        { x: halfSize, y: halfSize } // 3: bottom-right
      ];
      const offset = slotOffsets[placement.slot || 0];
      return {
        x: baseX + offset.x,
        y: baseY + offset.y,
        width: halfSize,
        height: halfSize
      };

    default:
      return {
        x: baseX,
        y: baseY,
        width: config.tileSize,
        height: config.tileSize
      };
  }
}

/**
 * Charge un layout depuis un objet JSON
 */
export function loadBoardLayout(json: unknown): BoardLayoutConfig {
  const data = json as BoardLayoutConfig;

  // Validation basique
  if (!data.gridRows || !data.gridCols || !data.placements) {
    console.warn('Invalid board layout, using default');
    return DEFAULT_BOARD_LAYOUT;
  }

  return {
    gridRows: data.gridRows,
    gridCols: data.gridCols,
    tileSize: data.tileSize || 120,
    tileGap: data.tileGap || 15,
    placements: data.placements,
    godPowersZone: data.godPowersZone
  };
}

/**
 * Charge un layout depuis un fichier JSON externe
 */
export async function fetchBoardLayout(url: string): Promise<BoardLayoutConfig> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch layout: ${response.statusText}`);
    }
    const json = await response.json();
    return loadBoardLayout(json);
  } catch (error) {
    console.error('Error loading board layout:', error);
    return DEFAULT_BOARD_LAYOUT;
  }
}

/**
 * Valide un layout JSON
 */
export function validateBoardLayout(json: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const data = json as Partial<BoardLayoutConfig>;

  if (!data.gridRows || typeof data.gridRows !== 'number') {
    errors.push('gridRows is required and must be a number');
  }

  if (!data.gridCols || typeof data.gridCols !== 'number') {
    errors.push('gridCols is required and must be a number');
  }

  if (!data.placements || !Array.isArray(data.placements)) {
    errors.push('placements is required and must be an array');
  } else {
    data.placements.forEach((placement, index) => {
      if (typeof placement.tileId !== 'number') {
        errors.push(`placements[${index}].tileId must be a number`);
      }
      if (typeof placement.gridRow !== 'number') {
        errors.push(`placements[${index}].gridRow must be a number`);
      }
      if (typeof placement.gridCol !== 'number') {
        errors.push(`placements[${index}].gridCol must be a number`);
      }
      if (!['full', 'half', 'quarter'].includes(placement.size)) {
        errors.push(`placements[${index}].size must be 'full', 'half', or 'quarter'`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
