import { Player } from '@models/Player';

/**
 * Gestionnaire de l'interface utilisateur
 * Gère les modales, notifications, et mises à jour de l'UI
 */
export class UIManager {
  // Éléments DOM
  private diceResultEl: HTMLElement;
  private rollDiceBtn: HTMLButtonElement;
  private playerListEl: HTMLElement;
  private historyPanelEl: HTMLElement;
  private setupScreenEl: HTMLElement;
  private effectModalEl: HTMLElement;
  private notificationEl: HTMLElement;

  constructor() {
    this.diceResultEl = document.getElementById('diceResult')!;
    this.rollDiceBtn = document.getElementById('rollDiceBtn') as HTMLButtonElement;
    this.playerListEl = document.getElementById('playerList')!;
    this.historyPanelEl = document.getElementById('historyPanel')!;
    this.setupScreenEl = document.getElementById('setupScreen')!;
    this.effectModalEl = document.getElementById('effectModal')!;
    this.notificationEl = document.getElementById('notification')!;
  }

  /**
   * Affiche le résultat du dé
   */
  showDiceResult(value: number | string): void {
    this.diceResultEl.textContent = value.toString();
  }

  /**
   * Active/désactive le bouton de lancer de dé
   */
  setDiceButtonEnabled(enabled: boolean): void {
    this.rollDiceBtn.disabled = !enabled;
  }

  /**
   * Met à jour la liste des joueurs
   */
  updatePlayerList(players: Player[], currentPlayerIndex: number): void {
    this.playerListEl.innerHTML = '';

    players.forEach((player, index) => {
      const div = document.createElement('div');
      div.className = `player-item ${index === currentPlayerIndex ? 'active' : ''}`;
      div.innerHTML = `
        <span class="player-name">${player.name}</span>
        <span class="player-info">Case ${player.position} | 🍺 ${player.drinks}${player.hasSchmittPower ? ' 👑' : ''}</span>
      `;
      div.style.borderLeft = `4px solid ${player.color}`;
      this.playerListEl.appendChild(div);
    });
  }

  /**
   * Ajoute un message à l'historique
   */
  addToHistory(message: string): void {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.textContent = message;
    this.historyPanelEl.insertBefore(div, this.historyPanelEl.firstChild);

    // Limiter l'historique à 20 éléments
    while (this.historyPanelEl.children.length > 20) {
      this.historyPanelEl.removeChild(this.historyPanelEl.lastChild!);
    }
  }

  /**
   * Efface l'historique
   */
  clearHistory(): void {
    this.historyPanelEl.innerHTML = '';
  }

  /**
   * Affiche/masque l'écran de configuration
   */
  showSetupScreen(show: boolean): void {
    this.setupScreenEl.style.display = show ? 'flex' : 'none';
  }

  /**
   * Affiche une notification temporaire
   */
  showNotification(message: string, duration: number = 2000): void {
    this.notificationEl.textContent = message;
    this.notificationEl.classList.add('show');

    setTimeout(() => {
      this.notificationEl.classList.remove('show');
    }, duration);
  }

  /**
   * Affiche une modale d'effet de case
   */
  showEffectModal(
    icon: string,
    title: string,
    description: string,
    onOk?: () => void
  ): void {
    document.getElementById('effectIcon')!.textContent = icon;
    document.getElementById('effectTitle')!.textContent = title;
    document.getElementById('effectDescription')!.textContent = description;
    document.getElementById('effectInteraction')!.innerHTML = '';

    this.effectModalEl.classList.add('show');

    const okBtn = document.getElementById('effectOkBtn') as HTMLButtonElement;
    okBtn.style.display = 'block';
    okBtn.onclick = () => {
      this.closeEffectModal();
      if (onOk) onOk();
    };
  }

  /**
   * Ferme la modale d'effet
   */
  closeEffectModal(): void {
    this.effectModalEl.classList.remove('show');
    const okBtn = document.getElementById('effectOkBtn') as HTMLButtonElement;
    okBtn.style.display = 'block';
  }

