import type { Player } from '@/core/models/Player';

/**
 * Logique métier pure du jeu
 * Pas de DOM, pas de Canvas, pas de UI
 * Seulement l'état et les règles du jeu
 */
/**
 * Dernière position du plateau officiel (23 cases, de 0 à 22).
 * Sert de repli tant qu'aucun plateau n'a été chargé.
 */
export const DEFAULT_LAST_POSITION = 22;

export class GameLogic {
  private players: Player[] = [];
  /**
   * Dernière case du plateau chargé : un plateau composé par un joueur peut
   * en compter plus ou moins que le plateau officiel.
   */
  private lastPosition: number = DEFAULT_LAST_POSITION;
  private currentPlayerIndex: number = 0;
  private gameStarted: boolean = false;
  private history: string[] = [];
  private lastDiceRoll: number = 0;

  /**
   * Définit la taille du plateau en cours (nombre de cases du parcours).
   * À appeler avant startGame() quand un layout personnalisé est chargé.
   */
  public setBoardSize(tileCount: number): void {
    this.lastPosition = Math.max(1, tileCount - 1);
  }

  public getLastPosition(): number {
    return this.lastPosition;
  }

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
    player.position = Math.min(newPosition, this.lastPosition);

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
      player.position = Math.max(0, Math.min(position, this.lastPosition));
    }
  }

  /**
   * Vérifie si un joueur a gagné
   */
  public checkVictory(): Player | null {
    const winner = this.players.find(p => p.position >= this.lastPosition);
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
