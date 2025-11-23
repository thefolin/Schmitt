import { GameLogic } from '../features/game/game.logic';
import { GameRenderer } from '../features/game/game.renderer';
import { BoardCameraRenderer } from '../features/board/camera/board.renderer.camera';
import { TILE_CONFIGS } from '../features/tiles/tile.config';
import { assetManager } from '../core/assets/AssetManager';
import type { BoardLayoutConfig } from '../features/board/camera/board-layout.config';
import { DiceManager } from '../features/dice';
import { PlayerSelector } from '../features/game/player-selector';
import { ManualMovement } from '../features/game/manual-movement';
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

    document.querySelector('.close-modal')?.addEventListener('click', () => {
      this.gameRenderer.closeEffectModal();
    });

    // Toggle sidebar
    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      sidebar?.classList.toggle('collapsed');
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

    // Réinitialiser le compteur de déplacements consécutifs au début du tour
    this.consecutiveForwardMoves = 0;

    // Centrer la caméra sur le joueur actuel au lancer de dé
    this.boardRenderer.centerOnPlayer(currentPlayer.index, this.gameLogic.getPlayers());

    // Si le joueur a le pouvoir Schmitt, afficher les deux dés
    if (currentPlayer.hasSchmittPower) {
      this.diceManager.showBothDice();
      this.gameRenderer.showNotification(
        `✨ Pouvoir Schmitt activé ! Glissez les deux dés pour les lancer.`
      );
    } else {
      this.diceManager.showNormalDice();
    }

    // Note: Le drag-and-drop gère maintenant le lancer automatiquement
    // Le callback onDiceRollEnd s'occupera de faire avancer le joueur
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
    setTimeout(() => {
      this.prepareNextPlayerTurn();
    }, 3000);
  }

  /**
   * Affiche le résultat de la faveur des dieux selon la somme des 2 dés
   */
  private showGodFavorResult(sum: number): void {
    const currentPlayer = this.gameLogic.getCurrentPlayer();
    if (!currentPlayer) return;

    // Mapping des faveurs selon la somme (2-12)
    const godFavors: { [key: number]: { name: string; icon: string; description: string } } = {
      2: {
        name: 'COLÈRE DES DIEUX',
        icon: '💀',
        description: 'Le joueur reçoit 1 cul sec !'
      },
      3: {
        name: 'JUGEMENT DERNIER',
        icon: '🎲',
        description: 'Conservez 1 des 2 dés et relancez l\'autre en fonction des faveurs souhaitées. Attention à la colère des Dieux !'
      },
      4: {
        name: 'ATHÉNA',
        icon: '🛡️',
        description: 'Choisissez un objet bouclier. Ce bouclier renvoie 1 seule fois toutes les gorgées/cul-sec sur le joueur de votre choix. Tant que vous possédez le bouclier, vous ne pouvez pas gagner.'
      },
      5: {
        name: 'APHRODITE',
        icon: '💕',
        description: 'Lancez 2 dés, choisissez 2 adversaires et associez 1 dé à chacun. Déplacez-les en avant ou arrière. Ils appliquent l\'effet de leur nouvel emplacement.'
      },
      6: {
        name: 'HERMÈS',
        icon: '👟',
        description: 'Choisissez un adversaire et déplacez-vous sur sa case OU déplacez-le sur votre case. Appliquez l\'effet de la case du nouvel emplacement.'
      },
      7: {
        name: 'APOLLON',
        icon: '☀️',
        description: 'Rejouez un tour en lançant 2 dés, conservez celui de votre choix. Distribuez 1 gorgée à chaque adversaire que vous dépassez.'
      },
      8: {
        name: 'ARÈS',
        icon: '⚔️',
        description: 'Tous les joueurs choisissent pouce haut ou bas. Ceux qui font l\'inverse de vous reçoivent autant de gorgées que le nombre qui ont fait comme vous.'
      },
      9: {
        name: 'DIONYSOS',
        icon: '🍷',
        description: 'Tous les joueurs trinquent et continuent de boire avec vous jusqu\'à ce que vous seul décidiez d\'arrêter.'
      },
      10: {
        name: 'HÉPHAÏSTOS',
        icon: '🔨',
        description: 'Placez 2 shooters sur des cases différentes. Le premier joueur à tomber dessus doit boire immédiatement le shooter, puis appliquer la case.'
      },
      11: {
        name: 'POSÉIDON',
        icon: '🔱',
        description: 'Ciblez un joueur et lancez 2 dés. Il reçoit autant de gorgées que le dé le plus élevé. Ses 2 voisins reçoivent chacun le score du dé le plus faible.'
      },
      12: {
        name: 'ZEUS - FAVEUR SUPRÊME',
        icon: '⚡',
        description: 'Choisissez n\'importe quelle faveur parmi celles disponibles !'
      }
    };

    const favor = godFavors[sum];
    if (!favor) {
      console.error(`Aucune faveur trouvée pour la somme ${sum}`);
      this.prepareNextPlayerTurn();
      return;
    }

    console.log(`✨ Faveur obtenue: ${favor.name} (somme: ${sum})`);

    // Afficher le modal avec la faveur
    this.gameRenderer.showEffectModal(favor.icon, favor.name, favor.description);

    // Exécuter l'effet de la faveur
    setTimeout(() => {
      this.executeGodFavor(sum);
    }, 3000);
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
        setTimeout(() => this.prepareNextPlayerTurn(), 2000);
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
        setTimeout(() => this.prepareNextPlayerTurn(), 2000);
        break;

      case 5: // Aphrodite - déplacer 2 adversaires
        this.gameRenderer.showNotification(`${currentPlayer.name} : Choisissez 2 adversaires à déplacer`);
        this.playerSelector.show(
          this.gameLogic.getPlayers(),
          2,
          currentPlayer.index,
          false,
          (selectedPlayers) => {
            // Ouvrir le déplacement manuel pour ces 2 joueurs
            this.manualMovement.show(selectedPlayers, (movements) => {
              movements.forEach((movement) => {
                this.gameLogic.setPlayerPosition(movement.player.index, movement.newPosition);
              });

              const names = movements.map((m) => m.player.name).join(' et ');
              this.gameRenderer.showNotification(`${names} ont été déplacés ! 💕`);
              this.updateUI();
              setTimeout(() => this.prepareNextPlayerTurn(), 2000);
            });
          }
        );
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
            setTimeout(() => this.prepareNextPlayerTurn(), 3000);
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
        setTimeout(() => this.prepareNextPlayerTurn(), 3000);
        break;

      case 9: // Dionysos - tous boivent
        const allPlayersForDrink = this.gameLogic.getPlayers();
        allPlayersForDrink.forEach((p) => {
          this.gameLogic.addDrinks(p.index, 2);
        });
        this.gameRenderer.showNotification(`Tous boivent avec ${currentPlayer.name} ! 🍷`);
        this.updateUI();
        setTimeout(() => this.prepareNextPlayerTurn(), 3000);
        break;

      case 10: // Héphaïstos - placer shooters
        this.gameRenderer.showNotification(`${currentPlayer.name} place 2 shooters virtuels ! 🔨`);
        setTimeout(() => this.prepareNextPlayerTurn(), 2000);
        break;

      case 11: // Poséidon - cibler un joueur
        this.gameRenderer.showNotification(`${currentPlayer.name} : Choisissez un joueur à cibler avec Poséidon`);
        this.playerSelector.show(
          this.gameLogic.getPlayers(),
          1,
          currentPlayer.index,
          false,
          (selectedPlayers) => {
            const target = selectedPlayers[0];
            const dice1 = Math.floor(Math.random() * 6) + 1;
            const dice2 = Math.floor(Math.random() * 6) + 1;
            const maxDice = Math.max(dice1, dice2);

            this.gameLogic.addDrinks(target.index, maxDice);
            this.gameRenderer.showNotification(`${target.name} boit ${maxDice} gorgées (dés: ${dice1}, ${dice2}) ! 🔱`);
            this.updateUI();
            setTimeout(() => this.prepareNextPlayerTurn(), 3000);
          }
        );
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
