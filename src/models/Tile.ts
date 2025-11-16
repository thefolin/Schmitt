/**
 * Types d'effets de cases possibles
 */
export enum TileType {
  START = 'start',
  DRINK_2 = 'drink_2',
  DRINK_3 = 'drink_3',
  DRINK_4 = 'drink_4',
  DISTRIBUTE_2 = 'distribute_2',
  DISTRIBUTE_3 = 'distribute_3',
  DISTRIBUTE_4 = 'distribute_4',
  EVERYONE_DRINKS = 'everyone_drinks',
  MOVE_FORWARD_2 = 'move_forward_2',
  CHICKEN = 'chicken',
  COPY = 'copy',
  RULE = 'rule',
  SCHMITT_CALL = 'schmitt_call',
  TEMPLE = 'temple',
  POWER = 'power',
  EMPTY = 'empty',
}

/**
 * Interface pour les données de case provenant du JSON
 */
export interface TileData {
  id: number;
  name: string;
  effect: string;
  image: string;
}

/**
 * Configuration d'une case du plateau
 */
export interface TileConfig {
  type: TileType;
  icon: string;
  name: string;
}

/**
 * Classe représentant une case du plateau
 */
export class Tile {
  id: number;
  type: TileType;
  icon: string;
  name: string;
  effect: string;
  image: string;

  constructor(id: number, config: TileConfig, data?: TileData) {
    this.id = id;
    this.type = config.type;
    this.icon = config.icon;
    this.name = config.name;
    this.effect = data?.effect || '';
    this.image = data?.image || '';
  }

  /**
   * Vérifie si la case a un effet spécial
   */
  hasEffect(): boolean {
    return this.type !== TileType.START &&
           this.type !== TileType.POWER &&
           this.type !== TileType.EMPTY;
  }
}
