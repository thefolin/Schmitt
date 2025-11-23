/**
 * Gestionnaire de sélection de joueurs pour les pouvoirs des dieux
 */

import type { Player } from '@/core/models/Player';

export class PlayerSelector {
  private modal: HTMLElement | null = null;
  private currentCallback: ((selected: Player[]) => void) | null = null;
  private selectedPlayers: Player[] = [];
  private requiredCount: number = 0;

  constructor() {
    this.createModal();
  }

  /**
   * Crée la modal de sélection
   */
  private createModal(): void {
    this.modal = document.createElement('div');
    this.modal.id = 'playerSelectorModal';
    this.modal.className = 'player-selector-modal';
    this.modal.innerHTML = `
      <div class="player-selector-content">
        <button class="close-player-selector">&times;</button>
        <h2 class="player-selector-title">Choisissez un joueur</h2>
        <p class="player-selector-subtitle">Sélectionnez 1 joueur</p>
        <div class="player-selector-grid" id="playerSelectorGrid"></div>
        <button class="btn btn-primary player-selector-confirm" id="confirmSelection" style="display: none;">
          Confirmer
        </button>
      </div>
    `;
    document.body.appendChild(this.modal);

    // Fermer au clic sur la croix
    const closeBtn = this.modal.querySelector('.close-player-selector');
    closeBtn?.addEventListener('click', () => {
      this.hide();
    });

    // Fermer au clic en dehors
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    // Bouton de confirmation
    const confirmBtn = this.modal.querySelector('#confirmSelection');
    confirmBtn?.addEventListener('click', () => {
      if (this.selectedPlayers.length === this.requiredCount) {
        this.confirm();
      }
    });
  }

  /**
   * Affiche le sélecteur de joueurs
   */
  public show(
    players: Player[],
    count: number,
    currentPlayerIndex: number,
    allowSelf: boolean,
    callback: (selected: Player[]) => void
  ): void {
    this.requiredCount = count;
    this.currentCallback = callback;
    this.selectedPlayers = [];

    // Filtrer les joueurs disponibles
    const availablePlayers = allowSelf
      ? players
      : players.filter((p) => p.index !== currentPlayerIndex);

    // Mettre à jour le titre
    const titleEl = this.modal?.querySelector('.player-selector-title');
    const subtitleEl = this.modal?.querySelector('.player-selector-subtitle');
    if (titleEl) {
      titleEl.textContent = count > 1 ? 'Choisissez des joueurs' : 'Choisissez un joueur';
    }
    if (subtitleEl) {
      subtitleEl.textContent = `Sélectionnez ${count} joueur${count > 1 ? 's' : ''}`;
    }

    // Créer la grille de sélection
    const gridEl = this.modal?.querySelector('#playerSelectorGrid');
    if (!gridEl) return;

    gridEl.innerHTML = '';

    availablePlayers.forEach((player) => {
      const playerCard = document.createElement('div');
      playerCard.className = 'player-selector-card';
      playerCard.style.borderColor = player.color;
      playerCard.innerHTML = `
        <div class="player-selector-name">${player.name}</div>
        <div class="player-selector-stats">
          <span>📍 Case ${player.position}</span>
          <span>🍺 ${player.drinks} gorgées</span>
        </div>
      `;

      playerCard.addEventListener('click', () => {
        this.togglePlayerSelection(player, playerCard);
      });

      gridEl.appendChild(playerCard);
    });

    // Afficher la modal
    if (this.modal) {
      this.modal.style.display = 'flex';
    }
  }

  /**
   * Bascule la sélection d'un joueur
   */
  private togglePlayerSelection(player: Player, card: HTMLElement): void {
    const index = this.selectedPlayers.findIndex((p) => p.index === player.index);

    if (index >= 0) {
      // Désélectionner
      this.selectedPlayers.splice(index, 1);
      card.classList.remove('selected');
    } else {
      // Sélectionner
      if (this.selectedPlayers.length < this.requiredCount) {
        this.selectedPlayers.push(player);
        card.classList.add('selected');
      } else if (this.requiredCount === 1) {
        // Si on ne peut sélectionner qu'un seul joueur, remplacer la sélection
        const previousCard = this.modal?.querySelector('.player-selector-card.selected');
        if (previousCard) {
          previousCard.classList.remove('selected');
        }
        this.selectedPlayers = [player];
        card.classList.add('selected');
      }
    }

    // Vérifier si on peut confirmer
    this.updateConfirmButton();

    // Auto-confirmer si le nombre requis est atteint et count === 1
    if (this.selectedPlayers.length === this.requiredCount && this.requiredCount === 1) {
      setTimeout(() => this.confirm(), 300);
    }
  }

  /**
   * Met à jour l'état du bouton de confirmation
   */
  private updateConfirmButton(): void {
    const confirmBtn = this.modal?.querySelector('#confirmSelection') as HTMLElement;
    if (!confirmBtn) return;

    if (this.selectedPlayers.length === this.requiredCount) {
      confirmBtn.style.display = 'block';
    } else {
      confirmBtn.style.display = 'none';
    }
  }

  /**
   * Confirme la sélection
   */
  private confirm(): void {
    if (this.currentCallback && this.selectedPlayers.length === this.requiredCount) {
      const selected = [...this.selectedPlayers];
      this.hide();
      this.currentCallback(selected);
    }
  }

  /**
   * Cache la modal
   */
  private hide(): void {
    if (this.modal) {
      this.modal.style.display = 'none';
    }
    this.selectedPlayers = [];
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
