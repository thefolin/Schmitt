import { describe, it, expect, beforeEach } from 'vitest';
import { GameRenderer } from '@/features/game/game.renderer';

/**
 * SCH-07 — pouvoir passer du message au plateau.
 *
 * Les messages recouvrent le plateau et le floutent : impossible de vérifier
 * où sont les pions sans fermer la fenêtre, donc sans perdre la consigne.
 *
 * Le message est REPLIÉ, jamais fermé : le tour n'avance pas tant que le
 * joueur n'a pas validé. Fermer reviendrait à valider l'effet, ce qui n'est
 * pas ce que demande quelqu'un qui veut juste regarder le plateau.
 */

function setupDom(): void {
  document.body.innerHTML = `
    <div class="modal" id="effectModal">
      <div class="modal-content">
        <div id="effectIcon"></div>
        <h2 id="effectTitle"></h2>
        <p id="effectDescription"></p>
        <button id="peekBoardBtn" aria-expanded="true"></button>
        <button id="effectOkBtn">OK</button>
      </div>
    </div>
    <button class="peek-restore" id="peekRestoreBtn" hidden></button>
  `;
}

describe('SCH-07 — replier le message pour voir le plateau', () => {
  let renderer: GameRenderer;
  let modal: HTMLElement;
  let restore: HTMLElement;

  beforeEach(() => {
    setupDom();
    renderer = new GameRenderer();
    modal = document.getElementById('effectModal')!;
    restore = document.getElementById('peekRestoreBtn')!;
    renderer.showEffectModal('🍺', 'JOUEUR 1 reçoit 2 🍺', '');
  });

  it('le message est visible au départ, et rien ne le replie', () => {
    expect(modal.classList.contains('show')).toBe(true);
    expect(renderer.isPeekingBoard()).toBe(false);
    expect(restore.hidden).toBe(true);
  });

  it('replie le message et propose de le revoir', () => {
    renderer.setBoardPeek(true);

    expect(renderer.isPeekingBoard()).toBe(true);
    expect(restore.hidden).toBe(false);
  });

  it('ne ferme PAS le message : le tour ne doit pas avancer', () => {
    // C'est la distinction qui compte. Fermer validerait l'effet.
    renderer.setBoardPeek(true);

    expect(modal.classList.contains('show')).toBe(true);
  });

  it('ramène le message et retire la pastille', () => {
    renderer.setBoardPeek(true);
    renderer.setBoardPeek(false);

    expect(renderer.isPeekingBoard()).toBe(false);
    expect(restore.hidden).toBe(true);
    expect(modal.classList.contains('show')).toBe(true);
  });

  it('reflète l\'état sur le bouton, pour les lecteurs d\'écran', () => {
    const toggle = document.getElementById('peekBoardBtn')!;

    renderer.setBoardPeek(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    renderer.setBoardPeek(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('SCH-07 — le repli ne survit pas au message', () => {
  beforeEach(() => {
    setupDom();
  });

  it('un message replié ne le reste pas pour le suivant', () => {
    const renderer = new GameRenderer();
    renderer.showEffectModal('🍺', 'Premier', '');
    renderer.setBoardPeek(true);

    renderer.showEffectModal('🐔', 'Deuxième', '');

    expect(renderer.isPeekingBoard()).toBe(false);
    expect(document.getElementById('peekRestoreBtn')!.hidden).toBe(true);
  });

  it('fermer le message retire aussi la pastille', () => {
    const renderer = new GameRenderer();
    renderer.showEffectModal('🍺', 'Un message', '');
    renderer.setBoardPeek(true);

    renderer.closeEffectModal();

    expect(document.getElementById('peekRestoreBtn')!.hidden).toBe(true);
    expect(renderer.isPeekingBoard()).toBe(false);
  });

  it('la pastille ne s\'affiche pas sans message ouvert', () => {
    const renderer = new GameRenderer();
    // Aucun message : replier n'a aucun sens, la pastille resterait orpheline.
    renderer.setBoardPeek(true);

    expect(document.getElementById('peekRestoreBtn')!.hidden).toBe(true);
  });
});
