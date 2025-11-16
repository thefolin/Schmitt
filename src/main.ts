import { GameManager } from '@managers/GameManager';
import { SoundManager } from '@managers/SoundManager';
import { UIManager } from '@managers/UIManager';
import './styles/main.css';

/**
 * Point d'entrée principal de l'application
 */
class App {
  private gameManager: GameManager | null = null;
  private soundManager: SoundManager;
  private uiManager: UIManager;

  constructor() {
    this.soundManager = new SoundManager();
    this.uiManager = new UIManager();
    this.init();
  }

  /**
   * Initialise l'application
   */
  private init(): void {
    // Récupérer le canvas
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    if (!canvas) {
      console.error('Canvas non trouvé !');
      return;
    }

    // Créer le game manager
    this.gameManager = new GameManager(canvas, this.soundManager, this.uiManager);

    // Charger les données du jeu
    this.loadGameData();

    // Configurer les écouteurs d'événements
    this.setupEventListeners();

    // Initialiser l'audio au premier clic
    document.body.addEventListener('click', () => {
      this.soundManager.setEnabled(true);
    }, { once: true });

    // Générer les inputs de joueurs par défaut
    this.generatePlayerInputs(4);
  }

  /**
   * Charge les données du jeu (cases, etc.)
   */
  private async loadGameData(): Promise<void> {
    try {
      const response = await fetch('/data/power.json');
      const data = await response.json();
      await this.gameManager?.loadTileData(data);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    }
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

    // Bouton démarrer le jeu
    const startGameBtn = document.getElementById('startGameBtn');
    startGameBtn?.addEventListener('click', () => this.startGame());

    // Bouton lancer le dé
    const rollDiceBtn = document.getElementById('rollDiceBtn');
    rollDiceBtn?.addEventListener('click', () => {
      this.gameManager?.rollDice();
    });

    // Bouton nouvelle partie
    const resetBtn = document.getElementById('resetBtn');
    resetBtn?.addEventListener('click', () => {
      if (confirm('Êtes-vous sûr de vouloir quitter la partie en cours ?')) {
        this.gameManager?.reset();
        this.generatePlayerInputs(4);
      }
    });

    // Bouton son
    const soundToggle = document.getElementById('soundToggle');
    soundToggle?.addEventListener('click', () => {
      const isEnabled = this.soundManager.isEnabled();
      this.soundManager.setEnabled(!isEnabled);
      soundToggle.textContent = isEnabled ? '🔇' : '🔊';
      if (!isEnabled) {
        this.soundManager.playEffect();
      }
    });

    // Fermer les modales en cliquant à l'extérieur
    const effectModal = document.getElementById('effectModal');
    effectModal?.addEventListener('click', (e) => {
      if (e.target === effectModal) {
        this.uiManager.closeEffectModal();
      }
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

    this.gameManager?.startGame(players);
  }
}

// Démarrer l'application quand le DOM est prêt
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
