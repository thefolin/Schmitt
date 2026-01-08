/**
 * ExecuteActionUseCase - Cas d'utilisation pour exécuter une action de jeu
 * Gère les actions des joueurs (lancer de dé, utiliser une faveur, etc.)
 */

import { Game } from '../../domain/entities/Game';
import { RuleEngine } from '../../domain/rules/RuleEngine';
import { GameActionDTO, ExecuteActionResultDTO, GameStateDTO, GameEventDTO } from '../dto/GameDTO';
import { EventBus } from '../services/EventBus';
import { TurnManager } from '../services/TurnManager';

export class ExecuteActionUseCase {
  constructor(
    private readonly eventBus: EventBus
  ) {}

  /**
   * Exécute une action de jeu
   */
  async execute(
    game: Game,
    ruleEngine: RuleEngine,
    action: GameActionDTO
  ): Promise<ExecuteActionResultDTO> {
    const events: GameEventDTO[] = [];
    const errors: string[] = [];

    try {
      // Vérifier que c'est le bon joueur
      if (action.playerId !== game.currentPlayer.id) {
        throw new Error(`Ce n'est pas le tour du joueur ${action.playerId}`);
      }

      // Créer le TurnManager
      const turnManager = new TurnManager(game, ruleEngine, this.eventBus);

      // Exécuter l'action en fonction du type
      let actionEvents: GameEventDTO[] = [];

      switch (action.type) {
        case 'ROLL_DICE':
          actionEvents = await this.handleRollDice(game, turnManager, action, ruleEngine);
          break;

        case 'MOVE_PLAYER':
          actionEvents = await this.handleMovePlayer(game, turnManager, action, ruleEngine);
          break;

        case 'USE_POWER':
          actionEvents = await this.handleUsePower(game, turnManager, action, ruleEngine);
          break;

        case 'END_TURN':
          actionEvents = await this.handleEndTurn(turnManager);
          break;

        case 'CUSTOM':
          actionEvents = await this.handleCustomAction(game, turnManager, action, ruleEngine);
          break;

        default:
          throw new Error(`Type d'action inconnu: ${action.type}`);
      }

      events.push(...actionEvents);

      // Convertir l'état en DTO
      const gameStateDTO = this.convertGameToDTO(game);

      return {
        success: true,
        gameState: gameStateDTO,
        events
      };

    } catch (error) {
      errors.push((error as Error).message);

      return {
        success: false,
        gameState: this.convertGameToDTO(game),
        events,
        errors
      };
    }
  }

  /**
   * Gère le lancer de dé
   */
  private async handleRollDice(
    game: Game,
    turnManager: TurnManager,
    action: GameActionDTO,
    ruleEngine: RuleEngine
  ): Promise<GameEventDTO[]> {
    const diceResult = action.payload?.diceResult || this.rollDice(6);

    // Utiliser le flux complet de TurnManager
    return await turnManager.executeDiceTurn(diceResult);
  }

  /**
   * Gère le déplacement manuel du joueur
   */
  private async handleMovePlayer(
    game: Game,
    turnManager: TurnManager,
    action: GameActionDTO,
    ruleEngine: RuleEngine
  ): Promise<GameEventDTO[]> {
    const events: GameEventDTO[] = [];
    const steps = action.payload?.steps || 0;

    // Action : déplacer
    const actionEvents = await turnManager.executePlayerAction('MOVE_PLAYER', {
      steps
    });
    events.push(...actionEvents);

    // Déplacer le joueur
    const oldPosition = game.currentPlayer.position.index;
    game.currentPlayer.moveBy(steps);
    const newPosition = game.currentPlayer.position.index;

    const moveEvent: GameEventDTO = {
      type: 'PLAYER_MOVED',
      timestamp: Date.now(),
      playerId: game.currentPlayer.id,
      data: {
        from: oldPosition,
        to: newPosition,
        steps
      }
    };

    events.push(moveEvent);
    await this.eventBus.publish(moveEvent);

    // Appliquer les règles
    const ruleEvents = await turnManager.applyRules({ manualMove: true, steps });
    events.push(...ruleEvents);

    return events;
  }

  /**
   * Gère l'utilisation d'une faveur/pouvoir
   */
  private async handleUsePower(
    game: Game,
    turnManager: TurnManager,
    action: GameActionDTO,
    ruleEngine: RuleEngine
  ): Promise<GameEventDTO[]> {
    const events: GameEventDTO[] = [];
    const powerId = action.payload?.powerId;

    if (!powerId) {
      throw new Error('powerId manquant dans le payload');
    }

    // Action : utiliser le pouvoir
    const actionEvents = await turnManager.executePlayerAction('USE_POWER', {
      powerId,
      ...action.payload
    });
    events.push(...actionEvents);

    // Appliquer les règles du pouvoir
    const ruleEvents = await turnManager.applyRules({
      powerUsed: true,
      powerId,
      ...action.payload
    });
    events.push(...ruleEvents);

    return events;
  }

  /**
   * Gère la fin de tour manuelle
   */
  private async handleEndTurn(turnManager: TurnManager): Promise<GameEventDTO[]> {
    await turnManager.endTurn();
    return [];
  }

  /**
   * Gère une action personnalisée
   */
  private async handleCustomAction(
    game: Game,
    turnManager: TurnManager,
    action: GameActionDTO,
    ruleEngine: RuleEngine
  ): Promise<GameEventDTO[]> {
    const events: GameEventDTO[] = [];

    // Action personnalisée
    const actionEvents = await turnManager.executePlayerAction(
      action.payload?.customType || 'CUSTOM',
      action.payload
    );
    events.push(...actionEvents);

    // Appliquer les règles si nécessaire
    if (action.payload?.applyRules) {
      const ruleEvents = await turnManager.applyRules(action.payload);
      events.push(...ruleEvents);
    }

    return events;
  }

  /**
   * Lance un dé (1 à sides)
   */
  private rollDice(sides: number = 6): number {
    return Math.floor(Math.random() * sides) + 1;
  }

  /**
   * Convertit une entité Game en DTO
   */
  private convertGameToDTO(game: Game): GameStateDTO {
    return {
      id: game.id,
      gameDefinitionId: game.gameDefinitionId,
      phase: game.phase,
      turnNumber: game.turnNumber,
      currentPlayerIndex: game.currentPlayerIndex,
      players: game.players.map(player => ({
        id: player.id,
        name: player.name,
        color: player.color,
        position: {
          index: player.position.index,
          x: player.position.x,
          y: player.position.y
        },
        resources: player.getAllResources()
      })),
      board: {
        size: game.board?.size || 0,
        tiles: (game.board?.tiles || []).map(tile => ({
          id: tile.id,
          type: tile.type,
          name: tile.name,
          icon: tile.icon,
          position: {
            index: tile.position.index,
            x: tile.position.x,
            y: tile.position.y
          }
        }))
      }
    };
  }
}
