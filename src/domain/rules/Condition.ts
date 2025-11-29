import { GameContext } from './GameContext';

/**
 * Condition (quand une règle s'applique)
 * Pattern Strategy pour différents types de conditions
 */
export interface Condition {
  readonly type: string;
  readonly params: Record<string, any>;

  /**
   * Évalue si la condition est vraie dans le contexte donné
   */
  evaluate(context: GameContext): boolean;
}

/**
 * Condition : Joueur atterrit sur une case
 */
export class OnPlayerLandsOnCondition implements Condition {
  readonly type = 'OnPlayerLandsOn';

  constructor(public readonly params: { tileId?: string; tileType?: string; position?: number }) {}

  evaluate(context: GameContext): boolean {
    const { currentPlayer, game, triggerData } = context;
    const position = currentPlayer.position;

    // Check by position index
    if (this.params.position !== undefined) {
      return position.index === this.params.position;
    }

    // Check by tile ID or type
    const tile = game.board?.getTileAt(position);
    if (!tile) return false;

    if (this.params.tileId) {
      return tile.id === this.params.tileId;
    }

    if (this.params.tileType) {
      return tile.type === this.params.tileType;
    }

    return false;
  }
}

/**
 * Condition : Joueur a une ressource >= montant
 */
export class HasResourceCondition implements Condition {
  readonly type = 'HasResource';

  constructor(public readonly params: { resourceId: string; amount: number }) {}

  evaluate(context: GameContext): boolean {
    const { currentPlayer } = context;
    return currentPlayer.getResource(this.params.resourceId) >= this.params.amount;
  }
}

/**
 * Condition : Toujours vraie (pour règles inconditionnelles)
 */
export class AlwaysTrueCondition implements Condition {
  readonly type = 'AlwaysTrue';
  readonly params = {};

  evaluate(context: GameContext): boolean {
    return true;
  }
}

/**
 * Factory pour créer des conditions depuis JSON
 */
export class ConditionFactory {
  static fromJSON(data: any): Condition {
    switch (data.type) {
      case 'OnPlayerLandsOn':
        return new OnPlayerLandsOnCondition(data.params);
      case 'HasResource':
        return new HasResourceCondition(data.params);
      case 'AlwaysTrue':
        return new AlwaysTrueCondition();
      default:
        throw new Error(`Unknown condition type: ${data.type}`);
    }
  }
}
