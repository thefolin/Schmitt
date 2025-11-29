import { Board } from '../entities/Board';
import { Tile } from '../entities/Tile';
import { Position } from '../value-objects/Position';
import { Rule } from '../rules/Rule';

/**
 * Resource Definition (Points, Monnaie, Gorgées, etc.)
 */
export interface ResourceDefinition {
  id: string;
  name: string;
  icon?: string;
  initial?: number;
}

/**
 * Game Settings
 */
export interface GameSettings {
  minPlayers: number;
  maxPlayers: number;
  boardSize?: number;
  hasDice?: boolean;
  diceCount?: number;
  diceSides?: number;
}

/**
 * GameDefinition (Configuration d'un jeu)
 * Charge depuis JSON et crée les objets du domaine
 */
export class GameDefinition {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly version: string,
    public readonly type: 'linear-board' | 'grid' | 'deck-building' | 'custom',
    public readonly settings: GameSettings,
    public readonly resources: ResourceDefinition[] = [],
    private boardDefinition?: any,
    private rulesDefinitions: any[] = []
  ) {}

  /**
   * Crée le plateau à partir de la définition
   */
  createBoard(): Board {
    if (!this.boardDefinition) {
      throw new Error('No board definition');
    }

    const tiles = this.boardDefinition.tiles.map((tileData: any, index: number) => {
      const position = Position.fromIndex(tileData.id ?? index);
      return new Tile(
        `tile_${index}`,
        position,
        tileData.type,
        tileData.name,
        tileData.icon,
        tileData.metadata ?? {}
      );
    });

    return new Board(
      `${this.id}_board`,
      this.boardDefinition.layout ?? 'linear',
      tiles
    );
  }

  /**
   * Crée les règles à partir des définitions
   */
  createRules(): Rule[] {
    return this.rulesDefinitions
      .filter(ruleDef => !ruleDef.file) // On skip les fichiers externes pour l'instant
      .map(ruleDef => Rule.fromJSON(ruleDef));
  }

  /**
   * Charge depuis JSON
   */
  static fromJSON(data: any): GameDefinition {
    return new GameDefinition(
      data.id,
      data.name,
      data.version,
      data.type,
      data.settings,
      data.resources ?? [],
      data.board,
      data.rules ?? []
    );
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      type: this.type,
      settings: this.settings,
      resources: this.resources,
      board: this.boardDefinition,
      rules: this.rulesDefinitions
    };
  }
}
