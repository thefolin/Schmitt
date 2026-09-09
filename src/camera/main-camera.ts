import { GameLogic } from '../features/game/game.logic';
import { GameRenderer } from '../features/game/game.renderer';
import { BoardCameraRenderer } from '../features/board/camera/board.renderer.camera';
import { TILE_CONFIGS } from '../features/tiles/tile.config';
import { assetManager } from '../core/assets/AssetManager';
import type { BoardLayoutConfig } from '../features/board/camera/board-layout.config';
import type { TileType } from '@/core/models/Tile';
import type { Player } from '@/core/models/Player';
import { DiceManager } from '../features/dice';
import { PlayerSelector } from '../features/game/player-selector';
import { ManualMovement } from '../features/game/manual-movement';
import { GOD_FAVORS, findNeighbors as findPlayerNeighbors } from '../features/game/god-favors';
import '../styles/common/main.css';
import '../styles/common/mobile-optimized.css';
import '../styles/camera/board-camera.css';
import '../styles/game/player-selector.css';
import '../styles/game/manual-movement.css';

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
  private diceManager: DiceManager;
  private playerSelector: PlayerSelector;
  private manualMovement: ManualMovement;
  private savedLayouts: SavedLayout[] = [];
  private selectedLayout: BoardLayoutConfig | null = null;
  private importedLayout: BoardLayoutConfig | null = null;
  private consecutiveForwardMoves = 0; // Compteur pour éviter les boucles infinies
  private diceResults: { normal: number | null; godPower: number | null } = { normal: null, godPower: null };
  private isRollingForGodPower = false; // Flag pour savoir si on lance pour une faveur des dieux
  // Callback en attente lié au modal d'effet affiché (déclenché par timer OU par le bouton OK)
  private pendingModalAction: { timeoutId: number; callback: () => void } | null = null;
  // Choix retenu pour toute la partie quand Aphrodite tombe avec un seul
  // adversaire disponible (partie à 2 joueurs) : demandé une seule fois.
  private aphroditeSoloMode: 'both-dice' | 'reroll' | null = null;

  constructor() {
    this.gameLogic = new GameLogic();
    this.gameRenderer = new GameRenderer();
    this.boardRenderer = new BoardCameraRenderer('boardCamera');
    this.diceManager = new DiceManager('boardCamera');
    this.playerSelector = new PlayerSelector();
    this.manualMovement = new ManualMovement();

    this.init();
  }

  private async init(): Promise<void> {
    assetManager.loadDefaultAssets();
    this.loadSavedLayouts();

    // Charger test.json par défaut
    await this.loadTestLayout();

    this.populateMapSelect();
    this.setupEventListeners();
    this.generatePlayerInputs(4);
    this.gameRenderer.showSetupScreen();
  }

  /**
   * Charge le layout schmitt.json par défaut
   */
  private async loadTestLayout(): Promise<void> {
    try {
      const response = await fetch('/assets/schmitt.json');
      if (response.ok) {
        const testLayout = await response.json();
        this.selectedLayout = testLayout;
        console.log('Layout schmitt.json chargé par défaut');
      }
    } catch (error) {
      console.warn('Impossible de charger schmitt.json, utilisation du layout par défaut', error);
    }
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

    document.getElementById('effectOkBtn')?.addEventListener('click', () => {
      this.gameRenderer.closeEffectModal();
      // Si une action est programmée après ce modal, la déclencher tout de suite
      // au lieu de laisser le joueur attendre le délai automatique
      if (this.pendingModalAction) {
        clearTimeout(this.pendingModalAction.timeoutId);
        const callback = this.pendingModalAction.callback;
        this.pendingModalAction = null;
        callback();
      }
    });

    document.querySelector('.close-modal')?.addEventListener('click', () => {
      this.gameRenderer.closeEffectModal();
    });

    // Toggle sidebar
    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      sidebar?.classList.toggle('collapsed');
    });

    // Bouton déplacement manuel
    document.getElementById('manualMoveBtn')?.addEventListener('click', () => {
      this.openManualMovementModal();
    });

    // Contrôles de caméra
    document.querySelectorAll('.camera-control-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const action = target.dataset.action;

        switch (action) {
          case 'zoom-in':
            this.boardRenderer.getCamera().zoomBy(1.2);
            break;
          case 'zoom-out':
            this.boardRenderer.getCamera().zoomBy(0.8);
            break;
          case 'focus-dice':
            this.boardRenderer.focusOnDice(this.diceManager.getVisibleDicePosition());
            break;
          case 'reset':
            this.boardRenderer.getCamera().setZoom(1);
            this.boardRenderer.getCamera().centerOn(0, 0, true);
            break;
        }
      });
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

    // Afficher le dé et le positionner au centre de la table
    this.diceManager.showNormalDice();

    // Configurer les limites de la table pour la détection de chute
    const tableBounds = this.boardRenderer.getTableBounds();
    const tableConfig = this.boardRenderer.getTableConfig();
    if (tableBounds && tableConfig) {
      this.diceManager.setTableBounds(tableBounds, tableConfig.borders);
      // Positionner le dé au centre de la table
      this.diceManager.positionDiceInTable(tableBounds);
    }

    // Gérer la chute du dé
    this.diceManager.setOnDiceFall((event) => {
      this.handleDiceFall(event.diceType);
    });

    // Gérer la fin du lancer de dé (quand il s'arrête)
    this.diceManager.setOnDiceRollEnd((result, diceType) => {
      this.handleDiceRollEnd(result, diceType);
    });
  }

  private async rollDice(): Promise<void> {
    if (!this.gameLogic.isGameStarted()) return;

    const currentPlayer = this.gameLogic.getCurrentPlayer();
    if (!currentPlayer) return;

    // Vérifier si un dé est déjà en train de rouler
    if (this.diceManager.isAnyDiceRolling()) {
      console.log('Un dé est déjà en train de rouler');
      return;
    }

    this.gameRenderer.setDiceButtonEnabled(false);

    // Réinitialiser l'état de chute avant le nouveau lancer
    this.diceManager.resetDiceFall();

    // Réinitialiser les résultats des dés
    this.diceResults = { normal: null, godPower: null };

    // Centrer la caméra sur le joueur actuel au lancer de dé
    this.boardRenderer.centerOnPlayer(currentPlayer.index, this.gameLogic.getPlayers());

    // Si on est en train d'attendre le lancer pour une faveur des dieux,
    // ce clic doit lancer les 2 dés de faveur (et non un tour normal)
    if (this.isRollingForGodPower) {
      void this.diceManager.rollBothDice();
      return;
    }

    // Réinitialiser le compteur de déplacements consécutifs au début du tour
    this.consecutiveForwardMoves = 0;

    // Si le joueur a le pouvoir Schmitt, lancer les deux dés
    if (currentPlayer.hasSchmittPower) {
      this.gameRenderer.showNotification(`✨ Pouvoir Schmitt activé !`);
      // rollBothDice() déclenche l'animation ; le résultat arrive via le
      // callback onDiceRollEnd (déjà branché), qui gère la suite normalement.
      void this.diceManager.rollBothDice();
    } else {
      void this.diceManager.rollNormalDice();
    }

    // Le dé peut aussi être glissé manuellement pendant l'animation ou après
    // un arrêt anormal (chute) ; le callback onDiceRollEnd gère les deux cas.
  }

  /**
   * Gère la fin du lancer de dé (quand il s'arrête)
   */
  private handleDiceRollEnd(result: number, diceType: 'normal' | 'godPower'): void {
    const currentPlayer = this.gameLogic.getCurrentPlayer();
    if (!currentPlayer) return;

    console.log(`🎲 Le dé ${diceType} s'est arrêté sur ${result}`);

    // Enregistrer le résultat
    if (diceType === 'normal') {
      this.diceResults.normal = result;
    } else {
      this.diceResults.godPower = result;
    }

    // Si on est en mode "faveur des dieux"
    if (this.isRollingForGodPower) {
      if (this.diceResults.normal !== null && this.diceResults.godPower !== null) {
        // Les deux dés se sont arrêtés, calculer la somme
        const sum = this.diceResults.normal + this.diceResults.godPower;
        const isDouble = this.diceResults.normal === this.diceResults.godPower;

        console.log(`⚡ Résultat faveur: ${this.diceResults.normal} + ${this.diceResults.godPower} = ${sum} (double: ${isDouble})`);

        // Réinitialiser le flag
        this.isRollingForGodPower = false;

        // Cacher les dés
        setTimeout(() => {
          this.diceManager.hideAll();

          if (isDouble) {
            // COLÈRE DES DIEUX ! (double)
            this.gameRenderer.showNotification(`❌ COLÈRE DES DIEUX ! ${currentPlayer.name} fait un double et reçoit 1 cul sec !`);
            this.gameLogic.addDrinks(currentPlayer.index, 1);

            // Passer au joueur suivant après 3 secondes
            setTimeout(() => {
              this.prepareNextPlayerTurn();
            }, 3000);
          } else {
            // Afficher la faveur obtenue selon la somme
            this.showGodFavorResult(sum);
          }
        }, 1000);
      }
      return;
    }

    // Si le joueur a le pouvoir Schmitt (déplacement normal avec 2 dés), attendre que les deux dés soient lancés
    if (currentPlayer.hasSchmittPower) {
      if (this.diceResults.normal !== null && this.diceResults.godPower !== null) {
        // Les deux dés se sont arrêtés
        const total = this.diceResults.normal + this.diceResults.godPower;
        this.gameRenderer.showNotification(
          `🎲 Dé normal: ${this.diceResults.normal} + Pouvoir des dieux: ${this.diceResults.godPower} = Total: ${total}`
        );

        // Déplacer le joueur et repositionner les dés pour le prochain tour
        setTimeout(() => {
          this.moveCurrentPlayer(total);
          // Repositionner les dés au centre après le déplacement
          const tableBounds = this.boardRenderer.getTableBounds();
          if (tableBounds) {
            this.diceManager.positionDiceInTable(tableBounds);
          }
        }, 1000);
      }
    } else {
      // Un seul dé, déplacer directement
      this.gameRenderer.showDiceResult(result);

      setTimeout(() => {
        this.moveCurrentPlayer(result);
        // Repositionner le dé au centre après le déplacement
        const tableBounds = this.boardRenderer.getTableBounds();
        if (tableBounds) {
          this.diceManager.positionDiceInTable(tableBounds);
        }
      }, 1000);
    }
  }

  /**
   * Gère la chute du dé hors de la table
   */
  private handleDiceFall(diceType: 'normal' | 'godPower'): void {
    const currentPlayer = this.gameLogic.getCurrentPlayer();
    if (!currentPlayer) return;

    const tableConfig = this.boardRenderer.getTableConfig();
    const penalty = tableConfig?.fallPenalty || 0;

    // Afficher la notification de chute
    let message = `❌ Le dé est tombé de la table !`;
    if (penalty > 0) {
      this.gameLogic.addDrinks(currentPlayer.index, penalty);
      message += ` Pénalité : ${penalty} gorgée${penalty > 1 ? 's' : ''} pour ${currentPlayer.name}.`;
    }
    message += ` Glissez le dé pour le relancer...`;

    this.gameRenderer.showNotification(message);

    // Repositionner le dé au centre après 2 secondes
    setTimeout(() => {
      const tableBounds = this.boardRenderer.getTableBounds();
      if (tableBounds) {
        this.diceManager.positionDiceInTable(tableBounds);
        this.diceManager.resetDiceFall();
      }
      this.updateUI();
    }, 2000);
  }

  private async moveCurrentPlayer(steps: number): Promise<void> {
    const currentPlayer = this.gameLogic.getCurrentPlayer();
    if (!currentPlayer) return;

    console.log(`📹 Centrage caméra sur ${currentPlayer.name} avant déplacement`);

    // Centrer la caméra sur le joueur actuel avant de le déplacer
    this.boardRenderer.centerOnPlayer(currentPlayer.index, this.gameLogic.getPlayers());

    const oldPosition = currentPlayer.position;
    const newPosition = this.gameLogic.movePlayer(currentPlayer.index, steps);

    console.log(`🚶 ${currentPlayer.name} se déplace de ${oldPosition} à ${newPosition}`);

    // Animation avec suivi caméra
    await this.boardRenderer.animatePawnMove(currentPlayer.index, oldPosition, newPosition);
    this.updateBoard();

    // Attendre un peu puis appliquer l'effet de la case
    setTimeout(() => {
      this.applyTileEffect(newPosition);
    }, 500);
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
      case 'distribute_2':
      case 'distribute_3':
      case 'distribute_4':
        this.handleDistributeGulps(tile.type);
        return; // Ne pas passer au joueur suivant, attendre la sélection
      case 'forward_2':
        // Limiter à 2 déplacements consécutifs pour éviter les boucles infinies
        if (this.consecutiveForwardMoves < 2) {
          this.consecutiveForwardMoves++;
          const newPos = this.gameLogic.movePlayer(currentPlayer.index, 2);
          this.gameRenderer.showNotification(`${currentPlayer.name} avance de 2 cases !`);

          // Animation et application de l'effet de la nouvelle case
          setTimeout(async () => {
            await this.boardRenderer.animatePawnMove(currentPlayer.index, position, newPos);
            this.updateBoard();
            setTimeout(() => {
              this.applyTileEffect(newPos);
            }, 300);
          }, 500);
          return; // Ne pas passer au joueur suivant
        } else {
          this.gameRenderer.showNotification(`${currentPlayer.name} a atteint la limite de déplacements consécutifs !`);
        }
        break;
      case 'power':
        // Faveur des dieux : le joueur doit lancer 2 dés immédiatement
        this.handleGodPowerRoll(currentPlayer);
        return; // Ne pas passer au joueur suivant, attendre le lancer de dés
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

    // Attendre que l'utilisateur ferme le modal de l'effet avant de passer au suivant
    // (le bouton OK du modal peut déclencher ceci immédiatement, voir scheduleNextTurn)
    this.scheduleNextTurn(3000);
  }

  /**
   * Programme le passage au joueur suivant après un délai, tout en permettant
   * au bouton OK du modal d'effet de déclencher ce passage immédiatement.
   */
  private scheduleNextTurn(delay: number): void {
    this.scheduleModalAction(delay, () => this.prepareNextPlayerTurn());
  }

  /**
   * Programme une action après un délai, tout en permettant au bouton OK du
   * modal d'effet de déclencher cette action immédiatement (au lieu d'attendre
   * le délai automatique). Un seul appel en attente à la fois : un nouvel appel
   * annule le précédent.
   */
  private scheduleModalAction(delay: number, action: () => void): void {
    if (this.pendingModalAction) {
      clearTimeout(this.pendingModalAction.timeoutId);
    }
    const timeoutId = window.setTimeout(() => {
      this.pendingModalAction = null;
      action();
    }, delay);
    this.pendingModalAction = { timeoutId, callback: action };
  }

  /**
   * Gère la distribution de gorgées
   */
  private handleDistributeGulps(tileType: TileType): void {
    const currentPlayer = this.gameLogic.getCurrentPlayer();
    if (!currentPlayer) return;

    // Déterminer le nombre de gorgées à distribuer
    const gulpsCount = tileType === 'distribute_2' ? 2 : tileType === 'distribute_3' ? 3 : 4;
    const allPlayers = this.gameLogic.getPlayers();

    // Filtrer les joueurs disponibles (tous sauf le joueur actuel)
    const availablePlayers = allPlayers.filter(p => p.index !== currentPlayer.index);

    // On ne peut pas sélectionner plus de joueurs qu'il n'y en a de disponibles
    // (ex: distribute_4 avec seulement 3 adversaires en partie à 4 joueurs) —
    // sans ce plafond, le sélecteur ne peut jamais atteindre le nombre requis
    // et le tour se bloque définitivement.
    const requiredSelection = Math.min(gulpsCount, availablePlayers.length);

    // Fermer le modal de l'effet ("DISTRIBUEZ X GORGÉES") avant d'afficher le
    // sélecteur de joueurs, pour ne pas laisser les deux superposés
    this.gameRenderer.closeEffectModal();

    // Afficher le sélecteur de joueurs pour choisir qui reçoit les gorgées
    this.playerSelector.show(
      availablePlayers,
      requiredSelection,
      currentPlayer.index,
      false, // Ne pas permettre de se sélectionner soi-même
      (selectedPlayers) => {
        // Distribuer 1 gorgée à chaque joueur sélectionné
        selectedPlayers.forEach(player => {
          this.gameLogic.addDrinks(player.index, 1);
        });

        const names = selectedPlayers.map(p => p.name).join(', ');
        this.gameRenderer.showNotification(`${names} ${selectedPlayers.length > 1 ? 'boivent' : 'boit'} !`);

        this.updateUI();

        // Vérifier victoire et passer au joueur suivant
        const winner = this.gameLogic.checkVictory();
        if (winner) {
          this.handleVictory();
          return;
        }

        // Passer au joueur suivant après un délai
        this.scheduleNextTurn(2000);
      }
    );
  }

  /**
   * Gère le pouvoir d'Aphrodite : lancer 2 dés et déplacer 2 adversaires
   */
  private async handleAphroditePower(currentPlayer: any): Promise<void> {
    // Aphrodite demande de choisir 2 adversaires. En partie à 2 joueurs, il
    // n'y a qu'1 adversaire possible : demander au joueur comment gérer ce
    // cas (une seule fois pour toute la partie).
    const availableCount = this.gameLogic.getPlayers().length - 1;
    if (availableCount < 2) {
      if (this.aphroditeSoloMode === null) {
        const wantsBothDice = confirm(
          `Aphrodite demande 2 adversaires, mais il n'y en a qu'un seul disponible.\n\n` +
          `OK : l'adversaire reçoit les 2 dés.\n` +
          `Annuler : une autre faveur est tirée à la place.\n\n` +
          `Ce choix sera conservé pour le reste de la partie.`
        );
        this.aphroditeSoloMode = wantsBothDice ? 'both-dice' : 'reroll';
      }

      if (this.aphroditeSoloMode === 'reroll') {
        this.gameRenderer.showNotification(`Pas assez d'adversaires pour Aphrodite, nouvelle faveur !`);
        const randomFavor = Math.floor(Math.random() * 9) + 3; // 3 à 11
        this.showGodFavorResult(randomFavor);
        return;
      }
    }

    this.gameRenderer.showNotification(`${currentPlayer.name} lance 2 dés pour Aphrodite 💕`);

    // Afficher les deux dés
    this.diceManager.showBothDice();

    // Centrer la caméra sur les dés
    this.boardRenderer.focusOnDice(this.diceManager.getVisibleDicePosition());

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Lancer les 2 dés physiquement
    const result = await this.diceManager.rollBothDice();
    const dice1 = result.normalDice ?? 1;
    const dice2 = result.godPowerDice ?? 1;

    this.gameRenderer.showNotification(`🎲 Résultats des dés : ${dice1} et ${dice2}`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cacher le dé des pouvoirs après usage
    this.diceManager.showNormalDice();

    const allPlayers = this.gameLogic.getPlayers();
    const availablePlayers = allPlayers.filter(p => p.index !== currentPlayer.index);
    const requiredSelection = Math.min(2, availablePlayers.length);

    // Afficher sélecteur pour choisir les adversaires
    this.gameRenderer.showNotification(
      requiredSelection === 1
        ? `Confirmez l'adversaire qui recevra les 2 dés`
        : `Choisissez 2 adversaires à déplacer`
    );

    this.playerSelector.show(
      availablePlayers,
      requiredSelection,
      currentPlayer.index,
      false,
      (selectedPlayers) => {
        // Une fois les joueurs sélectionnés, montrer l'interface d'association
        this.showAphroditeDiceAssignment(dice1, dice2, selectedPlayers);
      }
    );
  }

  /**
   * Affiche l'interface pour associer chaque dé à un joueur et choisir la direction
   */
  private showAphroditeDiceAssignment(dice1: number, dice2: number, players: any[]): void {
    // Supporte 1 joueur (partie à 2, cf. aphroditeSoloMode) ou 2 joueurs (cas normal)
    const cardsHtml = players.map((player, idx) => `
          <div class="player-movement-card" style="border-color: ${player.color}; padding: 20px;">
            <div class="player-movement-name" style="margin-bottom: 15px;">${player.name}</div>
            <div style="font-size: 14px; color: #666; margin-bottom: 15px;">Position actuelle : ${player.position}</div>

            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 10px; font-weight: bold;">Choisissez le dé :</label>
              <div style="display: flex; gap: 10px;">
                <button class="direction-btn" data-player="${idx}" data-dice="1" style="flex: 1;">
                  🎲 Dé ${dice1}
                </button>
                <button class="direction-btn" data-player="${idx}" data-dice="2" style="flex: 1;">
                  🎲 Dé ${dice2}
                </button>
              </div>
            </div>

            <div>
              <label style="display: block; margin-bottom: 10px; font-weight: bold;">Direction :</label>
              <div style="display: flex; gap: 10px;">
                <button class="direction-btn" data-player="${idx}" data-dir="forward" style="flex: 1;">
                  ⏩ Avant
                </button>
                <button class="direction-btn" data-player="${idx}" data-dir="backward" style="flex: 1;">
                  ⏪ Arrière
                </button>
              </div>
            </div>
          </div>
    `).join('');

    // Créer une modale personnalisée pour associer les dés
    const modal = document.createElement('div');
    modal.className = 'manual-movement-modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="manual-movement-content" style="max-width: 800px;">
        <button class="close-manual-movement">&times;</button>
        <h2 class="manual-movement-title">💕 Pouvoir d'Aphrodite</h2>
        <p class="manual-movement-subtitle">${players.length > 1
        ? 'Associez chaque dé à un joueur et choisissez la direction'
        : `Attribuez les 2 dés à ${players[0].name} et choisissez une direction par dé`}</p>

        <div style="display: grid; grid-template-columns: repeat(${players.length}, 1fr); gap: 20px; margin-top: 20px;">
          ${cardsHtml}
        </div>

        <button class="confirm-all-movements" id="confirmAphrodite" style="margin-top: 30px; display: none;">
          Confirmer les déplacements
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    // État des choix, un par joueur affiché (1 ou 2)
    const choices: { dice: number; direction: string }[] = players.map(() => ({ dice: 0, direction: '' }));

    const diceButtons = modal.querySelectorAll('[data-dice]');
    const dirButtons = modal.querySelectorAll('[data-dir]');
    const confirmBtn = modal.querySelector('#confirmAphrodite') as HTMLElement;

    diceButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const playerIdx = parseInt(target.getAttribute('data-player') || '0');
        const diceNum = parseInt(target.getAttribute('data-dice') || '0');

        modal.querySelectorAll(`[data-player="${playerIdx}"][data-dice]`).forEach(b => {
          b.classList.remove('selected');
        });
        target.classList.add('selected');

        choices[playerIdx].dice = diceNum;
        this.checkAphroditeComplete(choices, confirmBtn);
      });
    });

    dirButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const playerIdx = parseInt(target.getAttribute('data-player') || '0');
        const dir = target.getAttribute('data-dir') || '';

        modal.querySelectorAll(`[data-player="${playerIdx}"][data-dir]`).forEach(b => {
          b.classList.remove('selected');
        });
        target.classList.add('selected');

        choices[playerIdx].direction = dir;
        this.checkAphroditeComplete(choices, confirmBtn);
      });
    });

    // Fermer la modale
    const closeBtn = modal.querySelector('.close-manual-movement');
    closeBtn?.addEventListener('click', () => {
      modal.remove();
      this.prepareNextPlayerTurn();
    });

    // Confirmer les choix
    confirmBtn.addEventListener('click', () => {
      // Vérifier qu'on n'utilise pas le même dé 2 fois (seulement pertinent à 2 joueurs)
      if (players.length === 2 && choices[0].dice === choices[1].dice) {
        this.gameRenderer.showNotification('⚠️ Vous devez assigner un dé différent à chaque joueur !');
        return;
      }

      const diceValues = [0, dice1, dice2];
      const newPositions = players.map((player, idx) => {
        const movement = choices[idx].direction === 'forward'
          ? diceValues[choices[idx].dice]
          : -diceValues[choices[idx].dice];
        return Math.max(0, Math.min(22, player.position + movement));
      });

      players.forEach((player, idx) => {
        this.gameLogic.setPlayerPosition(player.index, newPositions[idx]);
      });

      modal.remove();

      this.gameRenderer.showNotification(
        players.map((player, idx) => `${player.name} → case ${newPositions[idx]}`).join(' | ')
      );

      this.updateBoard();

      // Appliquer les effets des cases, une par une avec un délai entre chaque
      const applyEffectsSequentially = (index: number) => {
        if (index >= newPositions.length) {
          setTimeout(() => this.prepareNextPlayerTurn(), 2000);
          return;
        }
        this.applyTileEffect(newPositions[index]);
        setTimeout(() => applyEffectsSequentially(index + 1), 2000);
      };
      setTimeout(() => applyEffectsSequentially(0), 2000);
    });
  }

  /**
   * Vérifie si tous les choix sont faits pour Aphrodite
   */
  private checkAphroditeComplete(choices: { dice: number; direction: string }[], confirmBtn: HTMLElement): void {
    const allComplete = choices.every(c => c.dice > 0 && c.direction);
    if (allComplete) {
      confirmBtn.style.display = 'block';
    }
  }

  /**
   * Gère le pouvoir de Poséidon : cibler un joueur et distribuer des gorgées
   */
  private async handlePoseidonPower(currentPlayer: any): Promise<void> {
    this.gameRenderer.showNotification(`${currentPlayer.name} : Choisissez un joueur à cibler avec Poséidon 🔱`);

    const allPlayers = this.gameLogic.getPlayers();
    const availablePlayers = allPlayers.filter(p => p.index !== currentPlayer.index);

    this.playerSelector.show(
      availablePlayers,
      1,
      currentPlayer.index,
      false,
      async (selectedPlayers) => {
        const target = selectedPlayers[0];

        this.gameRenderer.showNotification(`${currentPlayer.name} lance 2 dés pour Poséidon 🔱`);

        // Afficher les deux dés
        this.diceManager.showBothDice();

        // Centrer la caméra sur les dés
        this.boardRenderer.focusOnDice(this.diceManager.getVisibleDicePosition());

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Lancer les 2 dés physiquement
        const result = await this.diceManager.rollBothDice();
        const dice1 = result.normalDice ?? 1;
        const dice2 = result.godPowerDice ?? 1;
        const maxDice = Math.max(dice1, dice2);
        const minDice = Math.min(dice1, dice2);

        // Cacher le dé des pouvoirs après usage
        this.diceManager.showNormalDice();

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Afficher les résultats des dés
        this.gameRenderer.showNotification(
          `🎲 Résultats : ${dice1} et ${dice2} | Max: ${maxDice}, Min: ${minDice}`
        );

        // Le joueur ciblé reçoit le maximum
        this.gameLogic.addDrinks(target.index, maxDice);

        // Trouver les 2 voisins du joueur ciblé (dans l'ordre des joueurs)
        const neighbors = this.findNeighbors(target.index);

        // Les voisins reçoivent le minimum
        if (neighbors.left !== null) {
          this.gameLogic.addDrinks(neighbors.left, minDice);
        }
        if (neighbors.right !== null) {
          this.gameLogic.addDrinks(neighbors.right, minDice);
        }

        // Construire le message de notification
        let message = `🔱 ${target.name} boit ${maxDice} gorgée${maxDice > 1 ? 's' : ''} !`;

        const neighborNames: string[] = [];
        if (neighbors.left !== null) {
          const leftPlayer = this.gameLogic.getPlayerByIndex(neighbors.left);
          if (leftPlayer) neighborNames.push(leftPlayer.name);
        }
        if (neighbors.right !== null) {
          const rightPlayer = this.gameLogic.getPlayerByIndex(neighbors.right);
          if (rightPlayer) neighborNames.push(rightPlayer.name);
        }

        if (neighborNames.length > 0) {
          message += ` Ses voisins (${neighborNames.join(' et ')}) boivent ${minDice} gorgée${minDice > 1 ? 's' : ''} chacun !`;
        }

        setTimeout(() => {
          this.gameRenderer.showNotification(message);
          this.updateUI();
          this.scheduleNextTurn(4000);
        }, 2000);
      }
    );
  }

  /**
   * Ouvre la modale de déplacement manuel pour tous les joueurs
   */
  private openManualMovementModal(): void {
    const allPlayers = this.gameLogic.getPlayers();

    if (allPlayers.length === 0) {
      this.gameRenderer.showNotification('Aucune partie en cours !');
      return;
    }

    // Ouvrir le panel de déplacement manuel
    this.manualMovement.show(allPlayers, (movements) => {
      if (movements.length === 0) {
        return;
      }

      // Traiter les déplacements un par un avec un délai
      let delay = 0;

      movements.forEach((movement) => {
        const oldPosition = movement.player.position;

        setTimeout(() => {
          // Déplacer le joueur
          this.gameLogic.setPlayerPosition(movement.player.index, movement.newPosition);

          this.updateBoard();
          this.updateUI();

          // Si l'option "appliquer l'effet" est activée, appliquer l'effet de la case
          if (movement.applyEffect && movement.newPosition !== oldPosition) {
            // Définir temporairement ce joueur comme joueur actuel pour l'effet
            const currentPlayerIndex = this.gameLogic['currentPlayerIndex'];
            this.gameLogic['currentPlayerIndex'] = movement.player.index;

            setTimeout(() => {
              this.applyTileEffect(movement.newPosition);
              // Restaurer le joueur actuel original
              this.gameLogic['currentPlayerIndex'] = currentPlayerIndex;
            }, 500);
          }
        }, delay);

        delay += movement.applyEffect ? 2500 : 500;
      });

      setTimeout(() => {
        const names = movements.map((m) => m.player.name).join(', ');
        this.gameRenderer.showNotification(`${names} déplacé(s) manuellement ! 🎯`);
      }, delay);
    });
  }

  /**
   * Trouve les voisins gauche et droite d'un joueur dans l'ordre des joueurs
   */
  private findNeighbors(playerIndex: number): { left: number | null; right: number | null } {
    const totalPlayers = this.gameLogic.getPlayers().length;
    return findPlayerNeighbors(playerIndex, totalPlayers);
  }

  /**
   * Affiche le résultat de la faveur des dieux selon la somme des 2 dés
   */
  private showGodFavorResult(sum: number): void {
    const currentPlayer = this.gameLogic.getCurrentPlayer();
    if (!currentPlayer) return;

    const favor = GOD_FAVORS[sum];
    if (!favor) {
      console.error(`Aucune faveur trouvée pour la somme ${sum}`);
      this.prepareNextPlayerTurn();
      return;
    }

    console.log(`✨ Faveur obtenue: ${favor.name} (somme: ${sum})`);

    // Afficher le modal avec la faveur
    this.gameRenderer.showEffectModal(favor.icon, favor.name, favor.description);

    // Exécuter l'effet de la faveur (le bouton OK du modal peut avancer immédiatement)
    this.scheduleModalAction(3000, () => this.executeGodFavor(sum));
  }

  /**
   * Exécute l'effet d'une faveur des dieux
   */
  private executeGodFavor(sum: number): void {
    const currentPlayer = this.gameLogic.getCurrentPlayer();
    if (!currentPlayer) return;

    this.gameRenderer.closeEffectModal();

    switch (sum) {
      case 2: // Colère des dieux
        this.gameLogic.addDrinks(currentPlayer.index, 1);
        this.gameRenderer.showNotification(`${currentPlayer.name} reçoit 1 cul sec !`);
        this.scheduleNextTurn(2000);
        break;

      case 3: // Jugement Dernier - relancer un dé
        this.gameRenderer.showNotification(`${currentPlayer.name} peut relancer un dé !`);
        // Pour simplifier, on relance automatiquement
        setTimeout(() => {
          const newSum = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
          this.gameRenderer.showNotification(`Nouveau résultat : ${newSum}`);
          setTimeout(() => this.showGodFavorResult(newSum), 1500);
        }, 2000);
        break;

      case 4: // Athéna - bouclier
        // TODO: Implémenter le système de bouclier
        this.gameRenderer.showNotification(`${currentPlayer.name} obtient le bouclier d'Athéna !`);
        this.scheduleNextTurn(2000);
        break;

      case 5: // Aphrodite - lancer 2 dés et déplacer 2 adversaires
        this.handleAphroditePower(currentPlayer);
        break;

      case 6: // Hermès - échanger de position
        this.gameRenderer.showNotification(`${currentPlayer.name} : Choisissez un adversaire pour échanger de position`);
        this.playerSelector.show(
          this.gameLogic.getPlayers(),
          1,
          currentPlayer.index,
          false,
          (selectedPlayers) => {
            const target = selectedPlayers[0];
            const tempPos = currentPlayer.position;
            this.gameLogic.setPlayerPosition(currentPlayer.index, target.position);
            this.gameLogic.setPlayerPosition(target.index, tempPos);
            this.gameRenderer.showNotification(`${currentPlayer.name} et ${target.name} échangent de position ! 👟`);
            this.updateUI();
            this.scheduleNextTurn(3000);
          }
        );
        break;

      case 7: // Apollon - rejouer
        this.gameRenderer.showNotification(`${currentPlayer.name} rejoue !`);
        setTimeout(() => {
          // Repasser au joueur actuel
          this.gameLogic.previousPlayer();
          this.prepareNextPlayerTurn();
        }, 2000);
        break;

      case 8: // Arès - pouce haut/bas
        this.gameRenderer.showNotification(`Tous les joueurs : pouce haut ou bas ! (effet simulé)`);
        this.scheduleNextTurn(3000);
        break;

      case 9: // Dionysos - tous boivent
        const allPlayersForDrink = this.gameLogic.getPlayers();
        allPlayersForDrink.forEach((p) => {
          this.gameLogic.addDrinks(p.index, 2);
        });
        this.gameRenderer.showNotification(`Tous boivent avec ${currentPlayer.name} ! 🍷`);
        this.updateUI();
        this.scheduleNextTurn(3000);
        break;

      case 10: // Héphaïstos - placer shooters
        this.gameRenderer.showNotification(`${currentPlayer.name} place 2 shooters virtuels ! 🔨`);
        this.scheduleNextTurn(2000);
        break;

      case 11: // Poséidon - cibler un joueur et ses voisins
        this.handlePoseidonPower(currentPlayer);
        break;

      case 12: // Zeus - choisir une faveur
        this.gameRenderer.showNotification(`${currentPlayer.name} peut choisir n'importe quelle faveur ! (mode simplifié : faveur aléatoire)`);
        // Mode simplifié : donner une faveur aléatoire entre 3 et 11
        setTimeout(() => {
          const randomFavor = Math.floor(Math.random() * 9) + 3; // 3 à 11
          this.showGodFavorResult(randomFavor);
        }, 2000);
        break;

      default:
        this.prepareNextPlayerTurn();
    }
  }

  /**
   * Gère le lancer des 2 dés pour la faveur des dieux
   */
  private handleGodPowerRoll(player: Player): void {
    console.log(`⚡ ${player.name} tombe sur la faveur des dieux !`);

    // Activer le mode "lancer pour faveur des dieux"
    this.isRollingForGodPower = true;

    // Fermer le modal de l'effet de la case
    this.gameRenderer.closeEffectModal();

    // Afficher les deux dés pour le lancer
    this.diceManager.showBothDice();

    // Réinitialiser les résultats
    this.diceResults = { normal: null, godPower: null };

    // Message pour le joueur
    this.gameRenderer.showNotification(
      `⚡ ${player.name}, lancez les 2 dés pour connaître votre faveur des dieux !`
    );

    // Positionner les dés au centre
    const tableBounds = this.boardRenderer.getTableBounds();
    if (tableBounds) {
      this.diceManager.positionDiceInTable(tableBounds);
    }

    // Réactiver le bouton de dé : un clic dessus lancera les 2 dés de faveur
    // (voir le branchement isRollingForGodPower dans rollDice())
    this.gameRenderer.setDiceButtonEnabled(true);

    // Note: Les callbacks handleDiceRollEnd vont gérer la suite automatiquement
    // Quand les 2 dés s'arrêtent, on calculera la somme et affichera la faveur
  }

  /**
   * Prépare le tour du joueur suivant
   */
  private prepareNextPlayerTurn(): void {
    console.log('🔄 Passage au joueur suivant');

    // Passer au joueur suivant
    this.gameLogic.nextPlayer();
    this.updateUI();

    const nextPlayer = this.gameLogic.getCurrentPlayer();
    if (!nextPlayer) return;

    console.log(`👉 C'est au tour de ${nextPlayer.name}`);

    // Fermer le modal de l'effet précédent
    this.gameRenderer.closeEffectModal();

    // Afficher une notification pour le prochain joueur
    this.gameRenderer.showNotification(
      `🎲 C'est au tour de ${nextPlayer.name} ! Glissez le dé pour le lancer.`
    );

    // Centrer la caméra sur le prochain joueur
    setTimeout(() => {
      this.boardRenderer.centerOnPlayer(nextPlayer.index, this.gameLogic.getPlayers());

      // Repositionner les dés au centre de la table
      const tableBounds = this.boardRenderer.getTableBounds();
      if (tableBounds) {
        this.diceManager.positionDiceInTable(tableBounds);
      }

      // Afficher le(s) dé(s) approprié(s) pour le prochain joueur
      if (nextPlayer.hasSchmittPower) {
        this.diceManager.showBothDice();
      } else {
        this.diceManager.showNormalDice();
      }

      // Réactiver le bouton de dé
      this.gameRenderer.setDiceButtonEnabled(true);
    }, 500);
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
    this.diceManager.hideAll();
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
