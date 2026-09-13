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
 * Charge le parcours depuis public/data/board-tiles.json.
 *
 * Le plateau vit dans un fichier de données et non dans le code : modifier
 * une case, en ajouter ou en retirer ne demande aucune recompilation.
 * L'ordre du tableau `tiles` EST l'ordre de parcours.
 *
 * En cas d'échec (fichier absent ou invalide), le parcours codé ci-dessus
 * sert de repli : le jeu reste jouable.
 */
export async function loadTileConfigs(
  url = '/data/board-tiles.json'
): Promise<TileConfig[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data: unknown = await response.json();
    const tiles = (data as { tiles?: unknown }).tiles;
    if (!Array.isArray(tiles) || tiles.length === 0) {
      throw new Error('board-tiles.json : "tiles" doit être un tableau non vide');
    }

    const parsed = tiles.filter(
      (t): t is TileConfig =>
        typeof t?.type === 'string' && typeof t?.name === 'string'
    );

    if (parsed.length !== tiles.length) {
      console.warn(
        `board-tiles.json : ${tiles.length - parsed.length} case(s) ignorée(s), type ou name manquant`
      );
    }

    if (parsed.length === 0) throw new Error('aucune case valide');

    TILE_CONFIGS.splice(0, TILE_CONFIGS.length, ...parsed);
    return TILE_CONFIGS;
  } catch (error) {
    console.warn(
      'Parcours par défaut conservé, board-tiles.json non chargé :',
      (error as Error).message
    );
    return TILE_CONFIGS;
  }
}

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
