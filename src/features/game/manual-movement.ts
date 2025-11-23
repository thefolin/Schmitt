/**
 * Gestionnaire de déplacement manuel de joueurs
 */

import type { Player } from '@/core/models/Player';

export interface MovementChoice {
  player: Player;
  newPosition: number;
  direction: 'forward' | 'backward';
  applyEffect: boolean; // Appliquer l'effet de la case d'arrivée
}

export class ManualMovement {
  private modal: HTMLElement | null = null;
  private currentCallback: ((choices: MovementChoice[]) => void) | null = null;
  private selectedPlayer: Player | null = null;
  private movements: Map<number, MovementChoice> = new Map();
  private requiredCount: number = 0;
  private playersToMove: Player[] = [];
  private allPlayers: Player[] = [];
  private selectedPlayersForMovement: Set<number> = new Set();

  constructor() {
    this.createModal();
  }

  /**
   * Crée la modal de déplacement manuel
   */
  private createModal(): void {
    this.modal = document.createElement('div');
    this.modal.id = 'manualMovementModal';
    this.modal.className = 'manual-movement-panel';
    this.modal.innerHTML = `
      <div class="manual-movement-content">
        <div class="panel-header">
          <h2 class="manual-movement-title">🎯 Déplacement manuel</h2>
          <button class="close-manual-movement">&times;</button>
        </div>

        <!-- Étape 1 : Sélection des joueurs -->
        <div class="step-container" id="step1" style="display: block;">
          <p class="step-title">Étape 1 : Sélectionnez les joueurs à déplacer</p>
          <div class="player-selection-grid" id="playerSelectionGrid"></div>
          <div class="panel-actions">
            <button class="btn btn-secondary" id="cancelBtn">Annuler</button>
            <button class="btn btn-primary" id="nextStepBtn" disabled>Suivant</button>
          </div>
        </div>

        <!-- Étape 2 : Configuration des déplacements -->
        <div class="step-container" id="step2" style="display: none;">
          <p class="step-title">Étape 2 : Configurez le déplacement de chaque joueur</p>

          <!-- Liste des joueurs à configurer -->
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
              <input type="number" id="movementSteps" min="1" max="23" value="1" />
              <button class="stepper-btn" id="increaseSteps">+</button>
            </div>
          </div>

          <div class="apply-effect-group">
            <label class="checkbox-label">
              <input type="checkbox" id="applyEffectCheckbox" checked />
              <span>Appliquer l'effet de la case d'arrivée</span>
            </label>
            <p class="help-text">Si décoché, le joueur sera déplacé sans activer l'effet de la case</p>
          </div>

          <button class="btn btn-primary apply-movement" id="applyMovement">
            Appliquer ce déplacement
          </button>
        </div>

          <div class="panel-actions">
            <button class="btn btn-secondary" id="backBtn">Retour</button>
            <button class="btn btn-success" id="confirmAllMovements" disabled>Confirmer tous les déplacements</button>
          </div>
        </div>
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

    // Fermer le panel
    const closeBtn = this.modal.querySelector('.close-manual-movement');
    closeBtn?.addEventListener('click', () => this.hide());

    // Bouton annuler (étape 1)
    const cancelBtn = this.modal.querySelector('#cancelBtn');
    cancelBtn?.addEventListener('click', () => this.hide());

    // Bouton suivant (étape 1 -> 2)
    const nextBtn = this.modal.querySelector('#nextStepBtn');
    nextBtn?.addEventListener('click', () => this.goToStep2());

    // Bouton retour (étape 2 -> 1)
    const backBtn = this.modal.querySelector('#backBtn');
    backBtn?.addEventListener('click', () => this.goToStep1());

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
      if (current < 23) stepsInput.value = (current + 1).toString();
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
    this.allPlayers = [...players];
    this.currentCallback = callback;
    this.movements.clear();
    this.selectedPlayer = null;
    this.selectedPlayersForMovement.clear();
    this.playersToMove = [];

    // Afficher l'étape 1
    this.goToStep1();

    // Rendre la grille de sélection
    this.renderPlayerSelectionGrid();

    if (this.modal) {
      this.modal.classList.add('show');
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
      let status = '';
      if (movement) {
        const steps = Math.abs(movement.newPosition - player.position);
        const direction = movement.direction === 'forward' ? '⏩ Avant' : '⏪ Arrière';
        const effect = movement.applyEffect ? '✨ Avec effet' : '🚫 Sans effet';
        status = `✓ ${direction} ${steps} case${steps > 1 ? 's' : ''} | ${effect}`;
      } else {
        status = '⚠️ Non configuré';
      }

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

    // Retirer la classe selected de toutes les cartes
    const allCards = this.modal?.querySelectorAll('.player-movement-card');
    allCards?.forEach(card => card.classList.remove('selected'));

    // Ajouter la classe selected à la carte du joueur sélectionné
    const selectedCard = Array.from(allCards || []).find(card => {
      const nameEl = card.querySelector('.player-movement-name');
      return nameEl?.textContent === player.name;
    });
    selectedCard?.classList.add('selected');

    // Afficher les contrôles
    const controlsEl = this.modal?.querySelector('#movementControls') as HTMLElement;
    if (controlsEl) controlsEl.style.display = 'block';

    // Mettre à jour le nom
    const nameEl = this.modal?.querySelector('#selectedPlayerName');
    if (nameEl) nameEl.textContent = `${player.name} (Case ${player.position})`;

    // Si un mouvement existe déjà, le charger
    const movement = this.movements.get(player.index);
    const stepsInput = this.modal?.querySelector('#movementSteps') as HTMLInputElement;
    const applyEffectCheckbox = this.modal?.querySelector('#applyEffectCheckbox') as HTMLInputElement;

    if (movement) {
      this.selectDirection(movement.direction);
      if (stepsInput) {
        stepsInput.value = Math.abs(movement.newPosition - player.position).toString();
      }
      if (applyEffectCheckbox) {
        applyEffectCheckbox.checked = movement.applyEffect;
      }
    } else {
      this.selectDirection('forward');
      if (stepsInput) stepsInput.value = '1';
      if (applyEffectCheckbox) applyEffectCheckbox.checked = true;
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

    const applyEffectCheckbox = this.modal?.querySelector('#applyEffectCheckbox') as HTMLInputElement;
    const applyEffect = applyEffectCheckbox?.checked ?? true;

    const movement = direction === 'forward' ? steps : -steps;
    const newPosition = Math.max(0, Math.min(23, this.selectedPlayer.position + movement));

    this.movements.set(this.selectedPlayer.index, {
      player: this.selectedPlayer,
      newPosition: newPosition,
      direction: direction,
      applyEffect: applyEffect
    });

    this.renderPlayerList();
    this.updateConfirmButton();
  }

  /**
   * Met à jour le bouton de confirmation
   */
  private updateConfirmButton(): void {
    const confirmBtn = this.modal?.querySelector('#confirmAllMovements') as HTMLButtonElement;
    if (!confirmBtn) return;

    const configuredCount = this.movements.size;
    const totalCount = this.requiredCount;

    if (configuredCount === totalCount && totalCount > 0) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = `Confirmer tous les déplacements (${configuredCount}/${totalCount})`;
    } else {
      confirmBtn.disabled = true;
      confirmBtn.textContent = `Confirmer tous les déplacements (${configuredCount}/${totalCount})`;
    }
  }

  /**
   * Confirme tous les déplacements
   */
  private confirmAll(): void {
    if (this.movements.size !== this.requiredCount) return;

    const choices = Array.from(this.movements.values());

    // IMPORTANT : Appeler le callback AVANT de cacher le panel (sinon currentCallback sera null)
    if (this.currentCallback) {
      this.currentCallback(choices);
    }

    // Cacher le panel APRÈS avoir appelé le callback
    this.hide();
  }

  /**
   * Cache le panel
   */
  private hide(): void {
    if (this.modal) {
      this.modal.classList.remove('show');
    }
    this.movements.clear();
    this.selectedPlayer = null;
    this.selectedPlayersForMovement.clear();
    this.currentCallback = null;
  }

  /**
   * Passe à l'étape 1 (sélection des joueurs)
   */
  private goToStep1(): void {
    const step1 = this.modal?.querySelector('#step1') as HTMLElement;
    const step2 = this.modal?.querySelector('#step2') as HTMLElement;
    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
  }

  /**
   * Passe à l'étape 2 (configuration des déplacements)
   */
  private goToStep2(): void {
    // Récupérer les joueurs sélectionnés
    this.playersToMove = this.allPlayers.filter(p => this.selectedPlayersForMovement.has(p.index));
    this.requiredCount = this.playersToMove.length;

    // Passer à l'étape 2
    const step1 = this.modal?.querySelector('#step1') as HTMLElement;
    const step2 = this.modal?.querySelector('#step2') as HTMLElement;
    if (step1) step1.style.display = 'none';
    if (step2) step2.style.display = 'block';

    // Rendre la liste des joueurs à configurer
    this.renderPlayerList();

    // Mettre à jour le bouton de confirmation
    this.updateConfirmButton();

    // Sélectionner automatiquement le premier joueur
    if (this.playersToMove.length > 0) {
      setTimeout(() => {
        this.selectPlayer(this.playersToMove[0]);
      }, 100);
    }
  }

  /**
   * Rend la grille de sélection de joueurs (étape 1)
   */
  private renderPlayerSelectionGrid(): void {
    const gridEl = this.modal?.querySelector('#playerSelectionGrid');
    if (!gridEl) return;

    gridEl.innerHTML = '';

    this.allPlayers.forEach((player) => {
      const card = document.createElement('div');
      card.className = 'player-selection-card';
      card.style.borderColor = player.color;

      if (this.selectedPlayersForMovement.has(player.index)) {
        card.classList.add('selected');
      }

      card.innerHTML = `
        <div class="player-selection-name">${player.name}</div>
        <div class="player-selection-info">Case ${player.position}</div>
      `;

      card.addEventListener('click', () => {
        if (this.selectedPlayersForMovement.has(player.index)) {
          this.selectedPlayersForMovement.delete(player.index);
          card.classList.remove('selected');
        } else {
          this.selectedPlayersForMovement.add(player.index);
          card.classList.add('selected');
        }
        this.updateNextButton();
      });

      gridEl.appendChild(card);
    });

    this.updateNextButton();
  }

  /**
   * Met à jour l'état du bouton "Suivant"
   */
  private updateNextButton(): void {
    const nextBtn = this.modal?.querySelector('#nextStepBtn') as HTMLButtonElement;
    if (!nextBtn) return;

    if (this.selectedPlayersForMovement.size > 0) {
      nextBtn.disabled = false;
      nextBtn.textContent = `Suivant (${this.selectedPlayersForMovement.size} joueur${this.selectedPlayersForMovement.size > 1 ? 's' : ''})`;
    } else {
      nextBtn.disabled = true;
      nextBtn.textContent = 'Suivant';
    }
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
