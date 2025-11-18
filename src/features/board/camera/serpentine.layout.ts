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

/**
 * Position d'un slot dans une case (grille 2x2)
 */
export interface SlotPosition {
  x: number;
  y: number;
  slotIndex: number; // 0=top-left, 1=top-right, 2=bottom-left, 3=bottom-right
}

/**
 * Case plateau avec ses 4 slots
 */
export interface BoardSlot {
  tileIndex: number;
  x: number;
  y: number;
  row: number;
  col: number;
  slots: SlotPosition[]; // 4 positions pour placement flexible
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
  tileSize: 120,    // Cases plus grandes pour les 4 slots
  tileGap: 15,
  godPowerSize: 60
};

/**
 * Calcule les positions des cases dans le layout serpentin
 * Grille 9x6 avec cases vides au centre pour les Pouvoirs des Dieux
 */
export function calculateSerpentineLayout(
  tileCount: number,
  config: Partial<SerpentineLayoutConfig> = {}
): TilePosition[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { tileSize, tileGap } = cfg;
  const step = tileSize + tileGap;

  const positions: TilePosition[] = [];

  // Layout en grille 9 lignes x 6 colonnes
  // Parcours serpentin continu avec zone centrale pour Pouvoirs des Dieux
  //
  // Ligne 0: [0]  [1]  [2]  [3]  [4]  [5]      -> gauche à droite
  // Ligne 1: [11] [10] [9]  [8]  [7]  [6]      <- droite à gauche
  // Ligne 2: [12] [ ]  [ ]  [ ]  [ ]  [ ]      | descente
  // Ligne 3: [ ]  [P1] [P2] [P3] [ ]  [ ]      Zone Pouvoirs des Dieux
  // Ligne 4: [ ]  [P4] [P5] [P6] [ ]  [ ]      Zone Pouvoirs des Dieux
  // Ligne 5: [13] [ ]  [ ]  [ ]  [ ]  [ ]      | descente
  // Ligne 6: [14] [15] [16] [17] [18] [19]     -> gauche à droite
  // Ligne 7: [ ]  [ ]  [ ]  [ ]  [21] [20]     <- droite à gauche
  // Ligne 8: [ ]  [ ]  [ ]  [ ]  [ ]  [22]     FINISH

  const layout: Array<{ row: number; col: number }> = [
    // Ligne 0 (gauche à droite) - Cases 0-5
    { row: 0, col: 0 },   // 0 - START
    { row: 0, col: 1 },   // 1
    { row: 0, col: 2 },   // 2
    { row: 0, col: 3 },   // 3
    { row: 0, col: 4 },   // 4
    { row: 0, col: 5 },   // 5

    // Ligne 1 (droite à gauche - serpentin) - Cases 6-11
    { row: 1, col: 5 },   // 6
    { row: 1, col: 4 },   // 7
    { row: 1, col: 3 },   // 8
    { row: 1, col: 2 },   // 9
    { row: 1, col: 1 },   // 10
    { row: 1, col: 0 },   // 11

    // Descente gauche (contourne zone pouvoirs) - Cases 12-13
    { row: 2, col: 0 },   // 12
    { row: 5, col: 0 },   // 13

    // Ligne 6 (gauche à droite) - Cases 14-19
    { row: 6, col: 0 },   // 14
    { row: 6, col: 1 },   // 15
    { row: 6, col: 2 },   // 16
    { row: 6, col: 3 },   // 17
    { row: 6, col: 4 },   // 18
    { row: 6, col: 5 },   // 19

    // Ligne 7 (droite à gauche) - Cases 20-21
    { row: 7, col: 5 },   // 20
    { row: 7, col: 4 },   // 21

    // Ligne 8 - Arrivée - Case 22
    { row: 8, col: 5 },   // 22 - FINISH
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
 * Placés au centre de la grille (lignes 3-4, colonnes 1-4)
 */
export function calculateGodPowersLayout(
  config: Partial<SerpentineLayoutConfig> = {}
): GodPowerPosition[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { tileSize, tileGap } = cfg;
  const step = tileSize + tileGap;

  // 6 pouvoirs en grille 2x3 au centre
  const godPowers = [
    { id: 1, name: 'Zeus' },
    { id: 2, name: 'Poséidon' },
    { id: 3, name: 'Hadès' },
    { id: 4, name: 'Athéna' },
    { id: 5, name: 'Arès' },
    { id: 6, name: 'Aphrodite' }
  ];

  const positions: GodPowerPosition[] = [];
  const startRow = 3; // Lignes 3-4 (zone vide centrale)
  const startCol = 1.5; // Colonnes 1-4 centrées

  godPowers.forEach((power, index) => {
    const row = Math.floor(index / 3);
    const col = index % 3;

    positions.push({
      id: power.id,
      name: power.name,
      x: (startCol + col * 1.2) * step,
      y: (startRow + row) * step
    });
  });

  return positions;
}

/**
 * Calcule les dimensions totales du plateau
 * Grille 9 lignes x 6 colonnes
 */
export function getBoardDimensions(
  config: Partial<SerpentineLayoutConfig> = {}
): { width: number; height: number } {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { tileSize, tileGap } = cfg;
  const step = tileSize + tileGap;

  return {
    width: 6 * step + tileSize,   // 6 colonnes
    height: 9 * step + tileSize   // 9 lignes
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

/**
 * Calcule les positions des cases avec leurs 4 slots
 * Chaque case plateau est divisée en 4 zones pour placement flexible
 */
export function calculateBoardSlots(
  tileCount: number,
  config: Partial<SerpentineLayoutConfig> = {}
): BoardSlot[] {
  const positions = calculateSerpentineLayout(tileCount, config);
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { tileSize } = cfg;

  const halfSize = tileSize / 2;

  return positions.map((pos, index) => {
    // Calculer les 4 slots pour chaque case
    const slots: SlotPosition[] = [
      { x: pos.x, y: pos.y, slotIndex: 0 },                           // top-left
      { x: pos.x + halfSize, y: pos.y, slotIndex: 1 },                 // top-right
      { x: pos.x, y: pos.y + halfSize, slotIndex: 2 },                 // bottom-left
      { x: pos.x + halfSize, y: pos.y + halfSize, slotIndex: 3 }       // bottom-right
    ];

    return {
      tileIndex: index,
      x: pos.x,
      y: pos.y,
      row: pos.row,
      col: pos.col,
      slots
    };
  });
}

/**
 * Obtient la position d'un slot spécifique pour un joueur
 * Distribue les joueurs dans les 4 coins de la case
 */
export function getPlayerSlotPosition(
  boardSlot: BoardSlot,
  playerIndex: number,
  totalPlayers: number
): SlotPosition {
  // Si un seul joueur, centrer
  if (totalPlayers === 1) {
    return boardSlot.slots[0];
  }

  // Distribuer dans les slots disponibles
  const slotIndex = playerIndex % 4;
  return boardSlot.slots[slotIndex];
}
