/**
 * Layout serpentin pour le plateau de jeu
 * Disposition en S avec zone centrale pour les pouvoirs des dieux
 */

export interface TilePosition {
  x: number;
  y: number;
  row: number;
  col: number;
}

export interface GodPowerPosition {
  id: number;
  name: string;
  x: number;
  y: number;
}

export interface SerpentineLayoutConfig {
  tileSize: number;      // Taille d'une case
  tileGap: number;       // Espace entre les cases
  godPowerSize: number;  // Taille des icônes de pouvoir
}

const DEFAULT_CONFIG: SerpentineLayoutConfig = {
  tileSize: 80,
  tileGap: 10,
  godPowerSize: 60
};

/**
 * Calcule les positions des cases dans le layout serpentin
 */
export function calculateSerpentineLayout(
  tileCount: number,
  config: Partial<SerpentineLayoutConfig> = {}
): TilePosition[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { tileSize, tileGap } = cfg;
  const step = tileSize + tileGap;

  const positions: TilePosition[] = [];

  // Layout personnalisé pour 23 cases (0-22)
  // Structure:
  // Ligne 1: [0] [1] [2] [3] [4] (gauche à droite)
  // Virage: [5] [6] (vers le bas à droite)
  // Ligne 2: [9] [8] [7] (droite à gauche)
  // Virage: [10] [11] (vers le bas à gauche)
  // --- Zone Pouvoirs des Dieux ---
  // Virage: [12] [13] (vers le bas à gauche)
  // Ligne 3: [14] [15] [16] [17] [18] (gauche à droite)
  // Virage: [19] [20] (vers le bas à droite)
  // Ligne finale: [21] [22] (arrivée)

  const layout: Array<{ row: number; col: number }> = [
    // Ligne 1 (5 cases)
    { row: 0, col: 0 },   // 0 - START
    { row: 0, col: 1 },   // 1
    { row: 0, col: 2 },   // 2
    { row: 0, col: 3 },   // 3
    { row: 0, col: 4 },   // 4

    // Virage droit vers le bas
    { row: 1, col: 4 },   // 5
    { row: 2, col: 4 },   // 6

    // Ligne 2 (3 cases, droite à gauche)
    { row: 3, col: 4 },   // 7
    { row: 3, col: 3 },   // 8
    { row: 3, col: 2 },   // 9

    // Virage gauche vers le bas
    { row: 4, col: 2 },   // 10
    { row: 5, col: 2 },   // 11

    // Après zone pouvoirs (virage continue)
    { row: 8, col: 2 },   // 12
    { row: 9, col: 2 },   // 13

    // Ligne 3 (5 cases)
    { row: 10, col: 0 },  // 14
    { row: 10, col: 1 },  // 15
    { row: 10, col: 2 },  // 16
    { row: 10, col: 3 },  // 17
    { row: 10, col: 4 },  // 18

    // Virage droit vers le bas
    { row: 11, col: 4 },  // 19
    { row: 12, col: 4 },  // 20

    // Ligne finale
    { row: 13, col: 3 },  // 21
    { row: 13, col: 4 },  // 22 - FINISH
  ];

  // Calculer les positions en pixels
  for (let i = 0; i < Math.min(tileCount, layout.length); i++) {
    const { row, col } = layout[i];
    positions.push({
      x: col * step,
      y: row * step,
      row,
      col
    });
  }

  return positions;
}

/**
 * Calcule les positions des pouvoirs des dieux
 * Placés entre les lignes 5-8 (entre les deux virages)
 */
export function calculateGodPowersLayout(
  config: Partial<SerpentineLayoutConfig> = {}
): GodPowerPosition[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { tileSize, tileGap } = cfg;
  const step = tileSize + tileGap;

  // 6 pouvoirs en grille 2x3
  const godPowers = [
    { id: 1, name: 'Zeus' },
    { id: 2, name: 'Poséidon' },
    { id: 3, name: 'Hadès' },
    { id: 4, name: 'Athéna' },
    { id: 5, name: 'Arès' },
    { id: 6, name: 'Aphrodite' }
  ];

  const positions: GodPowerPosition[] = [];
  const startRow = 6; // Entre case 11 et 12
  const startCol = 0.5;

  godPowers.forEach((power, index) => {
    const row = Math.floor(index / 3);
    const col = index % 3;

    positions.push({
      id: power.id,
      name: power.name,
      x: (startCol + col * 1.5) * step,
      y: (startRow + row) * step
    });
  });

  return positions;
}

/**
 * Calcule les dimensions totales du plateau
 */
export function getBoardDimensions(
  config: Partial<SerpentineLayoutConfig> = {}
): { width: number; height: number } {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { tileSize, tileGap } = cfg;
  const step = tileSize + tileGap;

  return {
    width: 5 * step + tileSize,   // 5 colonnes
    height: 14 * step + tileSize  // 14 lignes
  };
}

/**
 * Trouve la direction entre deux cases consécutives
 */
export function getDirection(
  fromPos: TilePosition,
  toPos: TilePosition
): 'right' | 'left' | 'down' | 'up' {
  const dx = toPos.col - fromPos.col;
  const dy = toPos.row - fromPos.row;

  if (dx > 0) return 'right';
  if (dx < 0) return 'left';
  if (dy > 0) return 'down';
  return 'up';
}
