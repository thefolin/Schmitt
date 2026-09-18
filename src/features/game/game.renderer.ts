import type { Player } from '@/core/models/Player';
import { describePlayerStatuses } from '@/features/board/camera/pawn-badges';

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
            ${describePlayerStatuses(player).join(' ')}
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
    if (historyList) {
      historyList.innerHTML = history
        .slice(-10) // 10 derniers messages
        .reverse()
        .map(msg => `<div class="history-item">${msg}</div>`)
        .join('');
    }

    this.updateTurnLog(history);
  }

  /**
   * Journal de partie affiché en permanence sur le plateau.
   *
   * Les notifications disparaissaient au bout de deux secondes : quand on
   * sert à boire au lieu de fixer l'écran, on ratait ce qui venait de se
   * passer, et plus rien ne permettait de le retrouver sans ouvrir le tiroir.
   *
   * Trois lignes suffisent : assez pour rattraper un tour manqué, assez peu
   * pour ne pas manger le plateau. L'historique complet reste dans le tiroir.
   */
  private updateTurnLog(history: string[]): void {
    const log = document.getElementById('turnLog');
    if (!log) return;

    this.syncTurnBannerHeight();

    const recent = history.slice(-3);
    if (recent.length === 0) {
      log.innerHTML = '';
      log.classList.remove('is-visible');
      return;
    }

    // Le plus récent en premier : c'est celui qu'on cherche du regard.
    log.innerHTML = recent
      .reverse()
      .map(
        (msg, i) =>
          `<div class="turn-log-line${i === 0 ? ' is-latest' : ''}">${msg}</div>`
      )
      .join('');
    log.classList.add('is-visible');
  }

  /**
   * Reporte la hauteur réelle du bandeau dans une variable CSS.
   *
   * Le journal se place juste en dessous. Une hauteur écrite en dur finirait
   * par diverger — un nom de joueur long passe sur deux lignes, et le journal
   * recouvrirait le bandeau, ce qui est précisément le défaut signalé.
   */
  private syncTurnBannerHeight(): void {
    const banner = document.getElementById('currentPlayerIndicator');
    if (!banner) return;

    const height = banner.getBoundingClientRect().height;
    // jsdom (et un bandeau masqué) renvoient 0 : on garde alors le repli CSS.
    if (height > 0) {
      document.documentElement.style.setProperty(
        '--turn-banner-height',
        `${Math.round(height) + 6}px`
      );
    }
  }

  /**
   * Affiche une modale d'effet
   */
  public showEffectModal(icon: string, title: string, description: string): void {
    const modal = document.getElementById('effectModal');
    const modalIcon = document.getElementById('effectIcon') || document.getElementById('modalIcon');
    const modalTitle = document.getElementById('effectTitle') || document.getElementById('modalTitle');
    const modalDescription = document.getElementById('effectDescription') || document.getElementById('modalDescription');

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
      // Le bouton respire quand c'est au joueur d'agir : le geste attendu se
      // voit sans avoir à lire.
      btn.classList.toggle('is-ready', enabled);
    }

    const hint = document.getElementById('currentPlayerHint');
    if (hint) {
      hint.textContent = enabled ? 'À vous de jouer' : 'Lancer en cours…';
    }
  }
}
