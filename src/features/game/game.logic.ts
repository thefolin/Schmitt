import type { Player } from '@/core/models/Player';

/**
 * Logique métier pure du jeu
 * Pas de DOM, pas de Canvas, pas de UI
 * Seulement l'état et les règles du jeu
 */
export class GameLogic {
  private players: Player[] = [];
  private currentPlayerIndex: number = 0;
  private gameStarted: boolean = false;
  private history: string[] = [];
  private lastDiceRoll: number = 0;

  /**
   * Initialise une nouvelle partie
   */
  public startGame(playersConfig: { name: string; color: string }[]): void {
    this.players = playersConfig.map((config, index) => ({
      name: config.name,
      color: config.color,
      position: 0,
      index,
      hasSchmittPower: false,
      isReturning: false,
      drinks: 0,
      hasAthenaShield: false,
      canReplay: false
    }));

    this.currentPlayerIndex = 0;
    this.gameStarted = true;
    this.history = [];
    this.addToHistory(`🎮 Partie démarrée avec ${this.players.length} joueurs`);
  }

  /**
   * Lance le dé (logique pure)
   */
  public rollDice(): number {
    const roll = Math.floor(Math.random() * 6) + 1;
    this.lastDiceRoll = roll;
    const currentPlayer = this.getCurrentPlayer();

    if (currentPlayer) {
      this.addToHistory(`${currentPlayer.name} lance le dé : ${roll}`);
    }

    return roll;
  }

  /**
   * Déplace un joueur (logique pure)
   */
  public movePlayer(playerIndex: number, steps: number): number {
    const player = this.players[playerIndex];
    if (!player) return 0;

    const newPosition = player.position + steps;
    player.position = Math.min(newPosition, 23); // Max 23 cases

    return player.position;
  }

  /**
   * Ajoute des boissons à un joueur
   */
  public addDrinks(playerIndex: number, amount: number): void {
    const player = this.players[playerIndex];
    if (player) {
      player.drinks += amount;
    }
  }

  /**
   * Active/désactive le pouvoir Schmitt
   */
  public setSchmittPower(playerIndex: number, active: boolean): void {
    const player = this.players[playerIndex];
    if (player) {
      player.hasSchmittPower = active;
    }
  }

  /**
   * Passe au joueur suivant
   */
  public nextPlayer(): void {
    const currentPlayer = this.getCurrentPlayer();

    // Si le joueur peut rejouer, on ne change pas
    if (currentPlayer?.canReplay) {
      currentPlayer.canReplay = false;
      this.addToHistory(`${currentPlayer.name} rejoue !`);
      return;
    }

    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
  }

  /**
   * Revient au joueur précédent (pour Apollon)
   */
  public previousPlayer(): void {
    this.currentPlayerIndex = (this.currentPlayerIndex - 1 + this.players.length) % this.players.length;
  }

  /**
   * Définit la position d'un joueur (pour Hermès)
   */
  public setPlayerPosition(playerIndex: number, position: number): void {
    const player = this.players[playerIndex];
    if (player) {
      player.position = Math.max(0, Math.min(position, 23));
    }
  }

  /**
   * Vérifie si un joueur a gagné
   */
  public checkVictory(): Player | null {
    const winner = this.players.find(p => p.position >= 23);
    return winner || null;
  }

  /**
   * Reset le jeu
   */
  public reset(): void {
    this.players = [];
    this.currentPlayerIndex = 0;
    this.gameStarted = false;
    this.history = [];
    this.lastDiceRoll = 0;
  }

  /**
   * Ajoute un message à l'historique
   */
  private addToHistory(message: string): void {
    this.history.push(message);
    if (this.history.length > 50) {
      this.history.shift(); // Limite à 50 messages
    }
  }

  // ============================================
  // GETTERS (lecture seule de l'état)
  // ============================================

  public getPlayers(): Player[] {
    return this.players.map(p => ({ ...p })); // Copie profonde pour éviter mutation externe
  }

  public getCurrentPlayer(): Player | null {
    return this.players[this.currentPlayerIndex] || null;
  }

  public getCurrentPlayerIndex(): number {
    return this.currentPlayerIndex;
  }

  public isGameStarted(): boolean {
    return this.gameStarted;
  }

  public getHistory(): string[] {
    return [...this.history];
  }

  public getLastDiceRoll(): number {
    return this.lastDiceRoll;
  }

  public getPlayerByIndex(index: number): Player | null {
    return this.players[index] || null;
  }

  public getPlayersCount(): number {
    return this.players.length;
  }
}
