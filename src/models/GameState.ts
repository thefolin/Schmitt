import { Player } from './Player';

/**
 * État global du jeu
 */
export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  isRolling: boolean;
  lastDiceValue: number | null;
  chickenPlayer: Player | null;
  customRules: CustomRule[];
  waitingForEffect: boolean;
  history: string[];
  soundEnabled: boolean;
  startTime: number | null;
  totalMoves: number;
  manualMode: boolean;
  selectedPlayerForManual: Player | null;
}

/**
 * Règle personnalisée créée par un joueur
 */
export interface CustomRule {
  player: string;
  rule: string;
}

/**
 * Classe pour gérer l'état du jeu
 */
export class GameStateManager {
  private state: GameState;

  constructor() {
    this.state = this.createInitialState();
  }

  /**
   * Crée l'état initial du jeu
   */
  private createInitialState(): GameState {
    return {
      players: [],
      currentPlayerIndex: 0,
      isRolling: false,
      lastDiceValue: null,
      chickenPlayer: null,
      customRules: [],
      waitingForEffect: false,
      history: [],
      soundEnabled: true,
      startTime: null,
      totalMoves: 0,
      manualMode: false,
      selectedPlayerForManual: null,
    };
  }

  /**
   * Récupère l'état actuel
   */
  getState(): GameState {
    return this.state;
  }

  /**
   * Récupère le joueur actuel
   */
  getCurrentPlayer(): Player | null {
    if (this.state.players.length === 0) return null;
    return this.state.players[this.state.currentPlayerIndex];
  }

  /**
   * Passe au joueur suivant
   */
  nextPlayer(): void {
    this.state.currentPlayerIndex =
      (this.state.currentPlayerIndex + 1) % this.state.players.length;
    this.state.isRolling = false;
    this.state.waitingForEffect = false;
  }

  /**
   * Ajoute un message à l'historique
   */
  addToHistory(message: string): void {
    this.state.history.unshift(message);
    if (this.state.history.length > 20) {
      this.state.history.pop();
    }
  }

  /**
   * Ajoute une règle personnalisée
   */
  addCustomRule(playerName: string, rule: string): void {
    this.state.customRules.push({ player: playerName, rule });
  }

  /**
   * Réinitialise l'état du jeu
   */
  reset(): void {
    const players = this.state.players;
    this.state = this.createInitialState();
    this.state.players = players;
    players.forEach(player => {
      if ('reset' in player && typeof player.reset === 'function') {
        player.reset();
      }
    });
  }

  /**
   * Démarre le jeu
   */
  startGame(): void {
    this.state.startTime = Date.now();
    this.state.totalMoves = 0;
    this.state.history = [];
  }
}
