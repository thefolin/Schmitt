import { GameLogic } from '../features/game/game.logic';
import { GameRenderer } from '../features/game/game.renderer';
import { BoardRenderer } from '../features/board/2d/board.renderer';
import { TILE_CONFIGS } from '../features/tiles/tile.config';
import { assetManager } from '../core/assets/AssetManager';
import type { LayoutType } from '../features/board/board.layouts';
import '../styles/common/main.css';
import '../styles/common/mobile-optimized.css';

/**
 * Application principale - Architecture Features-Based
 * Sépare clairement logique métier et rendu visuel
 */
class SchmittOdyssee {
  // Logique métier
  private gameLogic: GameLogic;

  // Rendu visuel
  private gameRenderer: GameRenderer;
  private boardRenderer: BoardRenderer;

  constructor() {
    this.gameLogic = new GameLogic();
    this.gameRenderer = new GameRenderer();

    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    if (!canvas) throw new Error('Canvas non trouvé');

    this.boardRenderer = new BoardRenderer(canvas);

    this.init();
  }

  /**
   * Initialise l'application
   */
  private init(): void {
    // Charger les assets par défaut
    assetManager.loadDefaultAssets();

    // Configuration initiale
    this.setupEventListeners();
    this.generatePlayerInputs(4);
    this.gameRenderer.showSetupScreen();
  }

