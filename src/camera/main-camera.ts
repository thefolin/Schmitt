import { GameLogic } from '../features/game/game.logic';
import { GameRenderer } from '../features/game/game.renderer';
import { BoardCameraRenderer } from '../features/board/camera/board.renderer.camera';
import { TILE_CONFIGS, loadTileConfigs } from '../features/tiles/tile.config';
import { assetManager } from '../core/assets/AssetManager';
import type { BoardLayoutConfig } from '../features/board/camera/board-layout.config';
import type { TileType } from '@/core/models/Tile';
import type { Player } from '@/core/models/Player';
import { DiceManager } from '../features/dice';
import { PlayerSelector } from '../features/game/player-selector';
import { ManualMovement } from '../features/game/manual-movement';
import { GOD_FAVORS, findNeighbors as findPlayerNeighbors } from '../features/game/god-favors';
import { buildActionText, buildSubtitle, withGulpSymbol, GULP } from '../features/game/action-text';
// Les tokens du design system doivent précéder toute feuille qui les consomme
import '../styles/common/design-system.css';
import '../styles/common/main.css';
import '../styles/common/mobile-optimized.css';
// Chargé en dernier : le design system fait autorité sur l'écran de setup,
// dont les anciennes règles sont dispersées dans main.css et mobile-optimized.css
import '../styles/common/setup-screen.css';
import '../styles/camera/board-camera.css';
import '../styles/game/player-selector.css';
import '../styles/game/manual-movement.css';
import '../styles/game/hud.css';
// Chargée en dernier : réaligne les modales et panneaux hérités sur les tokens
import '../styles/common/surfaces.css';

interface SavedLayout {
  name: string;
  timestamp: number;
  config: BoardLayoutConfig;
}

/** Un joueur en cours de saisie dans le menu, avant le début de la partie. */
interface PlayerDraft {
  name: string;
  color: string;
}

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 10;

/** Palette attribuée aux joueurs dans l'ordre d'ajout. */
const PLAYER_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
  '#e91e63', '#00bcd4'
];

