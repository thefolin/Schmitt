import { GameContext } from './GameContext';

/**
 * Effect (action d'une règle)
 * Pattern Command pour différents types d'effets
 */
export interface Effect {
  readonly type: string;
  readonly params: Record<string, any>;

  /**
   * Exécute l'effet dans le contexte donné
   */
  execute(context: GameContext): void | Promise<void>;
}

/**
 * Effect : Ajouter une ressource au joueur
 */
export class AddResourceEffect implements Effect {
  readonly type = 'AddResource';

  constructor(
    public readonly params: {
      resourceId: string;
      amount: number;
      target?: 'current_player' | 'all_players';
    }
  ) {}

  execute(context: GameContext): void {
    const { currentPlayer, game } = context;
    const target = this.params.target ?? 'current_player';

    if (target === 'current_player') {
      currentPlayer.addResource(this.params.resourceId, this.params.amount);
    } else if (target === 'all_players') {
      game.players.forEach(player => {
        player.addResource(this.params.resourceId, this.params.amount);
      });
    }
  }
}

/**
 * Effect : Déplacer le joueur
 */
export class MovePlayerEffect implements Effect {
  readonly type = 'MovePlayer';

  constructor(
    public readonly params: {
      steps?: number;
      toPosition?: number;
      relative?: boolean;
    }
  ) {}

  execute(context: GameContext): void {
    const { currentPlayer } = context;

    if (this.params.toPosition !== undefined) {
      // Déplacement absolu
      const position = currentPlayer.position;
      currentPlayer.moveTo(
        typeof position.index === 'number'
          ? { index: this.params.toPosition } as any
          : position
      );
    } else if (this.params.steps !== undefined) {
      // Déplacement relatif
      currentPlayer.moveBy(this.params.steps);
    }
  }
}

/**
 * Effect : Passer le tour
 */
export class SkipTurnEffect implements Effect {
  readonly type = 'SkipTurn';

  constructor(public readonly params: { count?: number } = {}) {}

  execute(context: GameContext): void {
    const { game } = context;
    const count = this.params.count ?? 1;

    for (let i = 0; i < count; i++) {
      game.nextTurn();
    }
  }
}

/**
 * Effect : Notification (UI side-effect, sera géré par la couche présentation)
 */
export class NotificationEffect implements Effect {
  readonly type = 'Notification';

  constructor(public readonly params: { message: string; icon?: string }) {}

  execute(context: GameContext): void {
    // Sera intercepté par la couche présentation
    console.log(`[Notification] ${this.params.icon ?? ''} ${this.params.message}`);
  }
}

/**
 * Factory pour créer des effets depuis JSON
 */
export class EffectFactory {
  static fromJSON(data: any): Effect {
    switch (data.type) {
      case 'AddResource':
        return new AddResourceEffect(data.params);
      case 'MovePlayer':
        return new MovePlayerEffect(data.params);
      case 'SkipTurn':
        return new SkipTurnEffect(data.params);
      case 'Notification':
        return new NotificationEffect(data.params);
      default:
        throw new Error(`Unknown effect type: ${data.type}`);
    }
  }
}
