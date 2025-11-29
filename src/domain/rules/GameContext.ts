import { Game } from '../entities/Game';
import { Player } from '../entities/Player';

/**
 * Contexte d'exécution d'une règle
 * Contient toutes les informations nécessaires pour évaluer conditions et exécuter effets
 */
export interface GameContext {
  game: Game;
  currentPlayer: Player;
  triggerData?: any; // Données spécifiques au trigger (dés, carte jouée, etc.)
  metadata?: Record<string, any>; // Métadonnées additionnelles
}