  /**
   * Configure les écouteurs d'événements
   */
  private setupEventListeners(): void {
    // Changement du nombre de joueurs
    const playerCountInput = document.getElementById('playerCount') as HTMLInputElement;
    playerCountInput?.addEventListener('change', () => {
      const count = parseInt(playerCountInput.value);
      this.generatePlayerInputs(count);
    });

    // Démarrer le jeu
    document.getElementById('startGameBtn')?.addEventListener('click', () => {
      this.startGame();
    });

    // Lancer le dé
    document.getElementById('rollDiceBtn')?.addEventListener('click', () => {
      this.rollDice();
    });

    // Nouvelle partie
    document.getElementById('resetBtn')?.addEventListener('click', () => {
      if (confirm('Êtes-vous sûr de vouloir quitter la partie en cours ?')) {
        this.resetGame();
      }
    });

    // Fermer les modales
    document.getElementById('effectModal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.gameRenderer.closeEffectModal();
      }
    });

    // Bouton fermer modale
    document.querySelector('.close-modal')?.addEventListener('click', () => {
      this.gameRenderer.closeEffectModal();
    });
  }

  /**
   * Génère les inputs de joueurs
   */
  private generatePlayerInputs(count: number): void {
    const container = document.getElementById('playerInputs');
    if (!container) return;

    container.innerHTML = '';

    const colors = [
      '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
      '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
      '#e91e63', '#00bcd4'
    ];

    for (let i = 0; i < count; i++) {
      const div = document.createElement('div');
      div.className = 'player-input-item';
      div.innerHTML = `
        <input type="text" placeholder="Joueur ${i + 1}" value="Joueur ${i + 1}" data-player-index="${i}">
        <input type="color" class="color-picker" value="${colors[i % colors.length]}" data-player-index="${i}">
      `;
      container.appendChild(div);
    }
  }

  /**
   * Démarre le jeu
   */
  private startGame(): void {
    const inputs = document.querySelectorAll('#playerInputs input[type="text"]') as NodeListOf<HTMLInputElement>;
    const colorInputs = document.querySelectorAll('#playerInputs input[type="color"]') as NodeListOf<HTMLInputElement>;

    const players: { name: string; color: string }[] = [];

    inputs.forEach((input, index) => {
      const name = input.value.trim() || `Joueur ${index + 1}`;
      const color = colorInputs[index].value;
      players.push({ name, color });
    });

    if (players.length < 2) {
      alert('Il faut au moins 2 joueurs pour commencer !');
      return;
    }

    // Logique métier
    this.gameLogic.startGame(players);

    // Rendu visuel
    this.gameRenderer.hideSetupScreen();
    this.updateUI();
  }

  /**
   * Lance le dé
   */
  private rollDice(): void {
    if (!this.gameLogic.isGameStarted()) return;

    const currentPlayer = this.gameLogic.getCurrentPlayer();
    if (!currentPlayer) return;

    // Désactiver le bouton pendant l'animation
    this.gameRenderer.setDiceButtonEnabled(false);

    // Logique métier : lancer le dé
    const roll = this.gameLogic.rollDice();

    // Rendu : afficher le résultat
    this.gameRenderer.showDiceResult(roll);

    // Animation : déplacement du joueur
    setTimeout(() => {
      this.moveCurrentPlayer(roll);
    }, 500);
  }

  /**
   * Déplace le joueur actuel
   */
  private moveCurrentPlayer(steps: number): void {
    const currentPlayer = this.gameLogic.getCurrentPlayer();
    if (!currentPlayer) return;

    // Logique métier : calculer la nouvelle position
    const newPosition = this.gameLogic.movePlayer(currentPlayer.index, steps);

    // Rendu : redessiner le plateau
    this.updateBoard();

    // Appliquer l'effet de la case
    setTimeout(() => {
      this.applyTileEffect(newPosition);
    }, 300);
  }

  /**
   * Applique l'effet d'une case
   */
  private applyTileEffect(position: number): void {
    const currentPlayer = this.gameLogic.getCurrentPlayer();
    if (!currentPlayer) return;

    const tile = TILE_CONFIGS[position];
    if (!tile) return;

    // Afficher la modale d'effet
    this.gameRenderer.showEffectModal(tile.icon, tile.name, tile.description || '');

    // Appliquer l'effet selon le type
    switch (tile.type) {
      case 'drink_2':
        this.gameLogic.addDrinks(currentPlayer.index, 2);
        break;
      case 'drink_3':
        this.gameLogic.addDrinks(currentPlayer.index, 3);
        break;
      case 'drink_4':
        this.gameLogic.addDrinks(currentPlayer.index, 4);
        break;
      case 'drink_5':
        this.gameLogic.addDrinks(currentPlayer.index, 5);
        break;
      case 'power':
        this.gameLogic.setSchmittPower(currentPlayer.index, true);
        this.gameRenderer.showNotification(`${currentPlayer.name} obtient le pouvoir Schmitt !`);
        break;
      case 'replay':
        currentPlayer.canReplay = true;
        this.gameRenderer.showNotification(`${currentPlayer.name} rejoue !`);
        break;
      case 'everyone_drinks':
        const players = this.gameLogic.getPlayers();
        players.forEach(p => this.gameLogic.addDrinks(p.index, 1));
        this.gameRenderer.showNotification('Tout le monde boit !');
        break;
      case 'finish':
        this.handleVictory();
        return;
    }

    // Vérifier victoire
    const winner = this.gameLogic.checkVictory();
    if (winner) {
      this.handleVictory();
      return;
    }

    // Passer au joueur suivant (après fermeture de la modale)
    setTimeout(() => {
      this.gameLogic.nextPlayer();
      this.updateUI();
      this.gameRenderer.setDiceButtonEnabled(true);
    }, 2000);
  }

  /**
   * Gère la victoire
   */
  private handleVictory(): void {
    const winner = this.gameLogic.checkVictory();
    if (winner) {
      this.gameRenderer.closeEffectModal();
      setTimeout(() => {
        this.gameRenderer.showVictoryScreen(winner);
      }, 500);
    }
  }

  /**
   * Reset le jeu
   */
  private resetGame(): void {
    this.gameLogic.reset();
    this.gameRenderer.showSetupScreen();
    this.generatePlayerInputs(4);
  }

  /**
   * Met à jour l'interface
   */
  private updateUI(): void {
    const players = this.gameLogic.getPlayers();
    const currentIndex = this.gameLogic.getCurrentPlayerIndex();
    const history = this.gameLogic.getHistory();

    this.gameRenderer.updatePlayerList(players, currentIndex);
    this.gameRenderer.updateHistory(history);
    this.updateBoard();
  }

  /**
   * Met à jour le plateau
   */
  private updateBoard(): void {
    const players = this.gameLogic.getPlayers();
    this.boardRenderer.render(TILE_CONFIGS, players);
  }

  /**
   * Change le layout du plateau (pour customisation future)
   */
  public changeLayout(layout: LayoutType): void {
    this.boardRenderer.setLayout(layout);
    this.updateBoard();
  }
}

// Démarrer l'application
document.addEventListener('DOMContentLoaded', () => {
  const app = new SchmittOdyssee();

  // Exposer l'app globalement pour debug/customisation
  (window as any).schmittApp = app;
});
