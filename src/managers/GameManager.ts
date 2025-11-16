import { PlayerModel, Player } from '@models/Player';
import { GameStateManager } from '@models/GameState';
import { TileType } from '@models/Tile';
import { BoardManager } from './BoardManager';
import { SoundManager } from './SoundManager';
import { UIManager } from './UIManager';
import { BOARD_SIZE, GOD_FAVORS } from '@utils/constants';
import { rollDice, sleep, createParticles } from '@utils/helpers';

/**
 * Gestionnaire principal du jeu
 * Orchestre toute la logique du jeu
 */
export class GameManager {
  private stateManager: GameStateManager;
  private boardManager: BoardManager;
  private soundManager: SoundManager;
  private uiManager: UIManager;

  constructor(
    canvas: HTMLCanvasElement,
    soundManager: SoundManager,
    uiManager: UIManager
  ) {
    this.stateManager = new GameStateManager();
    this.boardManager = new BoardManager(canvas);
    this.soundManager = soundManager;
    this.uiManager = uiManager;

    // Redimensionner le canvas
    window.addEventListener('resize', () => this.handleResize());
    this.handleResize();
  }

  /**
   * Charge les données des cases
   */
  async loadTileData(data: any): Promise<void> {
    await this.boardManager.loadTileData(data.tiles);
  }

  /**
   * Démarre une nouvelle partie
   */
  startGame(players: { name: string; color: string }[]): void {
    const state = this.stateManager.getState();

    // Créer les joueurs
    state.players = players.map(
      (p, index) => new PlayerModel(p.name, p.color, index)
    );

    this.stateManager.startGame();
    this.uiManager.showSetupScreen(false);
    this.uiManager.clearHistory();
    this.boardManager.resize();
    this.boardManager.drawBoard(state.players);
    this.updateUI();

    this.uiManager.showNotification(`${state.players[0].name} commence !`);
    this.soundManager.playEffect();

    const canvas = (this.boardManager as any).canvas;
    createParticles(canvas.width / 2, canvas.height / 2, '🎮');
  }

  /**
   * Lance le dé
   */
  async rollDice(): Promise<void> {
    const state = this.stateManager.getState();

    if (state.isRolling || state.waitingForEffect) {
      return;
    }

    state.isRolling = true;
    this.uiManager.setDiceButtonEnabled(false);
    this.soundManager.playDiceRoll();

    // Animation du dé
    for (let i = 0; i < 15; i++) {
      const randomValue = rollDice();
      this.uiManager.showDiceResult(randomValue);
      await sleep(100);
    }

    const finalValue = rollDice();
    this.uiManager.showDiceResult(finalValue);
    state.lastDiceValue = finalValue;
    state.totalMoves++;

    this.soundManager.playEffect();

    const currentPlayer = this.stateManager.getCurrentPlayer()!;
    this.stateManager.addToHistory(
      `🎲 ${currentPlayer.name} a fait ${finalValue}`
    );
    this.updateHistory();

    // Vérifier l'effet Petit Poulet
    if (
      state.chickenPlayer &&
      (finalValue === 3 || finalValue === 6) &&
      state.chickenPlayer !== currentPlayer
    ) {
      state.chickenPlayer.drinks += 1;
      this.uiManager.showNotification(
        `🐔 ${state.chickenPlayer.name} boit 1 gorgée !`
      );
      this.soundManager.playDrink();
      this.stateManager.addToHistory(
        `🐔 ${state.chickenPlayer.name} boit (Poulet)`
      );
      this.updateHistory();
    }

    await sleep(500);
    await this.movePlayer(finalValue);
  }

