import { TileType, TileConfig } from '@models/Tile';

/**
 * Constantes du jeu
 */
export const BOARD_SIZE = 23; // Nombre de cases (0 à 22)

export const COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
  '#e91e63', '#00bcd4'
];

/**
 * Configuration du plateau (définition de chaque case)
 */
export const BOARD_CONFIG: TileConfig[] = [
  { type: TileType.START, icon: '🏁', name: 'START' },                        // 0
  { type: TileType.EVERYONE_DRINKS, icon: '🍻', name: 'TOURNÉE GÉNÉRALE' },   // 1
  { type: TileType.MOVE_FORWARD_2, icon: '⬆️', name: 'AVANCEZ +2' },          // 2
  { type: TileType.DRINK_2, icon: '🍺', name: 'BUVEZ 2' },                    // 3
  { type: TileType.TEMPLE, icon: '🏛️', name: 'FAVEUR DES DIEUX' },           // 4
  { type: TileType.CHICKEN, icon: '🐔', name: 'PETIT POULET' },               // 5
  { type: TileType.DISTRIBUTE_2, icon: '🎁', name: 'DISTRIBUEZ 2' },          // 6
  { type: TileType.DRINK_3, icon: '🍺', name: 'BUVEZ 3' },                    // 7
  { type: TileType.COPY, icon: '🐑', name: 'MOUTON' },                        // 8
  { type: TileType.MOVE_FORWARD_2, icon: '⬆️', name: 'AVANCEZ +2' },          // 9
  { type: TileType.DISTRIBUTE_4, icon: '🎁', name: 'DISTRIBUEZ 4' },          // 10
  { type: TileType.SCHMITT_CALL, icon: '⚡', name: 'SCHMITT !!!' },           // 11
  { type: TileType.RULE, icon: '📜', name: 'CRÉEZ RÈGLE' },                   // 12
  { type: TileType.MOVE_FORWARD_2, icon: '⬆️', name: 'AVANCEZ +2' },          // 13
  { type: TileType.COPY, icon: '🐑', name: 'MOUTON' },                        // 14
  { type: TileType.DRINK_4, icon: '🍺', name: 'BUVEZ 4' },                    // 15
  { type: TileType.DISTRIBUTE_3, icon: '🎁', name: 'DISTRIBUEZ 3' },          // 16
  { type: TileType.CHICKEN, icon: '🐔', name: 'PETIT POULET' },               // 17
  { type: TileType.TEMPLE, icon: '🏛️', name: 'FAVEUR DES DIEUX' },           // 18
  { type: TileType.DISTRIBUTE_2, icon: '🎁', name: 'DISTRIBUEZ 2' },          // 19
  { type: TileType.MOVE_FORWARD_2, icon: '⬆️', name: 'AVANCEZ +2' },          // 20
  { type: TileType.EVERYONE_DRINKS, icon: '🍻', name: 'TOURNÉE GÉNÉRALE' },   // 21
  { type: TileType.POWER, icon: '👑', name: 'POUVOIR SCHMITT' }               // 22 (FINISH)
];

/**
 * Faveurs des dieux (résultats des 2 dés au temple)
 */
export const GOD_FAVORS = {
  2: { god: 'Athéna', effect: 'Vous obtenez un bouclier qui renvoie une fois toutes les gorgées.', icon: '🛡️' },
  3: { god: 'Aphrodite', effect: 'Choisissez 2 adversaires et déplacez-les.', icon: '💘' },
  4: { god: 'Hermès', effect: 'Échangez de position avec un adversaire.', icon: '👟' },
  5: { god: 'Apollon', effect: 'Rejouez et distribuez des gorgées.', icon: '☀️' },
  6: { god: 'Arès', effect: 'Tous choisissent pouce haut/bas. Ceux qui font l\'inverse boivent.', icon: '⚔️' },
  7: { god: 'Dionysos', effect: 'Tous boivent jusqu\'à ce que vous arrêtiez.', icon: '🍷' },
  8: { god: 'Héphaïstos', effect: 'Placez 2 shooters sur des cases.', icon: '🔨' },
  9: { god: 'Poséidon', effect: 'Ciblez un joueur qui boit, ses voisins aussi.', icon: '🔱' },
  10: { god: 'Jugement Dernier', effect: 'Conservez 1 dé et relancez l\'autre.', icon: '⚖️' },
  11: { god: 'Jugement Dernier', effect: 'Conservez 1 dé et relancez l\'autre.', icon: '⚖️' },
  12: { god: 'Colère Divine', effect: 'Buvez 3 gorgées !', icon: '💀' }
} as const;
