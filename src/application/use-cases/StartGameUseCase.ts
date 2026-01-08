/**
 * StartGameUseCase - Cas d'utilisation pour démarrer une partie
 * Orchestre la création et l'initialisation d'un jeu
 */

import { Game } from '../../domain/entities/Game';
import { Player } from '../../domain/entities/Player';
import { GameDefinition } from '../../domain/definitions/GameDefinition';
import { RuleEngine } from '../../domain/rules/RuleEngine';
import { CreateGameDTO, StartGameResultDTO, GameStateDTO, PlayerDTO, TileDTO } from '../dto/GameDTO';
import { EventBus } from '../services/EventBus';
import { TurnManager } from '../services/TurnManager';

export class StartGameUseCase {
  constructor(
    private readonly eventBus: EventBus
  ) {}

  /**
   * Démarre une nouvelle partie
   */
  async execute(
    gameDefinition: GameDefinition,
    createGameDTO: CreateGameDTO
  ): Promise<StartGameResultDTO> {
    try {
      // 1. Créer l'entité Game
      const game = new Game(
        this.generateGameId(),
        createGameDTO.gameDefinitionId
      );

      // 2. Ajouter les joueurs
      for (const playerData of createGameDTO.players) {
        const player = new Player(
          playerData.id,
          playerData.name,
          playerData.color
        );
        game.addPlayer(player);
      }

      // 3. Créer le plateau
      const board = gameDefinition.createBoard();
      game.setBoard(board);

      // 4. Charger les règles
      const ruleEngine = new RuleEngine();
      const rules = gameDefinition.createRules();
      ruleEngine.registerRules(rules);

      // 5. Publier l'événement de création
      await this.eventBus.publish({
        type: 'GAME_CREATED',
        timestamp: Date.now(),
        data: {
          gameId: game.id,
          gameDefinitionId: gameDefinition.id,
          playerCount: game.players.length
        }
      });

      // 6. Démarrer le jeu
      game.start();

      // 7. Publier l'événement de démarrage
      await this.eventBus.publish({
        type: 'GAME_STARTED',
        timestamp: Date.now(),
        data: {
          gameId: game.id,
          turnNumber: game.turnNumber,
          currentPlayer: game.currentPlayer.name
        }
      });

      // 8. Créer le TurnManager
      const turnManager = new TurnManager(game, ruleEngine, this.eventBus);
      await turnManager.startTurn();

      // 9. Convertir en DTO
      const gameStateDTO = this.convertGameToDTO(game);

      return {
        success: true,
        gameState: gameStateDTO,
        message: `Partie ${gameDefinition.name} démarrée avec ${game.players.length} joueurs`
      };

    } catch (error) {
      return {
        success: false,
        gameState: this.createEmptyGameState(createGameDTO.gameDefinitionId),
        message: `Erreur lors du démarrage: ${(error as Error).message}`
      };
    }
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
      players: game.players.map(this.convertPlayerToDTO),
      board: {
        size: game.board?.size || 0,
        tiles: (game.board?.tiles || []).map(this.convertTileToDTO)
      }
    };
  }

  /**
   * Convertit un Player en DTO
   */
  private convertPlayerToDTO(player: Player): PlayerDTO {
    return {
      id: player.id,
      name: player.name,
      color: player.color,
      position: {
        index: player.position.index,
        x: player.position.x,
        y: player.position.y
      },
      resources: player.getAllResources()
    };
  }

  /**
   * Convertit un Tile en DTO
   */
  private convertTileToDTO(tile: any): TileDTO {
    return {
      id: tile.id,
      type: tile.type,
      name: tile.name,
      icon: tile.icon,
      position: {
        index: tile.position.index,
        x: tile.position.x,
        y: tile.position.y
      }
    };
  }

  /**
   * Crée un état de jeu vide pour les erreurs
   */
  private createEmptyGameState(gameDefinitionId: string): GameStateDTO {
    return {
      id: '',
      gameDefinitionId,
      phase: 'SETUP',
      turnNumber: 0,
      currentPlayerIndex: 0,
      players: [],
      board: {
        size: 0,
        tiles: []
      }
    };
  }

  /**
   * Génère un ID unique pour le jeu
   */
  private generateGameId(): string {
    return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