  /**
   * Déplace le joueur
   */
  private async movePlayer(steps: number): Promise<void> {
    const currentPlayer = this.stateManager.getCurrentPlayer()!;
    const state = this.stateManager.getState();

    for (let step = 0; step < steps; step++) {
      if (currentPlayer.isReturning) {
        currentPlayer.position--;
        if (currentPlayer.position < 0) {
          currentPlayer.position = Math.abs(currentPlayer.position);
        }
      } else {
        currentPlayer.position++;
        if (currentPlayer.position > BOARD_SIZE - 1) {
          const overflow = currentPlayer.position - (BOARD_SIZE - 1);
          currentPlayer.position = BOARD_SIZE - 1 - overflow;
        }
      }

      this.soundManager.playMove();
      this.boardManager.drawBoard(state.players);
      this.updateUI();
      await sleep(300);
    }

    // Vérifier si le joueur atteint le pouvoir du Schmitt
    if (
      !currentPlayer.isReturning &&
      currentPlayer.position === BOARD_SIZE - 1 &&
      !currentPlayer.hasSchmittPower
    ) {
      currentPlayer.hasSchmittPower = true;
      currentPlayer.isReturning = true;
      this.uiManager.showNotification(
        `${currentPlayer.name} a le Pouvoir du Schmitt ! 👑 Tout le monde repart en arrière !`
      );
      this.soundManager.playWin();

      const canvas = (this.boardManager as any).canvas;
      createParticles(canvas.width / 2, canvas.height / 2, '👑');

      this.stateManager.addToHistory(
        `👑 ${currentPlayer.name} obtient le Pouvoir du Schmitt !`
      );
      this.updateHistory();

      // Tous les joueurs retournent
      state.players.forEach(p => {
        p.isReturning = true;
      });
    }

    // Vérifier la victoire
    if (currentPlayer.isReturning && currentPlayer.position === 0) {
      this.handleVictory(currentPlayer);
      return;
    }

    await sleep(200);
    await this.applyTileEffect();
  }

  /**
   * Applique l'effet de la case
   */
  private async applyTileEffect(): Promise<void> {
    const currentPlayer = this.stateManager.getCurrentPlayer()!;
    const state = this.stateManager.getState();
    const tile = this.boardManager.getTile(currentPlayer.position);

    if (!tile || tile.type === TileType.START || tile.type === TileType.POWER) {
      this.nextPlayer();
      return;
    }

    state.waitingForEffect = true;

    switch (tile.type) {
      case TileType.DRINK_2:
      case TileType.DRINK_3:
      case TileType.DRINK_4:
        await this.handleDrink(tile.type);
        break;
      case TileType.DISTRIBUTE_2:
      case TileType.DISTRIBUTE_3:
      case TileType.DISTRIBUTE_4:
        await this.handleDistribute(tile.type);
        break;
      case TileType.EVERYONE_DRINKS:
        await this.handleEveryoneDrinks();
        break;
      case TileType.MOVE_FORWARD_2:
        await this.handleMoveForward();
        break;
      case TileType.CHICKEN:
        await this.handleChicken();
        break;
      case TileType.COPY:
        await this.handleCopy();
        break;
      case TileType.RULE:
        await this.handleRule();
        break;
      case TileType.SCHMITT_CALL:
        await this.handleSchmittCall();
        break;
      case TileType.TEMPLE:
        await this.handleTemple();
        break;
      default:
        this.nextPlayer();
    }
  }

  /**
   * Gère l'effet "Boire N gorgées"
   */
  private async handleDrink(type: TileType): Promise<void> {
    const drinks =
      type === TileType.DRINK_2 ? 2 : type === TileType.DRINK_3 ? 3 : 4;
    const currentPlayer = this.stateManager.getCurrentPlayer()!;

    currentPlayer.drinks += drinks;
    this.soundManager.playDrink();
    this.stateManager.addToHistory(
      `🍺 ${currentPlayer.name} boit ${drinks} gorgées`
    );
    this.updateHistory();
    this.updateUI();

    this.uiManager.showEffectModal(
      '🍺',
      'Buvez !',
      `${currentPlayer.name} boit ${drinks} gorgées de liquide !`,
      () => this.nextPlayer()
    );
  }

