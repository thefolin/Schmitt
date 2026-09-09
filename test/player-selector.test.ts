import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerSelector } from '@/features/game/player-selector';
import type { Player } from '@/core/models/Player';

function makePlayer(index: number, name: string): Player {
  return {
    name,
    color: '#ff0000',
    position: 0,
    index,
    hasSchmittPower: false,
    isReturning: false,
    drinks: 0,
    hasAthenaShield: false,
    canReplay: false,
  };
}

const players = [
  makePlayer(0, 'Alice'),
  makePlayer(1, 'Bob'),
  makePlayer(2, 'Carol'),
];

function clickCard(index: number): void {
  const cards = document.querySelectorAll<HTMLElement>('.player-selector-card');
  cards[index].click();
}

describe('PlayerSelector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('exclut le joueur courant des cartes proposées quand allowSelf est faux', () => {
    const selector = new PlayerSelector();
    selector.show(players, 1, 0, false, () => {});

    const names = Array.from(document.querySelectorAll('.player-selector-name')).map(el => el.textContent);
    expect(names).toEqual(['Bob', 'Carol']);

    selector.destroy();
  });

  it('inclut le joueur courant quand allowSelf est vrai', () => {
    const selector = new PlayerSelector();
    selector.show(players, 1, 0, true, () => {});

    const names = Array.from(document.querySelectorAll('.player-selector-name')).map(el => el.textContent);
    expect(names).toEqual(['Alice', 'Bob', 'Carol']);

    selector.destroy();
  });

  it('appelle le callback avec le joueur choisi (sélection simple auto-confirmée)', async () => {
    vi.useFakeTimers();
    const selector = new PlayerSelector();
    const callback = vi.fn();
    selector.show(players, 1, 0, false, callback);

    clickCard(0); // Bob
    // requiredCount === 1 déclenche une auto-confirmation différée
    await vi.advanceTimersByTimeAsync(500);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].map((p: Player) => p.name)).toEqual(['Bob']);

    selector.destroy();
    vi.useRealTimers();
  });

  it('appelle le callback avec les joueurs choisis après confirmation manuelle (sélection multiple)', () => {
    const selector = new PlayerSelector();
    const callback = vi.fn();
    selector.show(players, 2, 0, false, callback);

    clickCard(0); // Bob
    expect(callback).not.toHaveBeenCalled(); // pas encore le compte

    clickCard(1); // Carol
    const confirmBtn = document.getElementById('confirmSelection') as HTMLElement;
    expect(confirmBtn.style.display).toBe('block');

    confirmBtn.click();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].map((p: Player) => p.name)).toEqual(['Bob', 'Carol']);

    selector.destroy();
  });

  it('ferme la modale après confirmation', () => {
    const selector = new PlayerSelector();
    selector.show(players, 2, 0, false, () => {});

    clickCard(0);
    clickCard(1);
    (document.getElementById('confirmSelection') as HTMLElement).click();

    const modal = document.getElementById('playerSelectorModal') as HTMLElement;
    expect(modal.style.display).toBe('none');

    selector.destroy();
  });

  it('permet de désélectionner un joueur en recliquant dessus', () => {
    const selector = new PlayerSelector();
    selector.show(players, 2, 0, false, () => {});

    clickCard(0);
    expect(document.querySelectorAll('.player-selector-card.selected')).toHaveLength(1);

    clickCard(0);
    expect(document.querySelectorAll('.player-selector-card.selected')).toHaveLength(0);

    selector.destroy();
  });

  it('n\'affiche le bouton de confirmation que lorsque le compte requis est atteint', () => {
    const selector = new PlayerSelector();
    selector.show(players, 2, 0, false, () => {});

    const confirmBtn = document.getElementById('confirmSelection') as HTMLElement;
    expect(confirmBtn.style.display).toBe('none');

    clickCard(0);
    expect(confirmBtn.style.display).toBe('none');

    clickCard(1);
    expect(confirmBtn.style.display).toBe('block');

    selector.destroy();
  });

  it('réutilise proprement le sélecteur sur plusieurs appels successifs', () => {
    const selector = new PlayerSelector();

    const first = vi.fn();
    selector.show(players, 2, 0, false, first);
    clickCard(0);
    clickCard(1);
    (document.getElementById('confirmSelection') as HTMLElement).click();
    expect(first).toHaveBeenCalledTimes(1);

    // Deuxième usage : le callback précédent ne doit plus être appelé
    const second = vi.fn();
    selector.show(players, 2, 1, false, second);
    clickCard(0);
    clickCard(1);
    (document.getElementById('confirmSelection') as HTMLElement).click();

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);

    selector.destroy();
  });

  it('adapte le titre et le sous-titre au nombre de joueurs demandés', () => {
    const selector = new PlayerSelector();

    selector.show(players, 1, 0, false, () => {});
    expect(document.querySelector('.player-selector-title')?.textContent).toBe('Choisissez un joueur');
    expect(document.querySelector('.player-selector-subtitle')?.textContent).toBe('Sélectionnez 1 joueur');

    selector.show(players, 2, 0, false, () => {});
    expect(document.querySelector('.player-selector-title')?.textContent).toBe('Choisissez des joueurs');
    expect(document.querySelector('.player-selector-subtitle')?.textContent).toBe('Sélectionnez 2 joueurs');

    selector.destroy();
  });
});