  /**
   * Affiche un sélecteur de joueurs dans la modale
   */
  showPlayerSelector(
    players: Player[],
    count: number,
    allowSelf: boolean,
    currentPlayer: Player,
    onSelect: (selectedPlayers: Player[]) => void
  ): void {
    const availablePlayers = allowSelf
      ? players
      : players.filter(p => p !== currentPlayer);

    const container = document.getElementById('effectInteraction')!;
    container.innerHTML = `
      <p style="margin-bottom: 15px;"><strong>Sélectionnez ${count} joueur(s) :</strong></p>
      <div class="player-selector" id="playerSelector"></div>
    `;

    const selector = document.getElementById('playerSelector')!;
    const selected: Player[] = [];

    availablePlayers.forEach(p => {
      const div = document.createElement('div');
      div.className = 'player-selector-item';
      div.innerHTML = `
        <div style="font-weight: bold;">${p.name}</div>
        <div style="font-size: 0.85em; opacity: 0.8;">🍺 ${p.drinks} gorgées</div>
      `;
      div.style.borderColor = p.color;
      div.style.borderWidth = '3px';

      div.onclick = () => {
        if (selected.includes(p)) {
          selected.splice(selected.indexOf(p), 1);
          div.classList.remove('selected');
        } else if (selected.length < count) {
          selected.push(p);
          div.classList.add('selected');
        } else {
          // Désélectionner le premier et sélectionner le nouveau
          const oldSelection = selector.querySelector('.selected');
          if (oldSelection) {
            oldSelection.classList.remove('selected');
          }
          selected[0] = p;
          div.classList.add('selected');
        }

        if (selected.length === count) {
          setTimeout(() => {
            this.closeEffectModal();
            onSelect(selected);
          }, 300);
        }
      };

      selector.appendChild(div);
    });

    // Cacher le bouton OK
    const okBtn = document.getElementById('effectOkBtn') as HTMLButtonElement;
    okBtn.style.display = 'none';
  }

  /**
   * Affiche un champ de saisie de règle personnalisée
   */
  showRuleInput(onSubmit: (rule: string) => void): void {
    const container = document.getElementById('effectInteraction')!;
    container.innerHTML = `
      <div class="input-group">
        <label>Entrez votre règle personnalisée :</label>
        <textarea id="ruleInput" placeholder="Ex: Chaque gorgée compte double !"></textarea>
      </div>
    `;

    const okBtn = document.getElementById('effectOkBtn') as HTMLButtonElement;
    okBtn.onclick = () => {
      const ruleInput = document.getElementById('ruleInput') as HTMLTextAreaElement;
      const rule = ruleInput.value.trim();
      if (rule) {
        this.closeEffectModal();
        onSubmit(rule);
      } else {
        alert('Veuillez entrer une règle !');
      }
    };
  }

  /**
   * Affiche l'écran de victoire
   */
  showVictoryScreen(
    winnerName: string,
    duration: number,
    totalMoves: number,
    totalDrinks: number
  ): void {
    const victoryScreen = document.getElementById('victoryScreen')!;
    document.getElementById('winnerName')!.textContent = winnerName;

    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    const stats = `
      <div class="stat-card">
        <div class="label">Durée de la partie</div>
        <div class="value">${minutes}:${seconds.toString().padStart(2, '0')}</div>
      </div>
      <div class="stat-card">
        <div class="label">Total de mouvements</div>
        <div class="value">${totalMoves}</div>
      </div>
      <div class="stat-card">
        <div class="label">Gorgées totales</div>
        <div class="value">${totalDrinks}</div>
      </div>
    `;

    document.getElementById('statsGrid')!.innerHTML = stats;
    victoryScreen.classList.add('show');
  }

  /**
   * Masque l'écran de victoire
   */
  hideVictoryScreen(): void {
    const victoryScreen = document.getElementById('victoryScreen')!;
    victoryScreen.classList.remove('show');
  }
}
