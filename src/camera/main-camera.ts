import { GameLogic } from '../features/game/game.logic';
import { GameRenderer } from '../features/game/game.renderer';
import { BoardCameraRenderer } from '../features/board/camera/board.renderer.camera';
import { TILE_CONFIGS } from '../features/tiles/tile.config';
import { assetManager } from '../core/assets/AssetManager';
import type { BoardLayoutConfig } from '../features/board/camera/board-layout.config';
import '../styles/common/main.css';
import '../styles/common/mobile-optimized.css';
import '../styles/camera/board-camera.css';

interface SavedLayout {
  name: string;
  timestamp: number;
  config: BoardLayoutConfig;
}

/**
 * Application principale - Version Caméra
 * Vue 3/4 avec navigation pan/zoom
 */
class SchmittOdysseeCamera {
  private gameLogic: GameLogic;
  private gameRenderer: GameRenderer;
  private boardRenderer: BoardCameraRenderer;
  private savedLayouts: SavedLayout[] = [];
  private selectedLayout: BoardLayoutConfig | null = null;
  private importedLayout: BoardLayoutConfig | null = null;

  constructor() {
    this.gameLogic = new GameLogic();
    this.gameRenderer = new GameRenderer();
    this.boardRenderer = new BoardCameraRenderer('boardCamera');

    this.init();
  }

  private init(): void {
    assetManager.loadDefaultAssets();
    this.loadSavedLayouts();
    this.populateMapSelect();
    this.setupEventListeners();
    this.generatePlayerInputs(4);
    this.gameRenderer.showSetupScreen();
  }

  /**
   * Charge les layouts sauvegardés depuis localStorage
   */
  private loadSavedLayouts(): void {
    const data = localStorage.getItem('schmitt-board-layouts');
    if (data) {
      try {
        this.savedLayouts = JSON.parse(data);
      } catch {
        this.savedLayouts = [];
      }
    }
  }

  /**
   * Remplit le sélecteur de map avec les layouts disponibles
   */
  private populateMapSelect(): void {
    const select = document.getElementById('mapSelect') as HTMLSelectElement;
    if (!select) return;

    // Garder l'option par défaut
    select.innerHTML = '<option value="default">Plateau par défaut</option>';

    // Ajouter les layouts sauvegardés
    this.savedLayouts.forEach((layout, index) => {
      const option = document.createElement('option');
      option.value = `saved-${index}`;
      option.textContent = `${layout.name} (${layout.config.placements.length} cases)`;
      select.appendChild(option);
    });

    // Option pour l'import
    if (this.importedLayout) {
      const option = document.createElement('option');
      option.value = 'imported';
      option.textContent = 'Layout importé';
      option.selected = true;
      select.appendChild(option);
    }
  }

  private setupEventListeners(): void {
    // Changement du nombre de joueurs
    const playerCountInput = document.getElementById('playerCount') as HTMLInputElement;
    playerCountInput?.addEventListener('change', () => {
      const count = parseInt(playerCountInput.value);
      this.generatePlayerInputs(count);
    });

    // Sélection de la map
    const mapSelect = document.getElementById('mapSelect') as HTMLSelectElement;
    mapSelect?.addEventListener('change', () => {
      this.onMapSelected(mapSelect.value);
    });

    // Import de map JSON
    document.getElementById('importMapBtn')?.addEventListener('click', () => {
      this.importMapJson();
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

    document.querySelector('.close-modal')?.addEventListener('click', () => {
      this.gameRenderer.closeEffectModal();
    });
  }

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
   * Gère la sélection d'une map dans le dropdown
   */
  private onMapSelected(value: string): void {
    if (value === 'default') {
      this.selectedLayout = null;
    } else if (value === 'imported' && this.importedLayout) {
      this.selectedLayout = this.importedLayout;
    } else if (value.startsWith('saved-')) {
      const index = parseInt(value.replace('saved-', ''));
      const layout = this.savedLayouts[index];
      if (layout) {
        this.selectedLayout = layout.config;
      }
    }
  }

  /**
   * Importe un fichier JSON de layout
   */
  private importMapJson(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const config = JSON.parse(text) as BoardLayoutConfig;

        // Validation basique
        if (!config.placements || !Array.isArray(config.placements)) {
          throw new Error('Format de fichier invalide');
        }

        this.importedLayout = config;
        this.selectedLayout = config;
        this.populateMapSelect();

        // Sélectionner l'option importée
        const select = document.getElementById('mapSelect') as HTMLSelectElement;
        if (select) {
          select.value = 'imported';
        }

        this.gameRenderer.showNotification(`Layout "${file.name}" importé avec succès !`);
      } catch (error) {
        alert(`Erreur d'importation: ${(error as Error).message}`);
      }
    };

    input.click();
  }

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

