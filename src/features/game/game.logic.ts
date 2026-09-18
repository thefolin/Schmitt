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
   * Joueur actuellement Petit Poulet, et son rang (1 = petit, 2 = grand).
   *
   * Règle : tomber sur la case fait de vous le Petit Poulet. Y retomber vous
   * promeut Grand Poulet — mais seulement si aucun autre joueur n'est passé
   * sur la case entre-temps : un nouveau venu réinitialise le rang.
   */
  private chickenPlayerIndex: number | null = null;
  private chickenRank: number = 0;

  /**
   * Le pouvoir du Schmitt n'est pris qu'une fois par partie. Sa prise fait
   * basculer le jeu en phase de retour : on ne gagne qu'en revenant sur START.
   */
  private schmittPowerClaimed: boolean = false;

  /**
   * Règles inventées par les joueurs sur les cases « CRÉEZ UNE RÈGLE ».
   * Le jeu ne peut pas les appliquer — elles se jouent à la voix — mais il
   * les garde affichables pour que personne n'oublie une règle en cours de
   * soirée, ce qui est exactement ce qui arrive sans trace écrite.
   */
  private customRules: { author: string; text: string }[] = [];

  /**
   * Applique la case Poulet à un joueur et renvoie son nouveau rang.
   * 1 = Petit Poulet, 2 = Grand Poulet.
   */
  public setChicken(playerIndex: number): number {
    if (this.chickenPlayerIndex === playerIndex) {
      // Même joueur, sans interruption : il monte en grade
      this.chickenRank = Math.min(this.chickenRank + 1, 2);
    } else {
      // Un autre joueur prend la place : le rang repart de zéro
      this.chickenPlayerIndex = playerIndex;
      this.chickenRank = 1;
    }
    return this.chickenRank;
  }

  public getChickenPlayerIndex(): number | null {
    return this.chickenPlayerIndex;
  }

  public getChickenRank(): number {
    return this.chickenRank;
  }

  /**
   * Applique la sentence du Poulet sur un jet de dé.
   *
   * Règle officielle : à chaque 3 ou 6 de n'importe quel joueur, le Petit
   * Poulet boit 1 gorgée. S'il est devenu GROS POULET, il distribue au lieu
   * de boire — c'est tout l'intérêt de la promotion.
   *
   * Renvoie ce qui s'est passé, pour que l'interface l'annonce, ou null si
   * le jet ne déclenche rien.
   */
  public applyChickenPenalty(roll: number): {
    playerIndex: number;
    name: string;
    distributes: boolean;
  } | null {
    if (roll !== 3 && roll !== 6) return null;
    if (this.chickenPlayerIndex === null) return null;

    const chicken = this.players[this.chickenPlayerIndex];
    if (!chicken) return null;

    const distributes = this.chickenRank >= 2;
    if (!distributes) {
      chicken.drinks += 1;
      this.addToHistory(`\u{1F414} ${chicken.name} (Poulet) boit 1 gorgée sur un ${roll}`);
    } else {
      this.addToHistory(`\u{1F414} ${chicken.name} (GROS POULET) distribue 1 gorgée sur un ${roll}`);
    }

    return { playerIndex: this.chickenPlayerIndex, name: chicken.name, distributes };
  }

  /**
   * Enregistre une règle inventée par un joueur.
   * Le texte est nettoyé et tronqué : il finit affiché dans un bandeau.
   */
  public addCustomRule(author: string, text: string): void {
    const clean = text.trim().slice(0, 140);
    if (!clean) return;
    this.customRules.push({ author, text: clean });
    this.addToHistory(`\u{1F4DC} Nouvelle règle de ${author} : « ${clean} »`);
  }

  public getCustomRules(): { author: string; text: string }[] {
    return this.customRules.map(r => ({ ...r }));
  }

  /**
   * Ajoute un évènement à l'historique depuis l'extérieur (effets de case).
   * Les effets vivent dans la couche présentation, mais leur trace appartient
   * à la partie : sans cela, l'historique ne raconte que les lancers de dé.
   */
  public logEvent(message: string): void {
    this.addToHistory(message);
  }

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
    this.chickenPlayerIndex = null;
    this.chickenRank = 0;
    this.customRules = [];
    this.schmittPowerClaimed = false;

    this.players = playersConfig.map((config, index) => ({
      name: config.name,
      color: config.color,
      position: 0,
      index,
      hasSchmittPower: false,
      isReturning: false,
      hasLeftStartOnReturn: false,
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

    // La cible doit être atteinte par une valeur EXACTE : un jet trop grand
    // fait rebondir le pion du surplus. Auparavant on collait simplement le
    // pion sur la dernière case (Math.min), ce qui rendait l'arrivée
    // automatique et supprimait toute la tension de fin de parcours.
    if (player.isReturning) {
      // Phase 2 : retour vers START, on recule
      const target = player.position - steps;
      player.position = target < 0 ? Math.abs(target) : target;
    } else {
      // Phase 1 : aller vers la dernière case
      const target = player.position + steps;
      player.position =
        target > this.lastPosition ? this.lastPosition - (target - this.lastPosition) : target;
    }

    // Un rebond ne doit jamais sortir du plateau, même sur un petit parcours
    player.position = Math.max(0, Math.min(player.position, this.lastPosition));

    if (player.isReturning && player.position !== 0) {
      player.hasLeftStartOnReturn = true;
    }

    return player.position;
  }

  /**
   * Déplace un joueur dans un sens IMPOSÉ, sans tenir compte de son sens de
   * marche — c'est ce que fait une case flèche.
   *
   * La flèche est dessinée sur le plateau : elle envoie toujours du même
   * côté. Passer par `movePlayer` inversait son effet en phase de retour, et
   * le joueur ratait la case visée par la règle.
   *
   * Le rebond de `movePlayer` ne s'applique pas ici : une flèche ne fait pas
   * rebondir, elle pousse jusqu'au bord et s'arrête. Arriver sur FINISH par
   * une flèche donne donc bien le pouvoir du Schmitt.
   */
  public movePlayerInDirection(
    playerIndex: number,
    steps: number,
    direction: 'forward' | 'backward'
  ): number {
    const player = this.players[playerIndex];
    if (!player) return 0;

    const delta = direction === 'forward' ? steps : -steps;
    player.position = Math.max(0, Math.min(player.position + delta, this.lastPosition));

    if (player.isReturning && player.position !== 0) {
      player.hasLeftStartOnReturn = true;
    }

    return player.position;
  }

  /**
   * Donne le pouvoir du Schmitt au joueur et fait basculer la partie en
   * phase de retour : tous les pions font demi-tour vers START.
   *
   * Le pouvoir n'est attribué qu'une fois par partie — son porteur est le
   * seul de toute l'odyssée.
   */
  public claimSchmittPower(playerIndex: number): boolean {
    if (this.schmittPowerClaimed) return false;

    const player = this.players[playerIndex];
    if (!player) return false;

    this.schmittPowerClaimed = true;
    player.hasSchmittPower = true;
    // Un joueur encore sur START au moment du demi-tour gagnerait
    // instantanément : il doit d'abord quitter la case avant d'y revenir.
    this.players.forEach(p => {
      p.isReturning = true;
      p.hasLeftStartOnReturn = p.position !== 0;
    });

    this.addToHistory(`\u{26A1} ${player.name} s'empare du pouvoir du Schmitt ! Demi-tour !`);
    return true;
  }

  public isSchmittPowerClaimed(): boolean {
    return this.schmittPowerClaimed;
  }

  /** Indique si la partie est dans sa phase de retour vers START. */
  public isReturnPhase(): boolean {
    return this.schmittPowerClaimed;
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
    // On ne gagne pas en atteignant la dernière case : celle-ci ne donne que
    // le pouvoir du Schmitt. La victoire s'obtient en revenant exactement sur
    // START, une fois le demi-tour enclenché.
    if (!this.schmittPowerClaimed) return null;

    const winner = this.players.find(
      p => p.isReturning && p.position === 0 && p.hasLeftStartOnReturn
    );
    return winner || null;
  }

  /**
   * Reset le jeu
   */
  public reset(): void {
    this.players = [];
    this.chickenPlayerIndex = null;
    this.chickenRank = 0;
    this.customRules = [];
    this.schmittPowerClaimed = false;
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