  /**
   * Gère l'effet "Distribuer N gorgées"
   */
  private async handleDistribute(type: TileType): Promise<void> {
    const drinks =
      type === TileType.DISTRIBUTE_2
        ? 2
        : type === TileType.DISTRIBUTE_3
        ? 3
        : 4;
    const currentPlayer = this.stateManager.getCurrentPlayer()!;
    const state = this.stateManager.getState();

    this.soundManager.playEffect();

    this.uiManager.showEffectModal(
      '🎁',
      'Distribuez !',
      `${currentPlayer.name}, distribuez ${drinks} gorgées à d'autres joueurs.`
    );

    this.uiManager.showPlayerSelector(
      state.players,
      drinks,
      false,
      currentPlayer,
      selectedPlayers => {
        selectedPlayers.forEach(p => {
          p.drinks += 1;
          this.soundManager.playDrink();
        });
        const names = selectedPlayers.map(p => p.name).join(', ');
        this.uiManager.showNotification(`${names} boivent !`);
        this.stateManager.addToHistory(
          `🎁 ${currentPlayer.name} distribue à ${names}`
        );
        this.updateHistory();
        this.updateUI();
        this.nextPlayer();
      }
    );
  }

  /**
   * Gère l'effet "Tournée générale"
   */
  private async handleEveryoneDrinks(): Promise<void> {
    const state = this.stateManager.getState();
    state.players.forEach(p => (p.drinks += 1));
    this.soundManager.playDrink();
    this.stateManager.addToHistory(`🍻 Tournée générale !`);
    this.updateHistory();
    this.updateUI();

    this.uiManager.showEffectModal(
      '🍻',
      'Tournée générale !',
      'Tous les joueurs reçoivent 1 gorgée !',
      () => this.nextPlayer()
    );
  }

  /**
   * Gère l'effet "Avancer de 2 cases"
   */
  private async handleMoveForward(): Promise<void> {
    const currentPlayer = this.stateManager.getCurrentPlayer()!;
    this.soundManager.playEffect();

    this.uiManager.showEffectModal(
      '⬆️',
      'Avancez !',
      `${currentPlayer.name} avance de 2 cases supplémentaires !`,
      async () => {
        currentPlayer.position += 2;
        if (currentPlayer.position >= BOARD_SIZE - 1) {
          currentPlayer.position = BOARD_SIZE - 1;
        }
        this.boardManager.drawBoard(this.stateManager.getState().players);
        this.stateManager.addToHistory(
          `⬆️ ${currentPlayer.name} avance de +2 cases`
        );
        this.updateHistory();

        await sleep(500);
        await this.applyTileEffect();
      }
    );
  }

  /**
   * Gère l'effet "Petit Poulet"
   */
  private async handleChicken(): Promise<void> {
    const currentPlayer = this.stateManager.getCurrentPlayer()!;
    const state = this.stateManager.getState();
    this.soundManager.playEffect();

    if (state.chickenPlayer === currentPlayer) {
      state.chickenPlayer = null;
      this.stateManager.addToHistory(
        `🐓 ${currentPlayer.name} devient GROS POULET`
      );
      this.updateHistory();
      this.uiManager.showEffectModal(
        '🐓',
        'GROS POULET !',
        `${currentPlayer.name} devient le GROS POULET et distribue les gorgées au lieu de les boire !`,
        () => this.nextPlayer()
      );
    } else {
      state.chickenPlayer = currentPlayer;
      this.stateManager.addToHistory(
        `🐔 ${currentPlayer.name} devient Petit Poulet`
      );
      this.updateHistory();
      this.uiManager.showEffectModal(
        '🐔',
        'Petit Poulet !',
        `${currentPlayer.name} devient le Petit Poulet ! À chaque 3 ou 6, il boit 1 gorgée.`,
        () => this.nextPlayer()
      );
    }
  }