    // Appliquer le layout sélectionné
    if (this.selectedLayout) {
      this.boardRenderer.setLayout(this.selectedLayout);
    }

    this.gameLogic.startGame(players);
    this.gameRenderer.hideSetupScreen();
    this.updateUI();
  }

  private rollDice(): void {
    if (!this.gameLogic.isGameStarted()) return;

    const currentPlayer = this.gameLogic.getCurrentPlayer();
    if (!currentPlayer) return;

    this.gameRenderer.setDiceButtonEnabled(false);

    const roll = this.gameLogic.rollDice();
    this.gameRenderer.showDiceResult(roll);

    setTimeout(() => {
      this.moveCurrentPlayer(roll);
    }, 800);
  }

  private async moveCurrentPlayer(steps: number): Promise<void> {
    const currentPlayer = this.gameLogic.getCurrentPlayer();
    if (!currentPlayer) return;

    const oldPosition = currentPlayer.position;
    const newPosition = this.gameLogic.movePlayer(currentPlayer.index, steps);

    // Animation avec suivi caméra
    await this.boardRenderer.animatePawnMove(currentPlayer.index, oldPosition, newPosition);
    this.updateBoard();

    setTimeout(() => {
      this.applyTileEffect(newPosition);
    }, 300);
  }

  private applyTileEffect(position: number): void {
    const currentPlayer = this.gameLogic.getCurrentPlayer();
    if (!currentPlayer) return;

    const tile = TILE_CONFIGS[position];
    if (!tile) return;

    this.gameRenderer.showEffectModal(tile.icon, tile.name, tile.description || '');

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

    const winner = this.gameLogic.checkVictory();
    if (winner) {
      this.handleVictory();
      return;
    }

    setTimeout(() => {
      this.gameLogic.nextPlayer();
      this.updateUI();
      this.gameRenderer.setDiceButtonEnabled(true);

      // Centrer la caméra sur le nouveau joueur
      const newCurrentPlayer = this.gameLogic.getCurrentPlayer();
      if (newCurrentPlayer) {
        this.boardRenderer.focusOnPlayer(newCurrentPlayer.index, this.gameLogic.getPlayers());
      }
    }, 2000);
  }

  private handleVictory(): void {
    const winner = this.gameLogic.checkVictory();
    if (winner) {
      this.gameRenderer.closeEffectModal();
      setTimeout(() => {
        this.gameRenderer.showVictoryScreen(winner);
      }, 500);
    }
  }

  private resetGame(): void {
    this.gameLogic.reset();
    this.boardRenderer.destroy();
    this.gameRenderer.showSetupScreen();
    this.generatePlayerInputs(4);
  }

  private updateUI(): void {
    const players = this.gameLogic.getPlayers();
    const currentIndex = this.gameLogic.getCurrentPlayerIndex();
    const history = this.gameLogic.getHistory();

    this.gameRenderer.updatePlayerList(players, currentIndex);
    this.gameRenderer.updateHistory(history);
    this.updateBoard();
  }

  private updateBoard(): void {
    const players = this.gameLogic.getPlayers();
    this.boardRenderer.render(TILE_CONFIGS, players);
  }
}

// Démarrer l'application
document.addEventListener('DOMContentLoaded', () => {
  const app = new SchmittOdysseeCamera();
  (window as any).schmittApp = app;
});
