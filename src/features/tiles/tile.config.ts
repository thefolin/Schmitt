import type { TileConfig, TileType } from '@/core/models/Tile';

/**
 * Configuration des cases - FACILEMENT MODIFIABLE
 * Vous pouvez changer les icônes, noms, effets ici
 */
export const TILE_CONFIGS: TileConfig[] = [
  {
    type: 'start' as TileType,
    icon: '🏁',
    name: 'START',
    description: 'Point de départ'
  },
  {
    type: 'everyone_drinks' as TileType,
    icon: '🍻',
    name: 'TOURNÉE GÉNÉRALE',
    description: 'Tout le monde boit !'
  },
  {
    type: 'drink_2' as TileType,
    icon: '🍺',
    name: 'BOIS 2',
    description: 'Tu bois 2 gorgées'
  },
  {
    type: 'give_3' as TileType,
    icon: '🎁',
    name: 'DONNE 3',
    description: 'Distribue 3 gorgées'
  },
  {
    type: 'power' as TileType,
    icon: '⚡',
    name: 'POUVOIR SCHMITT',
    description: 'Obtiens le pouvoir Schmitt !'
  },
  {
    type: 'back_3' as TileType,
    icon: '⏪',
    name: 'RECULE 3',
    description: 'Recule de 3 cases'
  },
  {
    type: 'replay' as TileType,
    icon: '🔄',
    name: 'REJOUE',
    description: 'Lance le dé à nouveau !'
  },
  {
    type: 'drink_4' as TileType,
    icon: '🍺🍺',
    name: 'BOIS 4',
    description: 'Tu bois 4 gorgées'
  },
  {
    type: 'temple' as TileType,
    icon: '🏛️',
    name: 'TEMPLE DES DIEUX',
    description: 'Choisis une faveur divine'
  },
  {
    type: 'give_2' as TileType,
    icon: '🎁',
    name: 'DONNE 2',
    description: 'Distribue 2 gorgées'
  },
  {
    type: 'drink_1' as TileType,
    icon: '🍺',
    name: 'BOIS 1',
    description: 'Tu bois 1 gorgée'
  },
  {
    type: 'forward_2' as TileType,
    icon: '⏩',
    name: 'AVANCE 2',
    description: 'Avance de 2 cases'
  },
  {
    type: 'drink_3' as TileType,
    icon: '🍺',
    name: 'BOIS 3',
    description: 'Tu bois 3 gorgées'
  },
  {
    type: 'choose_player' as TileType,
    icon: '👉',
    name: 'CHOISIS UN JOUEUR',
    description: 'Désigne un joueur qui boit 2'
  },
  {
    type: 'give_4' as TileType,
    icon: '🎁',
    name: 'DONNE 4',
    description: 'Distribue 4 gorgées'
  },
  {
    type: 'skip_turn' as TileType,
    icon: '⏭️',
    name: 'PASSE TON TOUR',
    description: 'Tu ne joues pas au prochain tour'
  },
  {
    type: 'drink_5' as TileType,
    icon: '🍺🍺',
    name: 'BOIS 5',
    description: 'Tu bois 5 gorgées'
  },
  {
    type: 'back_2' as TileType,
    icon: '⏪',
    name: 'RECULE 2',
    description: 'Recule de 2 cases'
  },
  {
    type: 'lucky' as TileType,
    icon: '🍀',
    name: 'CASE CHANCE',
    description: 'Effet aléatoire !'
  },
  {
    type: 'waterfall' as TileType,
    icon: '🌊',
    name: 'CASCADE',
    description: 'Cascade : tout le monde boit en chaîne'
  },
  {
    type: 'finish' as TileType,
    icon: '🏆',
    name: 'ARRIVÉE',
    description: 'Victoire !'
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
