import type { Player } from '@/core/models/Player';

/**
 * Rendu visuel du jeu
 * Gère l'affichage DOM (pas le canvas, c'est BoardRenderer)
 */
export class GameRenderer {
  /**
   * Affiche l'écran de setup
   */
  public showSetupScreen(): void {
    const setupScreen = document.querySelector('.setup-screen') as HTMLElement;
    const gameArea = document.querySelector('.game-area') as HTMLElement;
    const sidebar = document.querySelector('.sidebar') as HTMLElement;

    if (setupScreen) setupScreen.style.display = 'flex';
    if (gameArea) gameArea.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';
  }

  /**
   * Cache l'écran de setup et affiche le jeu
   */
  public hideSetupScreen(): void {
    const setupScreen = document.querySelector('.setup-screen') as HTMLElement;
    const gameArea = document.querySelector('.game-area') as HTMLElement;
    const sidebar = document.querySelector('.sidebar') as HTMLElement;

    if (setupScreen) setupScreen.style.display = 'none';
    if (gameArea) gameArea.style.display = 'flex';
    if (sidebar) sidebar.style.display = 'flex';
  }

  /**
   * Met à jour la liste des joueurs dans le DOM
   */
  public updatePlayerList(players: Player[], currentPlayerIndex: number): void {
    const playerList = document.getElementById('playerList');
    if (!playerList) return;

    playerList.innerHTML = players.map((player, index) => `
      <div class="player-item ${index === currentPlayerIndex ? 'active' : ''}">
        <div class="player-color" style="background-color: ${player.color};"></div>
        <div class="player-info">
          <div class="player-name">${player.name}</div>
          <div class="player-stats">
            ${player.hasSchmittPower ? '⚡ Schmitt' : ''}
            ${player.drinks > 0 ? `🍺 ${player.drinks}` : ''}
          </div>
        </div>
        <div class="player-position">Case ${player.position}</div>
      </div>
    `).join('');
  }

  /**
   * Affiche le résultat du dé
   */
  public showDiceResult(value: number): void {
    const diceElement = document.getElementById('diceResult');
    if (diceElement) {
      diceElement.textContent = `🎲 ${value}`;

      // Animation bounce
      diceElement.style.animation = 'none';
      setTimeout(() => {
        diceElement.style.animation = 'diceBounce 0.5s ease';
      }, 10);
    }
  }

  /**
   * Affiche l'historique
   */
  public updateHistory(history: string[]): void {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    historyList.innerHTML = history
      .slice(-10) // 10 derniers messages
      .reverse()
      .map(msg => `<div class="history-item">${msg}</div>`)
      .join('');
  }

  /**
   * Affiche une modale d'effet
   */
  public showEffectModal(icon: string, title: string, description: string): void {
    const modal = document.getElementById('effectModal');
    const modalIcon = document.getElementById('modalIcon');
    const modalTitle = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');

    if (modal && modalIcon && modalTitle && modalDescription) {
      modalIcon.textContent = icon;
      modalTitle.textContent = title;
      modalDescription.textContent = description;
      modal.classList.add('show');
    }
  }

  /**
   * Ferme la modale d'effet
   */
  public closeEffectModal(): void {
    const modal = document.getElementById('effectModal');
    modal?.classList.remove('show');
  }

  /**
   * Affiche une notification toast
   */
  public showNotification(message: string, duration: number = 2000): void {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    // Afficher
    setTimeout(() => notification.classList.add('show'), 10);

    // Masquer et supprimer
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 400);
    }, duration);
  }

  /**
   * Affiche l'écran de victoire
   */
  public showVictoryScreen(winner: Player): void {
    const victoryScreen = document.querySelector('.victory-screen');
    const winnerNameElement = document.getElementById('winnerName');

    if (victoryScreen && winnerNameElement) {
      winnerNameElement.textContent = winner.name;
      winnerNameElement.style.color = winner.color;
      victoryScreen.classList.add('show');
    }
  }

  /**
   * Affiche un sélecteur de joueurs (pour choisir qui boit, etc.)
   */
  public showPlayerSelector(
    players: Player[],
    count: number,
    title: string,
    onSelect: (selectedIndices: number[]) => void
  ): void {
    const modal = document.getElementById('effectModal');
    const modalIcon = document.getElementById('modalIcon');
    const modalTitle = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');
    const closeBtn = modal?.querySelector('.close-modal');

    if (!modal || !modalIcon || !modalTitle || !modalDescription) return;

    modalIcon.textContent = '👥';
    modalTitle.textContent = title;
    modalDescription.innerHTML = `
      <div class="player-selector">
        ${players.map((p, i) => `
          <label class="player-selector-item">
            <input type="checkbox" value="${i}" data-player-selector>
            <span style="color: ${p.color};">${p.name}</span>
          </label>
        `).join('')}
      </div>
      <button class="btn btn-primary" id="confirmSelection">Confirmer (${count})</button>
    `;

    modal.classList.add('show');

    // Gérer la sélection
    const confirmBtn = document.getElementById('confirmSelection');
    const checkboxes = modal.querySelectorAll<HTMLInputElement>('[data-player-selector]');

    const handleSelection = () => {
      const selected = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => parseInt(cb.value));

      if (selected.length === count) {
        onSelect(selected);
        modal.classList.remove('show');
      } else {
        this.showNotification(`Sélectionnez ${count} joueur(s) !`);
      }
    };

    confirmBtn?.addEventListener('click', handleSelection, { once: true });
    closeBtn?.addEventListener('click', () => {
      modal.classList.remove('show');
    }, { once: true });
  }

  /**
   * Active/désactive le bouton de dé
   */
  public setDiceButtonEnabled(enabled: boolean): void {
    const btn = document.getElementById('rollDiceBtn') as HTMLButtonElement;
    if (btn) {
      btn.disabled = !enabled;
    }
  }
}