/** Tablée de la dernière partie, rechargée au prochain lancement. */
const PLAYER_DRAFTS_KEY = 'schmitt-player-drafts';

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
  private playerDrafts: PlayerDraft[] = [];
  private selectedLayout: BoardLayoutConfig | null = null;
  private importedLayout: BoardLayoutConfig | null = null;
  private consecutiveForwardMoves = 0; // Compteur pour éviter les boucles infinies
  private sheepHops = 0; // Sauts de MOUTON dans le tour : borne les rebonds en chaîne
  private diceResults: { normal: number | null; godPower: number | null } = { normal: null, godPower: null };
  private isRollingForGodPower = false; // Flag pour savoir si on lance pour une faveur des dieux
  /** Valeurs des 2 dés de la dernière Faveur, pour le Jugement Dernier. */
  private lastFavorDice: { a: number; b: number } = { a: 1, b: 1 };
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

    // Le parcours vient d'un fichier de données : il doit être chargé avant
    // que le plateau ne soit rendu ou qu'un effet ne soit appliqué.
    await loadTileConfigs();

    this.loadSavedLayouts();

    // Charger test.json par défaut
    await this.loadTestLayout();

    this.populateMapSelect();
    this.updateBoardLabel();
    this.setupEventListeners();
    this.loadPlayerDrafts();
    this.renderPlayerInputs();
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
    // Ajout d'un joueur à la liste
    document.getElementById('addPlayerBtn')?.addEventListener('click', () => {
      this.addPlayer();
    });

    // La hauteur disponible change en rotation : recalculer l'indice de défilement
    window.addEventListener('resize', () => this.updateScrollHint());

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

    // --- Tiroir des actions secondaires ---
    document.getElementById('menuBtn')?.addEventListener('click', () => {
      const drawer = document.getElementById('actionDrawer');
      this.toggleDrawer(Boolean(drawer?.hidden));
    });

    // Fermeture : clic sur le fond, ou touche Échap
    document.getElementById('drawerBackdrop')?.addEventListener('click', () => {
      this.toggleDrawer(false);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.toggleDrawer(false);
    });

    // Historique : replié par défaut pour garder le tiroir court
    document.getElementById('showHistoryBtn')?.addEventListener('click', () => {
      const panel = document.getElementById('historyPanel');
      if (!panel) return;
      panel.hidden = !panel.hidden;
      if (!panel.hidden) this.renderHistory(this.gameLogic.getHistory());
    });

    // Nouvelle partie
    document.getElementById('resetBtn')?.addEventListener('click', () => {
      if (confirm('Êtes-vous sûr de vouloir quitter la partie en cours ?')) {
        this.toggleDrawer(false);
        this.resetGame();
      }
    });

    // Fermeture des modales d'info (les croix n'étaient câblées à rien)
    document.getElementById('closePlayerModal')?.addEventListener('click', () => {
      document.getElementById('playerModal')?.classList.remove('show');
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
      this.toggleDrawer(false);
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
            // Recadrer sur la table plutôt que sur (0,0) au zoom 1 : selon la
            // taille de l'écran, ce point n'a rien à voir avec le plateau.
            this.boardRenderer.fitTableToViewport(true);
            break;
        }
      });
    });
  }

  /**
   * Rend la liste des joueurs à partir de this.playerDrafts.
   *
   * La liste EST la source de vérité du nombre de joueurs : il n'y a plus de
   * champ « nombre de joueurs » à régler avant de pouvoir saisir les noms.
   */
  private renderPlayerInputs(): void {
    const container = document.getElementById('playerInputs');
    if (!container) return;

    container.innerHTML = '';

    this.playerDrafts.forEach((draft, i) => {
      const div = document.createElement('div');
      div.className = 'player-input-item';

      const name = document.createElement('input');
      name.type = 'text';
      name.placeholder = `Joueur ${i + 1}`;
      name.value = draft.name;
      name.maxLength = 20;
      name.setAttribute('data-player-index', String(i));
      name.addEventListener('input', () => {
        this.playerDrafts[i].name = name.value;
        this.savePlayerDrafts();
      });
      // Entrée passe au joueur suivant, ou ajoute une ligne si on est au bout :
      // on saisit toute la tablée au clavier sans lâcher les mains.
      name.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const next = container.querySelectorAll<HTMLInputElement>('input[type="text"]')[i + 1];
        if (next) {
          next.focus();
          next.select();
        } else if (this.playerDrafts.length < MAX_PLAYERS) {
          this.addPlayer();
        }
      });

      const color = document.createElement('input');
      color.type = 'color';
      color.className = 'color-picker';
      color.value = draft.color;
      color.setAttribute('data-player-index', String(i));
      color.addEventListener('input', () => {
        this.playerDrafts[i].color = color.value;
        this.savePlayerDrafts();
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-player-btn';
      remove.innerHTML = '&times;';
      remove.title = `Retirer ${draft.name || `Joueur ${i + 1}`}`;
      remove.setAttribute('aria-label', remove.title);
      // En dessous de MIN_PLAYERS la partie ne peut pas démarrer : on désactive
      // plutôt que de masquer, pour que la limite soit visible.
      remove.disabled = this.playerDrafts.length <= MIN_PLAYERS;
      remove.addEventListener('click', () => this.removePlayer(i));

      div.append(name, color, remove);
      container.appendChild(div);
    });

    this.updatePlayerCountUI();
    this.updateScrollHint();
  }

  /**
   * Signale visuellement que la liste déborde (voir .is-scrollable).
   * Doit être appelé après rendu ET au redimensionnement : passer en paysage
   * change la hauteur disponible sans changer le nombre de joueurs.
   */
  private updateScrollHint(): void {
    const container = document.getElementById('playerInputs');
    if (!container) return;
    container.classList.toggle(
      'is-scrollable',
      container.scrollHeight > container.clientHeight + 1
    );
  }

  /** Met à jour le compteur et l'état du bouton « Ajouter ». */
  private updatePlayerCountUI(): void {
    const label = document.getElementById('playerCountLabel');
    if (label) label.textContent = `${this.playerDrafts.length} / ${MAX_PLAYERS}`;

    const addBtn = document.getElementById('addPlayerBtn') as HTMLButtonElement | null;
    if (addBtn) {
      const full = this.playerDrafts.length >= MAX_PLAYERS;
      addBtn.disabled = full;
      addBtn.textContent = full ? `Maximum ${MAX_PLAYERS} joueurs` : '+ Ajouter un joueur';
    }
  }

  /** Ajoute un joueur et donne le focus à son champ, prêt à la saisie. */
  private addPlayer(): void {
    if (this.playerDrafts.length >= MAX_PLAYERS) return;

    const index = this.playerDrafts.length;
    this.playerDrafts.push({
      name: `Joueur ${index + 1}`,
      color: PLAYER_COLORS[index % PLAYER_COLORS.length]
    });
    this.savePlayerDrafts();
    this.renderPlayerInputs();

    const inputs = document.querySelectorAll<HTMLInputElement>('#playerInputs input[type="text"]');
    const added = inputs[index];
    if (added) {
      added.focus();
      added.select(); // le nom par défaut part dès la première frappe
    }
  }

  private removePlayer(index: number): void {
    if (this.playerDrafts.length <= MIN_PLAYERS) return;
    this.playerDrafts.splice(index, 1);
    this.savePlayerDrafts();
    this.renderPlayerInputs();
  }

  /**
   * Restaure la tablée de la dernière partie : en soirée on enchaîne les
   * parties avec les mêmes personnes, autant ne pas retaper les prénoms.
   */
  private loadPlayerDrafts(): void {
    const fallback = (): PlayerDraft[] =>
      Array.from({ length: MIN_PLAYERS }, (_, i) => ({
        name: `Joueur ${i + 1}`,
        color: PLAYER_COLORS[i % PLAYER_COLORS.length]
      }));

    try {
      const raw = localStorage.getItem(PLAYER_DRAFTS_KEY);
      if (!raw) {
        this.playerDrafts = fallback();
        return;
      }

      const parsed: unknown = JSON.parse(raw);
      const drafts = Array.isArray(parsed)
        ? parsed
            .filter((d): d is PlayerDraft =>
              typeof d?.name === 'string' && typeof d?.color === 'string')
            .slice(0, MAX_PLAYERS)
            .map((d) => ({ name: d.name.slice(0, 20), color: d.color }))
        : [];

      this.playerDrafts = drafts.length >= MIN_PLAYERS ? drafts : fallback();
    } catch {
      // localStorage indisponible (navigation privée) : on démarre à vide
      this.playerDrafts = fallback();
    }
  }

  private savePlayerDrafts(): void {
    try {
      localStorage.setItem(PLAYER_DRAFTS_KEY, JSON.stringify(this.playerDrafts));
    } catch {
      // Sauvegarde best-effort : ne doit jamais empêcher de jouer
    }
  }

  /**
   * Gère la sélection d'une map dans le dropdown
   */
  private onMapSelected(value: string): void {
    // Chaque branche DOIT conclure sur une valeur. Auparavant, un choix qui
    // ne correspondait à rien (entrée sauvegardée disparue, 'imported' sans
    // import en mémoire) laissait selectedLayout sur sa valeur précédente
    // pendant que le menu affichait autre chose : on croyait jouer sur un
    // plateau, et on jouait sur un autre.
    let resolved: BoardLayoutConfig | null = null;

    if (value === 'imported') {
      resolved = this.importedLayout;
    } else if (value.startsWith('saved-')) {
      const index = parseInt(value.replace('saved-', ''), 10);
      resolved = this.savedLayouts[index]?.config ?? null;
    }

    // 'default', comme tout choix devenu introuvable, ramène au plateau de base
    if (!resolved && value !== 'default') {
      console.warn(`Plateau « ${value} » introuvable, retour au plateau par défaut.`);
      const select = document.getElementById('mapSelect') as HTMLSelectElement | null;
      if (select) select.value = 'default';
    }

    this.selectedLayout = resolved;
    this.updateBoardLabel();
  }

  /**
   * Reporte le plateau choisi sur le résumé du panneau replié, pour qu'on sache
   * sur quelle carte on va jouer sans avoir à déplier « Plateau & outils ».
   */
  private updateBoardLabel(): void {
    const label = document.getElementById('currentBoardLabel');
    const select = document.getElementById('mapSelect') as HTMLSelectElement | null;
    if (!label || !select) return;

    const option = select.selectedOptions[0];
    label.textContent = option ? option.textContent : 'Plateau par défaut';
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
    // Un champ laissé vide reste un joueur valide : on lui rend son nom par défaut
    const players = this.playerDrafts.map((draft, index) => ({
      name: draft.name.trim() || `Joueur ${index + 1}`,
      color: draft.color
    }));

    if (players.length < MIN_PLAYERS) {
      this.gameRenderer.showNotification(
        `Il faut au moins ${MIN_PLAYERS} joueurs pour commencer`
      );
      return;
    }

    this.savePlayerDrafts();

    // Appliquer le layout sélectionné
    if (this.selectedLayout) {
      this.boardRenderer.setLayout(this.selectedLayout);
    }

    // La logique doit connaître la taille du plateau chargé : un plateau
    // composé par un joueur n'a pas forcément 23 cases.
    this.gameLogic.setBoardSize(this.boardRenderer.getTileCount());

    this.gameLogic.startGame(players);
    this.gameRenderer.hideSetupScreen();
    this.updateUI();
    // État initial du HUD : c'est au premier joueur de lancer
    this.gameRenderer.setDiceButtonEnabled(true);

    // Cadrer la table sur l'écran : indispensable sur très petit ou très grand
    // écran, où un zoom fixe donne un plateau minuscule ou débordant.
    this.boardRenderer.fitTableToViewport(false);

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

    // Réinitialiser les compteurs anti-boucle au début du tour
    this.consecutiveForwardMoves = 0;
    this.sheepHops = 0;

    // Le porteur du pouvoir du Schmitt lance UN SEUL dé, comme tout le monde.
    // Il lançait les deux dés et avançait de leur somme, ce qui n'est pas la
    // règle : le second dé sert aux faveurs des dieux, jamais au déplacement.
    // Son pouvoir est de distribuer des gorgées aux joueurs qu'il croise.
    void this.diceManager.rollNormalDice();

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

        // Conserver les deux valeurs : le Jugement Dernier permet d'en garder
        // une et de relancer l'autre, il faut donc savoir ce qui est sorti.
        this.lastFavorDice = {
          a: this.diceResults.normal,
          b: this.diceResults.godPower
        };

        // Réinitialiser le flag
        this.isRollingForGodPower = false;

        // Ne cacher que le dé de faveur : `hideAll()` masquait aussi le dé
        // normal, et le joueur ne voyait plus AUCUN dé aux tours suivants —
        // la valeur qui le déplaçait devenait invisible.
        setTimeout(() => {
          this.diceManager.showNormalDice();

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

    {
      // Un seul dé pour tout le monde, porteur du pouvoir compris
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
      message += ` Pénalité : ${penalty} ${GULP} pour ${currentPlayer.name}.`;
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

    // Sentence du Poulet : sur un 3 ou un 6, quel que soit le lanceur.
    this.applyChickenPenalty(steps);

    console.log(`📹 Centrage caméra sur ${currentPlayer.name} avant déplacement`);

    // Centrer la caméra sur le joueur actuel avant de le déplacer
    this.boardRenderer.centerOnPlayer(currentPlayer.index, this.gameLogic.getPlayers());

    const oldPosition = currentPlayer.position;
    const newPosition = this.gameLogic.movePlayer(currentPlayer.index, steps);

    console.log(`🚶 ${currentPlayer.name} se déplace de ${oldPosition} à ${newPosition}`);

    // Animation avec suivi caméra
    await this.boardRenderer.animatePawnMove(currentPlayer.index, oldPosition, newPosition);
    this.updateBoard();

    // Pouvoir du Schmitt : son porteur distribue des gorgées aux joueurs
    // qu'il croise. C'est là son seul avantage — il lance un dé comme tout le
    // monde, contrairement à ce que faisait le code.
    if (currentPlayer.hasSchmittPower) {
      this.applySchmittPowerPass(currentPlayer, oldPosition, newPosition, steps);
    }

    // Laisser le temps de voir OÙ le pion s'est arrêté avant que la modale
    // d'effet ne recouvre le plateau. À 500ms l'arrivée passait inaperçue :
    // on lançait le dé, et la case tombait sans qu'on ait vu le déplacement.
    setTimeout(() => {
      this.applyTileEffect(newPosition);
    }, 1100);
  }

  private applyTileEffect(position: number): void {
    const currentPlayer = this.gameLogic.getCurrentPlayer();
    if (!currentPlayer) return;

    // L'effet vient de la case réellement posée à cette position, et non de
    // l'index du pion : c'est ce qui permet à un joueur de composer son propre
    // plateau. Sur le plateau officiel, dont les cases sont posées dans
    // l'ordre, le résultat est identique — sauf là où un tileId manquant
    // décalait l'effet par rapport à l'image affichée.
    const tileId = this.boardRenderer.getTileIdAtPosition(position);
    const tile = tileId !== null ? TILE_CONFIGS[tileId] : undefined;
    if (!tile) return;

    // Un seul texte, qui nomme le joueur et écrit les gorgées en 🍺
    // (SCH-11, SCH-12, SCH-13). Le sous-titre disparaît quand il ne fait que
    // répéter le titre, ce qui était le cas de la moitié des cases.
    const actionText = buildActionText(tile, currentPlayer.name);
    this.gameRenderer.showEffectModal(
      tile.icon,
      actionText ?? withGulpSymbol(tile.name),
      buildSubtitle(tile, actionText)
    );

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
          // La flèche impose SON sens, pas celui de marche du joueur : elle est
          // dessinée sur la case et envoie toujours du même côté. Sans cela un
          // joueur en phase de retour partait à l'opposé de ce qu'elle montre.
          const arrowDirection = tile.direction ?? 'forward';
          const newPos = this.gameLogic.movePlayerInDirection(
            currentPlayer.index,
            2,
            arrowDirection
          );
          const verb = arrowDirection === 'forward' ? 'avance' : 'recule';
          this.gameRenderer.showNotification(`${currentPlayer.name} ${verb} de 2 cases !`);

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
      case 'chicken':
      case 'big_chicken': {
        // Tomber sur la case fait de vous le Petit Poulet ; y retomber sans
        // qu'un autre joueur soit passé entre-temps vous promeut Grand Poulet.
        const rank = this.gameLogic.setChicken(currentPlayer.index);
        const title = rank >= 2 ? 'GRAND POULET' : 'PETIT POULET';
        this.gameRenderer.showNotification(
          `🐔 ${currentPlayer.name} devient le ${title} !`
        );
        break;
      }
      case 'copy':
        // MOUTON : le joueur suit un adversaire et vient se poser sur sa case.
        this.handleSheep(currentPlayer);
        return; // Attendre le choix de l'adversaire à copier
      case 'schmitt_call':
        // SCHMITT !!! : le dernier à crier boit 1 gorgée par joueur présent.
        // L'application n'entend pas les cris : elle demande qui a perdu.
        this.handleSchmittCall(currentPlayer);
        return; // Attendre la désignation du perdant
      case 'rule':
        // CRÉEZ UNE RÈGLE : le jeu ne peut pas l'appliquer, mais il la retient.
        this.handleCustomRule(currentPlayer);
        return; // Attendre la saisie de la règle
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
        // La dernière case ne fait pas gagner : elle donne le pouvoir du
        // Schmitt et déclenche le demi-tour. La victoire s'obtient en
        // revenant sur START.
        this.handleSchmittPowerClaim(currentPlayer);
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

    // Le tour n'avance QUE sur clic du joueur.
    //
    // Un minuteur enchaînait auparavant tout seul : le message d'une case
    // s'affichait une seconde puis disparaissait, sans laisser le temps de
    // lire la règle — c'est le reproche le plus fréquent des joueurs. Autour
    // d'une table, on lit à voix haute, on discute, puis on valide.
    //
    // Le délai reste dans la signature pour les appelants, mais n'est plus
    // utilisé : `delay` ne déclenche plus rien.
    void delay;

    // Si aucune modale n'est ouverte, rien n'attend le clic : on enchaîne.
    const modalOpen = this.isEffectModalOpen();
    if (!modalOpen) {
      action();
      return;
    }

    this.pendingModalAction = { timeoutId: 0, callback: action };
  }

  /** La modale d'effet est-elle visible à l'écran ? */
  private isEffectModalOpen(): boolean {
    const modal = document.getElementById('effectModal');
    if (!modal) return false;
    const display = window.getComputedStyle(modal).display;
    return display !== 'none';
  }

  /**
   * Gère la distribution de gorgées
   */
  private handleDistributeGulps(tileType: TileType): void {
    const currentPlayer = this.gameLogic.getCurrentPlayer();
    if (!currentPlayer) return;

    const gulpsCount = tileType === 'distribute_2' ? 2 : tileType === 'distribute_3' ? 3 : 4;

    // Pas de sélecteur de joueurs : autour d'une table, on désigne à voix
    // haute, et c'est bien plus rapide. L'application se contente d'annoncer
    // combien de gorgées sont à distribuer ; le décompte exact n'a pas besoin
    // d'être saisi, il se règle entre joueurs.
    this.gameRenderer.showNotification(
      `\u{1F381} ${currentPlayer.name} distribue ${gulpsCount} ${GULP} !`,
      3000
    );
    this.gameLogic.logEvent(`\u{1F381} ${currentPlayer.name} distribue ${gulpsCount} ${GULP}`);
    this.updateUI();

    this.scheduleNextTurn(2500);
  }

  /**
   * Le porteur du pouvoir du Schmitt distribue des gorgées aux joueurs
   * rencontrés sur son passage, à hauteur de la valeur du dé.
   */
  private applySchmittPowerPass(
    holder: Player,
    from: number,
    to: number,
    diceValue: number
  ): void {
    const low = Math.min(from, to);
    const high = Math.max(from, to);

    // Les joueurs croisés, case d'arrivée comprise
    const hit = this.gameLogic
      .getPlayers()
      .filter(p => p.index !== holder.index && p.position > low && p.position <= high);

    if (hit.length === 0) return;

    hit.forEach(p => this.gameLogic.addDrinks(p.index, diceValue));

    const names = hit.map(p => p.name).join(', ');
    this.gameLogic.logEvent(
      `\u{1F3C6} Pouvoir du Schmitt : ${names} ${hit.length > 1 ? 'boivent' : 'boit'} ${diceValue} ${GULP}`
    );
    this.gameRenderer.showNotification(
      `\u{1F3C6} ${holder.name} croise ${names} : ${diceValue} ${GULP} chacun !`,
      3000
    );
    this.updateUI();
  }

  /**
   * Applique la sentence du Poulet sur le jet qui vient d'être fait.
   * Le Petit Poulet boit ; le GROS POULET distribue, et choisit sa cible.
   */
  private applyChickenPenalty(roll: number): void {
    const verdict = this.gameLogic.applyChickenPenalty(roll);
    if (!verdict) return;

    // Une notification fugace passait inaperçue et le Poulet oubliait de
    // boire. Une fenêtre à valider garantit que personne ne saute la sentence.
    if (!verdict.distributes) {
      this.promptBigAnnounce(
        '🐔',
        'PETIT POULET',
        '1',
        `${GULP} à boire`,
        `${verdict.name} est le Petit Poulet : un ${roll} est sorti, il boit 1 ${GULP}.`,
        () => this.updateUI()
      );
      return;
    }

    this.promptBigAnnounce(
      '🐔',
      'GROS POULET',
      '1',
      `${GULP} à distribuer`,
      `${verdict.name} est le GROS POULET : un ${roll} est sorti, ` +
        `il distribue 1 ${GULP} au joueur de son choix.`,
      () => this.updateUI()
    );
  }

  /**
   * Le joueur atteint la dernière case et s'empare du pouvoir du Schmitt.
   *
   * C'est le pivot de la partie : tous les pions font demi-tour, et la
   * victoire ne s'obtient plus qu'en revenant exactement sur START. Le
   * pouvoir n'est attribué qu'une fois — les joueurs suivants qui passent
   * par là ne le reprennent pas.
   */
  private handleSchmittPowerClaim(currentPlayer: Player): void {
    const claimed = this.gameLogic.claimSchmittPower(currentPlayer.index);

    if (claimed) {
      this.gameRenderer.showNotification(
        `\u{1F3C6} ${currentPlayer.name} s'empare du POUVOIR DU SCHMITT ! Demi-tour, retour au START !`,
        3500
      );
      // Le joueur rejoue immédiatement, comme le veut la règle
      currentPlayer.canReplay = true;
      this.updateUI();
      this.updateBoard();
      this.scheduleNextTurn(3000);
      return;
    }

    // Le pouvoir est déjà pris : la case n'a plus d'effet
    this.gameRenderer.showNotification(
      `Le pouvoir du Schmitt appartient déjà à un autre joueur.`
    );
    this.scheduleNextTurn(2000);
  }

  /**
   * MOUTON — le joueur copie la case d'un adversaire et en subit l'effet.
   *
   * Il ne se déplace PAS : il reste où il est et rejoue simplement l'effet de
   * la case choisie. Copier le pouvoir des dieux lance donc les dés de faveur,
   * copier une case « boire » fait boire, etc.
   */
  private handleSheep(currentPlayer: Player): void {
    const others = this.gameLogic.getPlayers().filter(p => p.index !== currentPlayer.index);

    if (others.length === 0) {
      this.gameRenderer.showNotification('Aucun adversaire à copier : le mouton reste sur place.');
      this.scheduleNextTurn(2000);
      return;
    }

    // On propose les cases OCCUPÉES par les adversaires, pas les joueurs :
    // c'est une case que l'on copie, et deux joueurs peuvent partager la même.
    const seen = new Set<number>();
    const choices: { label: string; value: string }[] = [];

    others.forEach(p => {
      if (seen.has(p.position)) return;
      seen.add(p.position);

      const tileId = this.boardRenderer.getTileIdAtPosition(p.position);
      const tile = tileId !== null ? TILE_CONFIGS[tileId] : undefined;
      if (!tile) return;

      const who = others.filter(o => o.position === p.position).map(o => o.name).join(', ');
      choices.push({
        label: `${tile.icon} ${tile.name} — ${who}`,
        value: String(p.position)
      });
    });

    if (choices.length === 0) {
      this.gameRenderer.showNotification('Aucune case à copier.');
      this.scheduleNextTurn(2000);
      return;
    }

    this.gameRenderer.closeEffectModal();

    this.promptChoice(
      'Mouton',
      `${currentPlayer.name} copie la case d'un adversaire et en subit l'effet.`,
      choices,
      (picked) => {
        if (picked === null) {
          this.scheduleNextTurn(500);
          return;
        }

        const position = parseInt(picked, 10);
        const tileId = this.boardRenderer.getTileIdAtPosition(position);
        const tile = tileId !== null ? TILE_CONFIGS[tileId] : undefined;

        this.gameLogic.logEvent(
          `\u{1F411} ${currentPlayer.name} copie ${tile ? tile.name : 'une case'}`
        );

        // Garde-fou : copier une case MOUTON relancerait le choix sans fin.
        if (tile?.type === 'copy') {
          this.gameRenderer.showNotification(
            `\u{1F411} Un mouton qui copie un mouton : rien ne se passe !`,
            3000
          );
          this.scheduleNextTurn(2500);
          return;
        }

        // On applique l'effet de la case copiée SANS déplacer le pion
        this.applyTileEffect(position);
      }
    );
  }

  /**
   * SCHMITT !!! — tout le monde crie, le dernier boit 1 gorgée par joueur.
   *
   * L'application n'entend rien : elle se contente de demander qui a perdu,
   * puis applique l'arithmétique, que personne n'a envie de faire à voix haute
   * après quelques tours.
   */
  private handleSchmittCall(currentPlayer: Player): void {
    const players = this.gameLogic.getPlayers();
    // Le nombre de gorgées dépend des joueurs PRÉSENTS SUR LA CASE.
    const onTile = players.filter(p => p.position === currentPlayer.position);
    const gulps = Math.max(1, onTile.length);
    const names = onTile.map(p => p.name).join(', ');

    // Qui a crié en dernier se règle à voix haute, l'application ne le
    // demande plus. En revanche elle compte les joueurs sur la case, ce que
    // personne n'a envie de faire de tête au bout de quelques tours.
    this.promptBigAnnounce(
      '📢',
      'SCHMITT !!!',
      `${gulps}`,
      `${GULP} pour le dernier à crier`,
      `Tout le monde crie « SCHMITT ! » et place son pouce sur le front. ` +
        `${onTile.length} joueur${onTile.length > 1 ? 's' : ''} sur la case : ${names}.`,
      () => {
        this.gameLogic.logEvent(`\u{1F4E2} SCHMITT ! Le dernier boit ${gulps} ${GULP}`);
        this.prepareNextPlayerTurn();
      }
    );
  }

  /**
   * CRÉEZ UNE RÈGLE — le joueur invente une règle pour le reste de la partie.
   *
   * Le jeu ne peut pas l'appliquer, mais il l'écrit : une règle inventée au
   * tour 3 est systématiquement oubliée au tour 10 si rien ne la garde.
   */
  private handleCustomRule(currentPlayer: Player): void {
    this.gameRenderer.closeEffectModal();

    this.promptForRule(currentPlayer.name, (text) => {
      if (text) {
        this.gameLogic.addCustomRule(currentPlayer.name, text);
        this.gameRenderer.showNotification(
          `\u{1F4DC} Nouvelle règle : « ${text} »`,
          3000
        );
        this.renderActiveRules();
      }
      this.scheduleNextTurn(1500);
    });
  }

  /**
   * Ouvre le sélecteur de joueurs en garantissant un rappel unique.
   *
   * Le sélecteur peut être refermé à la croix ou en cliquant à côté : il
   * signale alors l'annulation, et l'appelant reçoit une sélection vide.
   * Sans cela, le tour attendrait un choix qui n'arrive jamais.
   */
  private withPlayerSelection(
    players: Player[],
    count: number,
    currentPlayerIndex: number,
    callback: (selected: Player[]) => void,
    options: { allowSelf?: boolean; title?: string } = {}
  ): void {
    let settled = false;
    const settle = (selected: Player[]): void => {
      if (settled) return;
      settled = true;
      callback(selected);
    };

    this.playerSelector.show(
      players,
      count,
      currentPlayerIndex,
      options.allowSelf ?? false,
      (selected) => settle(selected),
      () => settle([])
    );

    if (options.title) {
      const titleEl = document
        .getElementById('playerSelectorModal')
        ?.querySelector('.player-selector-title');
      if (titleEl) titleEl.textContent = options.title;
    }
  }

  /**
   * JUGEMENT DERNIER — le joueur garde l'un des 2 dés et relance l'autre.
   *
   * C'est un choix tactique : selon la faveur visée, on garde le dé qui
   * approche du total souhaité. Le code tirait deux dés au hasard, ce qui
   * supprimait toute décision.
   */
  private handleLastJudgement(currentPlayer: Player): void {
    const { a, b } = this.lastFavorDice;

    this.promptChoice(
      'Jugement Dernier',
      `Vos dés : ${a} et ${b}. Gardez-en un, l'autre sera relancé.`,
      [
        { label: `Garder le ${a}`, value: String(a) },
        { label: `Garder le ${b}`, value: String(b) }
      ],
      (kept) => {
        // Fermer sans choisir garde le premier dé : on ne bloque pas le tour
        const keptValue = kept !== null ? parseInt(kept, 10) : a;
        const reroll = Math.floor(Math.random() * 6) + 1;
        const sum = keptValue + reroll;

        this.gameLogic.logEvent(
          `\u{1F3B2} Jugement Dernier : ${currentPlayer.name} garde ${keptValue}, relance ${reroll}`
        );

        // Un double reste la colère des dieux, même après un Jugement Dernier
        if (keptValue === reroll) {
          this.gameRenderer.showNotification(
            `\u{274C} COLÈRE DES DIEUX ! Double ${reroll} : ${currentPlayer.name} reçoit 1 cul sec !`,
            3000
          );
          this.gameLogic.addDrinks(currentPlayer.index, 1);
          this.updateUI();
          this.scheduleNextTurn(3000);
          return;
        }

        this.gameRenderer.showNotification(
          `\u{1F3B2} ${keptValue} + ${reroll} = ${sum}`,
          2000
        );
        setTimeout(() => this.showGodFavorResult(sum), 1800);
      }
    );
  }

  /**
   * APOLLON — rejouer avec 2 dés, garder celui de son choix pour se déplacer,
   * et distribuer 1 gorgée à chaque adversaire dépassé.
   */
  private handleApollon(currentPlayer: Player): void {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;

    this.promptChoice(
      'Apollon',
      `Vous rejouez ! Dés : ${d1} et ${d2}. Choisissez celui qui vous déplace.`,
      [
        { label: `Avancer de ${d1}`, value: String(d1) },
        { label: `Avancer de ${d2}`, value: String(d2) }
      ],
      async (choice) => {
        const steps = choice !== null ? parseInt(choice, 10) : Math.max(d1, d2);
        const from = currentPlayer.position;

        const to = this.gameLogic.movePlayer(currentPlayer.index, steps);

        // 1 gorgée à chaque adversaire dépassé, dans le sens du déplacement
        const low = Math.min(from, to);
        const high = Math.max(from, to);
        const passed = this.gameLogic
          .getPlayers()
          .filter(p => p.index !== currentPlayer.index && p.position > low && p.position < high);

        passed.forEach(p => this.gameLogic.addDrinks(p.index, 1));

        await this.boardRenderer.animatePawnMove(currentPlayer.index, from, to);
        this.updateBoard();

        if (passed.length > 0) {
          const names = passed.map(p => p.name).join(', ');
          this.gameRenderer.showNotification(
            `\u{2600}\u{FE0F} ${currentPlayer.name} dépasse ${names} : 1 ${GULP} chacun !`,
            2800
          );
          this.gameLogic.logEvent(`\u{2600}\u{FE0F} Apollon : ${names} boivent 1 ${GULP}`);
        }

        this.updateUI();
        // La case d'arrivée agit à son tour
        this.scheduleModalAction(1600, () => this.applyTileEffect(to));
      }
    );
  }

  /**
   * ZEUS — faveur suprême : le joueur choisit la faveur qu'il veut.
   * Le code en tirait une au hasard, ce qui en faisait l'inverse d'une faveur
   * suprême.
   */
  private handleZeus(): void {
    // Toutes les faveurs sauf la colère (2) et Zeus lui-même (12)
    const choices = [3, 4, 5, 6, 7, 8, 9, 10, 11].map(sum => ({
      label: `${GOD_FAVORS[sum].icon} ${GOD_FAVORS[sum].name}`,
      value: String(sum)
    }));

    this.promptChoice(
      'Zeus — Faveur suprême',
      'Choisissez la faveur que vous souhaitez invoquer.',
      choices,
      (picked) => {
        const sum = picked !== null ? parseInt(picked, 10) : 7;
        this.showGodFavorResult(sum);
      }
    );
  }

  /**
   * Annonce en grand, à lire depuis l'autre bout de la table.
   *
   * Le chiffre occupe l'essentiel de la fenêtre : c'est l'information qui
   * compte dans une soirée, et elle doit se lire d'un coup d'œil, sans que
   * personne ait à s'approcher de l'écran. La fenêtre attend un clic.
   */
  private promptBigAnnounce(
    icon: string,
    title: string,
    bigValue: string,
    bigLabel: string,
    hint: string,
    done: () => void
  ): void {
    const overlay = document.createElement('div');
    overlay.className = 'rule-prompt';

    const content = document.createElement('div');
    content.className = 'rule-prompt-content ds-surface announce';

    const h = document.createElement('h2');
    h.className = 'ds-title';
    h.textContent = `${icon} ${title}`;
    content.appendChild(h);

    const big = document.createElement('div');
    big.className = 'announce-big';
    big.textContent = bigValue;
    content.appendChild(big);

    const lbl = document.createElement('div');
    lbl.className = 'announce-label';
    lbl.textContent = bigLabel;
    content.appendChild(lbl);

    if (hint) {
      const pEl = document.createElement('p');
      pEl.className = 'rule-prompt-hint';
      pEl.textContent = hint;
      content.appendChild(pEl);
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ds-btn ds-btn--gold announce-ok';
    btn.textContent = "C'est fait";

    let settled = false;
    btn.addEventListener('click', () => {
      if (settled) return;
      settled = true;
      overlay.remove();
      done();
    });

    content.appendChild(btn);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
  }

  /**
   * Demande un choix au joueur dans une modale aux couleurs du jeu.
   *
   * Plusieurs faveurs reposent sur une décision — garder un dé, choisir une
   * faveur. Les tirer au hasard, comme le faisait le code, retire au joueur
   * précisément ce qui fait l'intérêt de la case.
   */
  private promptChoice(
    title: string,
    hint: string,
    choices: { label: string; value: string }[],
    done: (value: string | null) => void
  ): void {
    const overlay = document.createElement('div');
    overlay.className = 'rule-prompt';
    const content = document.createElement('div');
    content.className = 'rule-prompt-content ds-surface';

    const h = document.createElement('h2');
    h.className = 'ds-title';
    h.textContent = title;
    content.appendChild(h);

    if (hint) {
      const p = document.createElement('p');
      p.className = 'rule-prompt-hint';
      p.textContent = hint;
      content.appendChild(p);
    }

    const list = document.createElement('div');
    // Au-delà de 4 options (Zeus), deux colonnes évitent une liste à rallonge
    list.className = choices.length > 4 ? 'choice-list choice-list--dense' : 'choice-list';

    let settled = false;
    const close = (value: string | null): void => {
      if (settled) return;
      settled = true;
      overlay.remove();
      done(value);
    };

    choices.forEach((choice, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = i === 0 ? 'ds-btn ds-btn--gold' : 'ds-btn';
      btn.textContent = choice.label;
      btn.addEventListener('click', () => close(choice.value));
      list.appendChild(btn);
    });

    content.appendChild(list);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
  }

  /**
   * Affiche une règle qui se joue à la table et attend que les joueurs aient
   * fini avant de reprendre le tour.
   *
   * L'application ne peut ni voir un pouce levé ni savoir quand on arrête de
   * boire : elle énonce la règle, puis rend la main quand on le lui dit. Un
   * enchaînement automatique couperait le jeu au milieu.
   */
  private promptTableRule(title: string, text: string, done: () => void): void {
    this.promptChoice(title, text, [{ label: 'C\'est fait', value: 'ok' }], () => done());
  }

  /**
   * Demande une règle au joueur dans une modale aux couleurs du jeu.
   * `prompt()` est bloqué par certaines WebView Android et casse l'immersion.
   */
  private promptForRule(authorName: string, done: (text: string | null) => void): void {
    const overlay = document.createElement('div');
    overlay.className = 'rule-prompt';
    overlay.innerHTML = `
      <div class="rule-prompt-content ds-surface">
        <h2 class="ds-title">Créez une règle</h2>
        <p class="rule-prompt-hint">${authorName} invente une règle pour le reste de la partie.</p>
        <input type="text" class="ds-field rule-prompt-input" maxlength="140"
               placeholder="Interdit de dire « oui »…" />
        <div class="rule-prompt-actions">
          <button type="button" class="ds-btn rule-prompt-skip">Passer</button>
          <button type="button" class="ds-btn ds-btn--gold rule-prompt-ok">Valider</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('.rule-prompt-input') as HTMLInputElement;
    let settled = false;
    const close = (text: string | null): void => {
      if (settled) return;
      settled = true;
      overlay.remove();
      done(text);
    };

    overlay.querySelector('.rule-prompt-ok')?.addEventListener('click', () => {
      close(input.value.trim() || null);
    });
    overlay.querySelector('.rule-prompt-skip')?.addEventListener('click', () => close(null));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') close(input.value.trim() || null);
    });

    // Le focus déclenche le clavier tactile sans geste supplémentaire.
    setTimeout(() => input.focus(), 50);
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
        let message = `🔱 ${target.name} boit ${maxDice} ${GULP} !`;

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
          message += ` Ses voisins (${neighborNames.join(' et ')}) boivent ${minDice} ${GULP} chacun !`;
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
    // Les descriptions des faveurs reprennent le texte des règles officielles :
    // on y substitue 🍺 à l'affichage plutôt que de les réécrire (SCH-12).
    this.gameRenderer.showEffectModal(
      favor.icon,
      favor.name,
      withGulpSymbol(favor.description)
    );

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

      case 3: // JUGEMENT DERNIER — garder un dé, relancer l'autre
        this.handleLastJudgement(currentPlayer);
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

      case 7: // APOLLON — rejouer avec 2 dés, garder celui de son choix
        this.handleApollon(currentPlayer);
        break;

      case 8: // ARÈS — se joue à la table, l'app énonce et attend
        this.promptTableRule(
          'Arès',
          `Tous les joueurs placent leur pouce vers le haut ou vers le bas en même temps. ` +
          `Ceux qui font l'inverse de ${currentPlayer.name} reçoivent autant de ${GULP} ` +
          `que le nombre de joueurs ayant fait comme lui.`,
          () => this.prepareNextPlayerTurn()
        );
        break;

      case 9: // DIONYSOS — se joue à la table : c'est une durée, pas un nombre
        this.promptTableRule(
          'Dionysos',
          `Tous les joueurs trinquent, puis continuent de boire avec ${currentPlayer.name} ` +
          `jusqu'à ce que lui seul décide d'arrêter.`,
          () => this.prepareNextPlayerTurn()
        );
        break;

      case 10: // HÉPHAÏSTOS — se joue à la table
        this.promptTableRule(
          'Héphaïstos',
          `${currentPlayer.name} place 2 shooters sur des cases différentes du plateau. ` +
          `Le premier joueur à tomber sur l'une d'elles boit le shooter immédiatement, ` +
          `puis applique l'effet de la case.`,
          () => this.prepareNextPlayerTurn()
        );
        break;

      case 11: // Poséidon - cibler un joueur et ses voisins
        this.handlePoseidonPower(currentPlayer);
        break;

      case 12: // ZEUS — faveur suprême : le joueur CHOISIT
        this.handleZeus();
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
    // On garde la tablée en place : rejouer avec les mêmes personnes est le cas courant
    this.renderPlayerInputs();
  }

  private updateUI(): void {
    const players = this.gameLogic.getPlayers();
    const currentIndex = this.gameLogic.getCurrentPlayerIndex();
    const history = this.gameLogic.getHistory();

    this.gameRenderer.updatePlayerList(players, currentIndex);
    this.gameRenderer.updateHistory(history);
    this.updateTurnBanner();
    this.renderHistory(history);
    this.updateBoard();
  }

  /**
   * Bandeau du joueur courant : son nom et sa couleur.
   * Auparavant le HTML affichait « Joueur 1 » en dur, quel que soit le tour.
   */
  private updateTurnBanner(): void {
    const player = this.gameLogic.getCurrentPlayer();
    if (!player) return;

    const name = document.getElementById('currentPlayerName');
    const dot = document.getElementById('currentPlayerDot');
    if (name) name.textContent = player.name;
    if (dot) dot.style.background = player.color;
  }

  /**
   * Affiche les règles inventées dans le tiroir.
   * Le bloc disparaît tant qu'aucune règle n'existe, pour ne pas encombrer.
   */
  private renderActiveRules(): void {
    const panel = document.getElementById('rulesPanel');
    const list = document.getElementById('rulesList');
    if (!panel || !list) return;

    const rules = this.gameLogic.getCustomRules();
    panel.hidden = rules.length === 0;

    list.innerHTML = '';
    rules.forEach((rule) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="rule-author"></span> <span class="rule-text"></span>`;
      (li.querySelector('.rule-author') as HTMLElement).textContent = rule.author;
      (li.querySelector('.rule-text') as HTMLElement).textContent = rule.text;
      list.appendChild(li);
    });
  }

  private renderHistory(history: string[]): void {
    const list = document.getElementById('historyList');
    if (!list) return;

    list.innerHTML = '';
    if (history.length === 0) {
      const li = document.createElement('li');
      li.className = 'is-empty';
      li.textContent = 'Aucune action pour le moment';
      list.appendChild(li);
      return;
    }

    // Le plus récent en haut : c'est ce qu'on vient de vouloir vérifier
    [...history].reverse().forEach((entry) => {
      const li = document.createElement('li');
      li.textContent = entry;
      list.appendChild(li);
    });
  }

  /** Ouvre ou ferme le tiroir des actions secondaires. */
  private toggleDrawer(open: boolean): void {
    const drawer = document.getElementById('actionDrawer');
    const backdrop = document.getElementById('drawerBackdrop');
    const trigger = document.getElementById('menuBtn');
    if (!drawer || !backdrop) return;

    drawer.hidden = !open;
    backdrop.hidden = !open;
    trigger?.setAttribute('aria-expanded', String(open));

    // L'historique repart replié à chaque ouverture : le tiroir doit rester court
    if (!open) {
      const panel = document.getElementById('historyPanel');
      if (panel) panel.hidden = true;
    }
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
