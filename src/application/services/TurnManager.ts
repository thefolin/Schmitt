/**
 * TurnManager - Gestion du flux des tours de jeu
 * Orchestre les actions du joueur actif et la transition entre les tours
 */

import { Game } from '../../domain/entities/Game';
import { Player } from '../../domain/entities/Player';
import { GameContext } from '../../domain/rules/GameContext';
import { RuleEngine } from '../../domain/rules/RuleEngine';
import { GameEventDTO } from '../dto/GameDTO';
import { EventBus } from './EventBus';

export interface TurnPhase {
  name: 'START' | 'ACTION' | 'EFFECT' | 'END';
  description: string;
}

export class TurnManager {
  private currentPhase: TurnPhase = { name: 'START', description: 'Début du tour' };

  constructor(
    private readonly game: Game,
    private readonly ruleEngine: RuleEngine,
    private readonly eventBus: EventBus
  ) {}

  /**
   * Démarre un nouveau tour
   */
  async startTurn(): Promise<void> {
    this.currentPhase = { name: 'START', description: 'Début du tour' };

    const event: GameEventDTO = {
      type: 'TURN_STARTED',
      timestamp: Date.now(),
      playerId: this.game.currentPlayer.id,
      data: {
        turnNumber: this.game.turnNumber,
        playerName: this.game.currentPlayer.name
      }
    };

    await this.eventBus.publish(event);
  }

  /**
   * Exécute une action du joueur (ex: lancer le dé, utiliser une faveur)
   */
  async executePlayerAction(
    actionType: string,
    actionData?: Record<string, any>
  ): Promise<GameEventDTO[]> {
    this.currentPhase = { name: 'ACTION', description: 'Action du joueur' };

    const events: GameEventDTO[] = [];

    // Événement d'action
    const actionEvent: GameEventDTO = {
      type: `ACTION_${actionType.toUpperCase()}`,
      timestamp: Date.now(),
      playerId: this.game.currentPlayer.id,
      data: actionData || {}
    };

    events.push(actionEvent);
    await this.eventBus.publish(actionEvent);

    return events;
  }

  /**
   * Applique les effets des règles après une action
   */
  async applyRules(triggerData?: Record<string, any>): Promise<GameEventDTO[]> {
    this.currentPhase = { name: 'EFFECT', description: 'Application des règles' };

    const context: GameContext = {
      game: this.game,
      currentPlayer: this.game.currentPlayer,
      triggerData: triggerData || {}
    };

    const events: GameEventDTO[] = [];

    // Trouver et appliquer les règles
    const applicableRules = await this.ruleEngine.executeApplicableRules(context);

    // Générer des événements pour chaque règle appliquée
    for (const rule of applicableRules) {
      const ruleEvent: GameEventDTO = {
        type: 'RULE_APPLIED',
        timestamp: Date.now(),
        playerId: this.game.currentPlayer.id,
        data: {
          ruleId: rule.id,
          ruleName: rule.name
        }
      };

      events.push(ruleEvent);
      await this.eventBus.publish(ruleEvent);
    }

    return events;
  }

  /**
   * Termine le tour actuel et passe au suivant
   */
  async endTurn(): Promise<void> {
    this.currentPhase = { name: 'END', description: 'Fin du tour' };

    const currentPlayer = this.game.currentPlayer;

    const event: GameEventDTO = {
      type: 'TURN_ENDED',
      timestamp: Date.now(),
      playerId: currentPlayer.id,
      data: {
        turnNumber: this.game.turnNumber
      }
    };

    await this.eventBus.publish(event);

    // Passer au joueur suivant
    this.game.nextTurn();

    // Démarrer automatiquement le tour suivant
    await this.startTurn();
  }

  /**
   * Flux complet d'un tour avec lancer de dé
   */
  async executeDiceTurn(diceResult: number): Promise<GameEventDTO[]> {
    const events: GameEventDTO[] = [];

    // 1. Démarrer le tour
    await this.startTurn();

    // 2. Action : lancer le dé
    const actionEvents = await this.executePlayerAction('ROLL_DICE', {
      diceResult
    });
    events.push(...actionEvents);

    // 3. Déplacer le joueur
    const oldPosition = this.game.currentPlayer.position.index;
    this.game.currentPlayer.moveBy(diceResult);
    const newPosition = this.game.currentPlayer.position.index;

    const moveEvent: GameEventDTO = {
      type: 'PLAYER_MOVED',
      timestamp: Date.now(),
      playerId: this.game.currentPlayer.id,
      data: {
        from: oldPosition,
        to: newPosition,
        steps: diceResult
      }
    };

    events.push(moveEvent);
    await this.eventBus.publish(moveEvent);

    // 4. Appliquer les règles de la case
    const ruleEvents = await this.applyRules({ diceRoll: diceResult });
    events.push(...ruleEvents);

    // 5. Terminer le tour
    await this.endTurn();

    return events;
  }

  /**
   * Obtient la phase actuelle du tour
   */
  getCurrentPhase(): TurnPhase {
    return this.currentPhase;
  }
}