  /**
   * Gère l'effet "Copier une case"
   */
  private async handleCopy(): Promise<void> {
    const currentPlayer = this.stateManager.getCurrentPlayer()!;
    const state = this.stateManager.getState();

    this.uiManager.showEffectModal(
      '🐑',
      'Copiez une case !',
      `${currentPlayer.name}, choisissez un adversaire et copiez sa case.`
    );

    this.uiManager.showPlayerSelector(
      state.players,
      1,
      false,
      currentPlayer,
      async selectedPlayers => {
        const target = selectedPlayers[0];
        const targetTile = this.boardManager.getTile(target.position);

        this.uiManager.showNotification(
          `${currentPlayer.name} copie la case de ${target.name} !`
        );

        if (targetTile?.type === TileType.COPY) {
          const temp = currentPlayer.position;
          currentPlayer.position = target.position;
          target.position = temp;
          this.uiManager.showNotification(`Échange de position !`);
          this.boardManager.drawBoard(state.players);
          await sleep(1500);
          this.nextPlayer();
        } else if (targetTile) {
          await sleep(1000);
          // Appliquer l'effet de la case copiée
          // Pour simplifier, on passe au joueur suivant
          this.nextPlayer();
        }
      }
    );
  }

  /**
   * Gère l'effet "Créer une règle"
   */
  private async handleRule(): Promise<void> {
    const currentPlayer = this.stateManager.getCurrentPlayer()!;
    this.soundManager.playEffect();

    this.uiManager.showEffectModal(
      '📜',
      'Inventez une règle !',
      `${currentPlayer.name}, inventez une règle qui durera jusqu'à la fin de la partie.`
    );

    this.uiManager.showRuleInput(rule => {
      this.stateManager.addCustomRule(currentPlayer.name, rule);
      this.uiManager.showNotification(`Nouvelle règle : ${rule}`);
      this.stateManager.addToHistory(`📜 Règle : ${rule}`);
      this.updateHistory();
      this.nextPlayer();
    });
  }

  /**
   * Gère l'effet "SCHMITT !!!"
   */
  private async handleSchmittCall(): Promise<void> {
    const currentPlayer = this.stateManager.getCurrentPlayer()!;
    const state = this.stateManager.getState();
    this.soundManager.playEffect();
    this.stateManager.addToHistory(
      `⚡ ${currentPlayer.name} tombe sur SCHMITT !`
    );
    this.updateHistory();

    this.uiManager.showEffectModal(
      '⚡',
      'SCHMITT !',
      'Le dernier à crier "SCHMITT !" et placer son pouce sur son front reçoit des gorgées !'
    );

    const playersOnTile = state.players.filter(
      p => p.position === currentPlayer.position
    );
    const sipsCount = playersOnTile.length;

    this.uiManager.showPlayerSelector(
      state.players,
      1,
      true,
      currentPlayer,
      selectedPlayers => {
        const loser = selectedPlayers[0];
        loser.drinks += sipsCount;
        this.soundManager.playDrink();
        this.uiManager.showNotification(
          `${loser.name} boit ${sipsCount} gorgée(s) !`
        );
        this.stateManager.addToHistory(
          `⚡ ${loser.name} perd au SCHMITT (${sipsCount} gorgées)`
        );
        this.updateHistory();
        this.updateUI();
        this.nextPlayer();
      }
    );
  }

  /**
   * Gère l'effet "Faveur des Dieux"
   */
  private async handleTemple(): Promise<void> {
    const currentPlayer = this.stateManager.getCurrentPlayer()!;
    this.soundManager.playTemple();

    this.uiManager.showEffectModal(
      '🏛️',
      'Faveur des Dieux !',
      `${currentPlayer.name} lance 2 dés pour obtenir une faveur divine...`,
      async () => {
        const dice1 = rollDice();
        const dice2 = rollDice();

        if (dice1 === dice2) {
          currentPlayer.drinks += 3;
          this.soundManager.playDrink();
          this.uiManager.showNotification(
            `⚡ COLÈRE DES DIEUX ! ${currentPlayer.name} boit 3 gorgées !`
          );
          this.stateManager.addToHistory(
            `💀 ${currentPlayer.name} subit la Colère des Dieux`
          );
          this.updateHistory();
          await sleep(2000);
          this.nextPlayer();
        } else {
          const sum = dice1 + dice2;
          this.stateManager.addToHistory(
            `🏛️ ${currentPlayer.name} obtient une faveur divine (${sum})`
          );
          this.updateHistory();
          await this.applyGodFavor(sum);
        }
      }
    );
  }

