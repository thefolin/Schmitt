/**
 * Gestionnaire de déplacement manuel de joueurs
 */

import type { Player } from '@/core/models/Player';

export interface MovementChoice {
  player: Player;
  newPosition: number;
  direction: 'forward' | 'backward';
}

export class ManualMovement {
  private modal: HTMLElement | null = null;
  private currentCallback: ((choices: MovementChoice[]) => void) | null = null;
  private selectedPlayer: Player | null = null;
  private movements: Map<number, MovementChoice> = new Map();
  private requiredCount: number = 0;
  private playersToMove: Player[] = [];

  constructor() {
    this.createModal();
  }

  /**
   * Crée la modal de déplacement manuel
   */
  private createModal(): void {
    this.modal = document.createElement('div');
    this.modal.id = 'manualMovementModal';
    this.modal.className = 'manual-movement-modal';
    this.modal.innerHTML = `
      <div class="manual-movement-content">
        <button class="close-manual-movement">&times;</button>
        <h2 class="manual-movement-title">Déplacement manuel</h2>
        <p class="manual-movement-subtitle">Configurez le déplacement de chaque joueur</p>

        <!-- Liste des joueurs à déplacer -->
        <div class="player-movement-list" id="playerMovementList"></div>

        <!-- Contrôles de déplacement pour le joueur sélectionné -->
        <div class="movement-controls" id="movementControls" style="display: none;">
          <h3 class="selected-player-name" id="selectedPlayerName"></h3>

          <div class="direction-selector">
            <button class="direction-btn" id="directionForward" data-direction="forward">
              ⏩ Avant
            </button>
            <button class="direction-btn" id="directionBackward" data-direction="backward">
              ⏪ Arrière
            </button>
          </div>

          <div class="position-input-group">
            <label for="movementSteps">Nombre de cases :</label>
            <div class="number-stepper">
              <button class="stepper-btn" id="decreaseSteps">-</button>
              <input type="number" id="movementSteps" min="1" max="6" value="1" />
              <button class="stepper-btn" id="increaseSteps">+</button>
            </div>
          </div>

          <button class="btn btn-primary apply-movement" id="applyMovement">
            Appliquer
          </button>
        </div>

        <button class="btn btn-success confirm-all-movements" id="confirmAllMovements" style="display: none;">
          Confirmer tous les déplacements
        </button>
      </div>
    `;
    document.body.appendChild(this.modal);

    this.setupEventListeners();
  }

