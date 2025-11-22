import type { TileConfig, TileType } from '@/core/models/Tile';

/**
 * Configuration des 23 cases du plateau
 * Correspond exactement au parcours défini dans power.json
 */
export const TILE_CONFIGS: TileConfig[] = [
  {
    type: 'start' as TileType,
    icon: '🏁',
    name: 'START',
    description: 'Point de départ',
    image: 'assets/start.png'
  },
  {
    type: 'everyone_drinks' as TileType,
    icon: '🍻',
    name: 'TOURNÉE GÉNÉRALE',
    description: 'Tous les joueurs boivent 1 gorgée',
    image: 'assets/tournerGeneral.png'
  },
  {
    type: 'forward_2' as TileType,
    icon: '⏩',
    name: 'AVANCEZ DE 2 CASES',
    description: 'Le joueur avance de 2 cases dans le sens de la flèche (rotation). Max 2 déplacements consécutifs pour éviter les boucles.',
    image: 'assets/row.png'
  },
  {
    type: 'drink_2' as TileType,
    icon: '🍺',
    name: 'BUVEZ 2 GORGÉES',
    description: 'Le joueur doit boire 2 gorgées',
    image: 'assets/drink_2.png'
  },
  {
    type: 'power' as TileType,
    icon: '⚡',
    name: 'FAVEUR DES DIEUX',
    description: 'Le joueur doit lancer deux dés et active l\'effet correspondant',
    image: 'assets/powerG.png'
  },
  {
    type: 'chicken' as TileType,
    icon: '🐔',
    name: 'PETIT POULET',
    description: 'Le joueur devient le Petit Poulet',
    image: 'assets/petitPoulet.png'
  },
  {
    type: 'distribute_2' as TileType,
    icon: '🎁',
    name: 'DISTRIBUEZ 2 GORGÉES',
    description: 'Le joueur distribue 2 gorgées',
    image: 'assets/donnerDring_2.png'
  },
  {
    type: 'drink_3' as TileType,
    icon: '🍺',
    name: 'BUVEZ 3 GORGÉES',
    description: 'Le joueur doit boire 3 gorgées',
    image: 'assets/drink_3.png'
  },
  {
    type: 'copy' as TileType,
    icon: '🐑',
    name: 'MOUTON',
    description: 'Le joueur copie l\'effet d\'un adversaire',
    image: 'assets/mouton.png'
  },
  {
    type: 'forward_2' as TileType,
    icon: '⏩',
    name: 'AVANCEZ DE 2 CASES',
    description: 'Le joueur avance de 2 cases dans le sens de la flèche (rotation). Max 2 déplacements consécutifs pour éviter les boucles.',
    image: 'assets/row.png'
  },
  {
    type: 'distribute_4' as TileType,
    icon: '🎁',
    name: 'DISTRIBUEZ 4 GORGÉES',
    description: 'Le joueur distribue 4 gorgées',
    image: 'assets/donnerDring_4.png'
  },
  {
    type: 'schmitt_call' as TileType,
    icon: '📢',
    name: 'SCHMITT !!!',
    description: 'Le dernier joueur à crier \'SCHMITT\' boit 1 gorgée par joueur présent',
    image: 'assets/schimitt.png'
  },
  {
    type: 'rule' as TileType,
    icon: '📜',
    name: 'CRÉEZ UNE RÈGLE',
    description: 'Le joueur invente une nouvelle règle',
    image: 'assets/rule.png'
  },
  {
    type: 'forward_2' as TileType,
    icon: '⏩',
    name: 'AVANCEZ DE 2 CASES',
    description: 'Le joueur avance de 2 cases dans le sens de la flèche (rotation). Max 2 déplacements consécutifs pour éviter les boucles.',
    image: 'assets/row.png'
  },
  {
    type: 'copy' as TileType,
    icon: '🐑',
    name: 'MOUTON',
    description: 'Le joueur copie l\'effet d\'un adversaire',
    image: 'assets/mouton.png'
  },
  {
    type: 'drink_4' as TileType,
    icon: '🍺',
    name: 'BUVEZ 4 GORGÉES',
    description: 'Le joueur doit boire 4 gorgées',
    image: 'assets/drink_4.png'
  },
  {
    type: 'distribute_3' as TileType,
    icon: '🎁',
    name: 'DISTRIBUEZ 3 GORGÉES',
    description: 'Le joueur distribue 3 gorgées',
    image: 'assets/donnerDrink_3.png'
  },
  {
    type: 'chicken' as TileType,
    icon: '🐔',
    name: 'PETIT POULET',
    description: 'Le joueur devient le Petit Poulet',
    image: 'assets/petitPoulet.png'
  },
  {
    type: 'power' as TileType,
    icon: '⚡',
    name: 'FAVEUR DES DIEUX',
    description: 'Le joueur doit lancer deux dés et active l\'effet correspondant',
    image: 'assets/powerG.png'
  },
  {
    type: 'distribute_2' as TileType,
    icon: '🎁',
    name: 'DISTRIBUEZ 2 GORGÉES',
    description: 'Le joueur distribue 2 gorgées',
    image: 'assets/donnerDring_2.png'
  },
  {
    type: 'forward_2' as TileType,
    icon: '⏩',
    name: 'AVANCEZ DE 2 CASES',
    description: 'Le joueur avance de 2 cases dans le sens de la flèche (rotation). Max 2 déplacements consécutifs pour éviter les boucles.',
    image: 'assets/row.png'
  },
  {
    type: 'everyone_drinks' as TileType,
    icon: '🍻',
    name: 'TOURNÉE GÉNÉRALE',
    description: 'Tous les joueurs boivent 1 gorgée',
    image: 'assets/tournerGeneral.png'
  },
  {
    type: 'finish' as TileType,
    icon: '🏆',
    name: 'FINISH',
    description: 'Si le joueur arrive ici avec le bon nombre de cases, il obtient le Pouvoir du Schmitt',
    image: 'assets/finish.png'
  }
];

/**
 * Obtenir la config d'une case par son type
 */
export function getTileConfig(type: TileType): TileConfig | undefined {
  return TILE_CONFIGS.find(t => t.type === type);
}

/**
 * Obtenir la config d'une case par sa position
 */
export function getTileConfigByPosition(position: number): TileConfig {
  const index = Math.min(position, TILE_CONFIGS.length - 1);
  return TILE_CONFIGS[index];
}