  /**
   * Applique une faveur des dieux
   */
  private async applyGodFavor(sum: number): Promise<void> {
    const currentPlayer = this.stateManager.getCurrentPlayer()!;
    const state = this.stateManager.getState();
    const favor = GOD_FAVORS[sum as keyof typeof GOD_FAVORS];

    this.uiManager.showEffectModal(
      favor.icon,
      favor.god,
      favor.effect,
      async () => {
        // Logique simplifiée - dans un vrai jeu, chaque faveur aurait sa logique
        switch (sum) {
          case 2: // Athéna - Bouclier
            currentPlayer.hasAthenaShield = true;
            this.uiManager.showNotification(
              `${currentPlayer.name} a le bouclier d'Athéna !`
            );
            break;
          case 5: // Apollon - Rejouer
            this.uiManager.showNotification(`${currentPlayer.name} rejoue !`);
            state.currentPlayerIndex =
              (state.currentPlayerIndex - 1 + state.players.length) %
              state.players.length;
            break;
          case 7: // Dionysos - Tous boivent
            state.players.forEach(p => (p.drinks += 2));
            this.uiManager.showNotification(
              `Tous boivent avec ${currentPlayer.name} !`
            );
            break;
          case 12: // Colère
            currentPlayer.drinks += 3;
            this.uiManager.showNotification(
              `${currentPlayer.name} boit 3 gorgées !`
            );
            break;
        }
        await sleep(2000);
        this.nextPlayer();
      }
    );
  }

  /**
   * Passe au joueur suivant
   */
  private nextPlayer(): void {
    this.stateManager.nextPlayer();
    this.updateUI();
    this.uiManager.setDiceButtonEnabled(true);

    const currentPlayer = this.stateManager.getCurrentPlayer()!;
    this.uiManager.showNotification(`Au tour de ${currentPlayer.name} !`);
  }

  /**
   * Gère la victoire
   */
  private handleVictory(player: Player): void {
    const state = this.stateManager.getState();
    this.soundManager.playWin();

    const duration = Date.now() - (state.startTime || Date.now());
    const totalDrinks = state.players.reduce((sum, p) => sum + p.drinks, 0);

    this.uiManager.showVictoryScreen(
      player.name,
      duration,
      state.totalMoves,
      totalDrinks
    );

    // Feux d'artifice
    for (let i = 0; i < 20; i++) {
      setTimeout(() => {
        createParticles(
          Math.random() * window.innerWidth,
          (Math.random() * window.innerHeight) / 2,
          ['🎉', '🎊', '⭐', '✨'][Math.floor(Math.random() * 4)]
        );
      }, i * 100);
    }
  }

  /**
   * Met à jour l'UI
   */
  private updateUI(): void {
    const state = this.stateManager.getState();
    this.uiManager.updatePlayerList(
      state.players,
      state.currentPlayerIndex
    );
  }

  /**
   * Met à jour l'historique
   */
  private updateHistory(): void {
    const state = this.stateManager.getState();
    if (state.history.length > 0) {
      this.uiManager.addToHistory(state.history[0]);
    }
  }

  /**
   * Gère le redimensionnement
   */
  private handleResize(): void {
    this.boardManager.resize();
    const state = this.stateManager.getState();
    if (state.players.length > 0) {
      this.boardManager.drawBoard(state.players);
    }
  }

  /**
   * Réinitialise le jeu
   */
  reset(): void {
    this.stateManager.reset();
    this.uiManager.showDiceResult('🎲');
    this.uiManager.setDiceButtonEnabled(false);
    this.uiManager.clearHistory();
    this.uiManager.hideVictoryScreen();
    this.uiManager.showSetupScreen(true);
    this.boardManager.resize();
  }
}