  /**
   * Configure les écouteurs d'événements
   */
  private setupEventListeners(): void {
    if (!this.modal) return;

    // Fermer la modal
    const closeBtn = this.modal.querySelector('.close-manual-movement');
    closeBtn?.addEventListener('click', () => this.hide());

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.hide();
    });

    // Boutons de direction
    const forwardBtn = this.modal.querySelector('#directionForward');
    const backwardBtn = this.modal.querySelector('#directionBackward');

    forwardBtn?.addEventListener('click', () => {
      this.selectDirection('forward');
    });

    backwardBtn?.addEventListener('click', () => {
      this.selectDirection('backward');
    });

    // Stepper de nombre de cases
    const decreaseBtn = this.modal.querySelector('#decreaseSteps');
    const increaseBtn = this.modal.querySelector('#increaseSteps');
    const stepsInput = this.modal.querySelector('#movementSteps') as HTMLInputElement;

    decreaseBtn?.addEventListener('click', () => {
      const current = parseInt(stepsInput.value) || 1;
      if (current > 1) stepsInput.value = (current - 1).toString();
    });

    increaseBtn?.addEventListener('click', () => {
      const current = parseInt(stepsInput.value) || 1;
      if (current < 6) stepsInput.value = (current + 1).toString();
    });

    // Appliquer le déplacement
    const applyBtn = this.modal.querySelector('#applyMovement');
    applyBtn?.addEventListener('click', () => this.applyMovement());

    // Confirmer tous les déplacements
    const confirmBtn = this.modal.querySelector('#confirmAllMovements');
    confirmBtn?.addEventListener('click', () => this.confirmAll());
  }

  /**
   * Affiche le gestionnaire de déplacement manuel
   */
  public show(
    players: Player[],
    callback: (choices: MovementChoice[]) => void
  ): void {
    this.playersToMove = [...players];
    this.requiredCount = players.length;
    this.currentCallback = callback;
    this.movements.clear();
    this.selectedPlayer = null;

    this.renderPlayerList();
    this.updateConfirmButton();

    if (this.modal) {
      this.modal.style.display = 'flex';
    }
  }

  /**
   * Affiche la liste des joueurs à déplacer
   */
  private renderPlayerList(): void {
    const listEl = this.modal?.querySelector('#playerMovementList');
    if (!listEl) return;

    listEl.innerHTML = '';

    this.playersToMove.forEach((player) => {
      const card = document.createElement('div');
      card.className = 'player-movement-card';
      card.style.borderColor = player.color;

      const movement = this.movements.get(player.index);
      const status = movement
        ? `✓ ${movement.direction === 'forward' ? 'Avant' : 'Arrière'} ${Math.abs(
            movement.newPosition - player.position
          )} cases`
        : '⚠️ Non configuré';

      card.innerHTML = `
        <div class="player-movement-name">${player.name}</div>
        <div class="player-movement-status">${status}</div>
      `;

      if (movement) {
        card.classList.add('configured');
      }

      card.addEventListener('click', () => {
        this.selectPlayer(player);
      });

      listEl.appendChild(card);
    });
  }

  /**
   * Sélectionne un joueur pour configurer son déplacement
   */
  private selectPlayer(player: Player): void {
    this.selectedPlayer = player;

    // Afficher les contrôles
    const controlsEl = this.modal?.querySelector('#movementControls') as HTMLElement;
    if (controlsEl) controlsEl.style.display = 'block';

    // Mettre à jour le nom
    const nameEl = this.modal?.querySelector('#selectedPlayerName');
    if (nameEl) nameEl.textContent = `${player.name} (Case ${player.position})`;

    // Si un mouvement existe déjà, le charger
    const movement = this.movements.get(player.index);
    if (movement) {
      this.selectDirection(movement.direction);
      const stepsInput = this.modal?.querySelector('#movementSteps') as HTMLInputElement;
      if (stepsInput) {
        stepsInput.value = Math.abs(movement.newPosition - player.position).toString();
      }
    } else {
      this.selectDirection('forward');
      const stepsInput = this.modal?.querySelector('#movementSteps') as HTMLInputElement;
      if (stepsInput) stepsInput.value = '1';
    }
  }

  /**
   * Sélectionne la direction
   */
  private selectDirection(direction: 'forward' | 'backward'): void {
    const forwardBtn = this.modal?.querySelector('#directionForward');
    const backwardBtn = this.modal?.querySelector('#directionBackward');

    if (direction === 'forward') {
      forwardBtn?.classList.add('selected');
      backwardBtn?.classList.remove('selected');
    } else {
      forwardBtn?.classList.remove('selected');
      backwardBtn?.classList.add('selected');
    }
  }

  /**
   * Applique le déplacement au joueur sélectionné
   */
  private applyMovement(): void {
    if (!this.selectedPlayer) return;

    const stepsInput = this.modal?.querySelector('#movementSteps') as HTMLInputElement;
    const steps = parseInt(stepsInput.value) || 1;

    const forwardBtn = this.modal?.querySelector('#directionForward');
    const direction = forwardBtn?.classList.contains('selected') ? 'forward' : 'backward';

    const movement = direction === 'forward' ? steps : -steps;
    const newPosition = Math.max(0, Math.min(23, this.selectedPlayer.position + movement));

    this.movements.set(this.selectedPlayer.index, {
      player: this.selectedPlayer,
      newPosition: newPosition,
      direction: direction
    });

    this.renderPlayerList();
    this.updateConfirmButton();

    // Auto-confirmer si tous les joueurs sont configurés
    if (this.movements.size === this.requiredCount) {
      const confirmBtn = this.modal?.querySelector('#confirmAllMovements') as HTMLElement;
      if (confirmBtn) confirmBtn.style.display = 'block';
    }
  }

  /**
   * Met à jour le bouton de confirmation
   */
  private updateConfirmButton(): void {
    const confirmBtn = this.modal?.querySelector('#confirmAllMovements') as HTMLElement;
    if (!confirmBtn) return;

    if (this.movements.size === this.requiredCount) {
      confirmBtn.style.display = 'block';
    } else {
      confirmBtn.style.display = 'none';
    }
  }

  /**
   * Confirme tous les déplacements
   */
  private confirmAll(): void {
    if (this.movements.size !== this.requiredCount) return;

    const choices = Array.from(this.movements.values());
    this.hide();

    if (this.currentCallback) {
      this.currentCallback(choices);
    }
  }

  /**
   * Cache la modal
   */
  private hide(): void {
    if (this.modal) {
      this.modal.style.display = 'none';
    }
    this.movements.clear();
    this.selectedPlayer = null;
    this.currentCallback = null;
  }

  /**
   * Nettoie les ressources
   */
  public destroy(): void {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}
