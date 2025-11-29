import { Player } from './Player';
import { Board } from './Board';
import { GamePhase } from '../value-objects/GamePhase';

/**
 * Game (Agrégat racine du domaine)
 * Représente une partie de jeu en cours
 */
export class Game {
  private _players: Player[] = [];
  private _currentPlayerIndex: number = 0;
  private _phase: GamePhase = GamePhase.SETUP;
  private _board?: Board;
  private _turnNumber: number = 0;

  constructor(
    public readonly id: string,
    public readonly gameDefinitionId: string // "schmitt-odyssee", "dominion", etc.
  ) {}

  // Phase
  get phase(): GamePhase {
    return this._phase;
  }

  start(): void {
    if (this._players.length === 0) {
      throw new Error('Cannot start game without players');
    }
    if (!this._board) {
      throw new Error('Cannot start game without board');
    }
    this._phase = GamePhase.PLAYING;
    this._turnNumber = 1;
  }

  pause(): void {
    this._phase = GamePhase.PAUSED;
  }

  resume(): void {
    this._phase = GamePhase.PLAYING;
  }

  end(): void {
    this._phase = GamePhase.GAME_OVER;
  }

  get isPlaying(): boolean {
    return this._phase === GamePhase.PLAYING;
  }

  // Board
  get board(): Board | undefined {
    return this._board;
  }

  setBoard(board: Board): void {
    this._board = board;
  }

  // Players
  get players(): Player[] {
    return [...this._players]; // Defensive copy
  }

  addPlayer(player: Player): void {
    if (this._phase !== GamePhase.SETUP) {
      throw new Error('Cannot add players after game has started');
    }
    this._players.push(player);
  }

  getPlayer(id: string): Player | undefined {
    return this._players.find(p => p.id === id);
  }

  get currentPlayer(): Player {
    if (this._players.length === 0) {
      throw new Error('No players in game');
    }
    return this._players[this._currentPlayerIndex];
  }

  get currentPlayerIndex(): number {
    return this._currentPlayerIndex;
  }

  // Turn management
  get turnNumber(): number {
    return this._turnNumber;
  }

  nextTurn(): void {
    this._currentPlayerIndex = (this._currentPlayerIndex + 1) % this._players.length;
    if (this._currentPlayerIndex === 0) {
      this._turnNumber++;
    }
  }

  setCurrentPlayer(index: number): void {
    if (index < 0 || index >= this._players.length) {
      throw new Error(`Invalid player index: ${index}`);
    }
    this._currentPlayerIndex = index;
  }

  // Serialization
  toJSON() {
    return {
      id: this.id,
      gameDefinitionId: this.gameDefinitionId,
      phase: this._phase,
      turnNumber: this._turnNumber,
      currentPlayerIndex: this._currentPlayerIndex,
      players: this._players.map(p => p.toJSON()),
      board: this._board?.toJSON()
    };
  }

  static fromJSON(data: any): Game {
    const game = new Game(data.id, data.gameDefinitionId);
    game._phase = data.phase;
    game._turnNumber = data.turnNumber;
    game._currentPlayerIndex = data.currentPlayerIndex;

    data.players.forEach((playerData: any) => {
      game._players.push(Player.fromJSON(playerData));
    });

    if (data.board) {
      game._board = Board.fromJSON(data.board);
    }

    return game;
  }
}
