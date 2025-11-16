/**
 * Types d'effets de cases possibles
 */
export enum TileType {
  START = 'start',
  DRINK_1 = 'drink_1',
  DRINK_2 = 'drink_2',
  DRINK_3 = 'drink_3',
  DRINK_4 = 'drink_4',
  DRINK_5 = 'drink_5',
  GIVE_2 = 'give_2',
  GIVE_3 = 'give_3',
  GIVE_4 = 'give_4',
  DISTRIBUTE_2 = 'distribute_2',
  DISTRIBUTE_3 = 'distribute_3',
  DISTRIBUTE_4 = 'distribute_4',
  EVERYONE_DRINKS = 'everyone_drinks',
  MOVE_FORWARD_2 = 'move_forward_2',
  FORWARD_2 = 'forward_2',
  BACK_2 = 'back_2',
  BACK_3 = 'back_3',
  REPLAY = 'replay',
  SKIP_TURN = 'skip_turn',
  CHOOSE_PLAYER = 'choose_player',
  WATERFALL = 'waterfall',
  LUCKY = 'lucky',
  CHICKEN = 'chicken',
  COPY = 'copy',
  RULE = 'rule',
  SCHMITT_CALL = 'schmitt_call',
  TEMPLE = 'temple',
  POWER = 'power',
  FINISH = 'finish',
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
  description?: string; // Description optionnelle pour l'UI
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
