import { describe, it, expect, beforeEach } from 'vitest';
import { GameRenderer } from '@/features/game/game.renderer';

/**
 * SCH-08 / SCH-14 — chaque écran d'action montre la vignette de sa case.
 *
 * Bastien : les messages affichaient un emoji générique — un 🎁 pour une case
 * « DISTRIBUEZ ×2 » — qui ne ressemblait à rien de ce qu'il avait sous les
 * yeux sur le plateau. Il demande l'image de la case, la même que sur le
 * plateau (14:18:17 pour la case ×2, 14:35:50 pour le Mouton).
 */

function setupDom(): void {
  document.body.innerHTML = `
    <div class="modal" id="effectModal">
      <div class="modal-content">
        <div class="tile-effect-icon" id="effectIcon"></div>
        <h2 id="effectTitle"></h2>
        <p id="effectDescription"></p>
        <button id="peekBoardBtn"></button>
      </div>
    </div>
    <button id="peekRestoreBtn" hidden></button>
  `;
}

describe('SCH-08 — la vignette de la case remplace l\'emoji', () => {
  let renderer: GameRenderer;

  beforeEach(() => {
    setupDom();
    renderer = new GameRenderer();
  });

  it('affiche l\'image quand la case en a une', () => {
    renderer.showEffectModal('🎁', 'JOUEUR 1 distribue 2 🍺', '', 'assets/cells/distribute_sip.png');

    const img = document.querySelector<HTMLImageElement>('#effectIcon .tile-effect-image');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('assets/cells/distribute_sip.png');
  });

  it('retombe sur l\'emoji quand la case n\'a pas d\'illustration', () => {
    // Un plateau composé dans l'éditeur peut poser des cases sans image.
    renderer.showEffectModal('🏁', 'START', 'Point de départ');

    expect(document.getElementById('effectIcon')!.textContent).toBe('🏁');
    expect(document.querySelector('.tile-effect-image')).toBeNull();
  });

  it('l\'image est décorative : le texte porte déjà l\'information', () => {
    renderer.showEffectModal('🍺', 'JOUEUR 1 reçoit 2 🍺', '', 'assets/cells/take_sip.png');

    const img = document.querySelector<HTMLImageElement>('.tile-effect-image');
    expect(img!.getAttribute('alt')).toBe('');
  });

  it('prévoit le cas d\'une illustration introuvable', () => {
    // Fichier renommé, plateau importé d'ailleurs : l'écran ne doit pas
    // afficher une image cassée à la place de la case.
    renderer.showEffectModal('🍺', 'Titre', '', 'assets/cells/inexistant.png');

    const img = document.querySelector<HTMLImageElement>('.tile-effect-image');
    expect(img!.getAttribute('onerror')).toContain('replaceWith');
  });
});

describe('SCH-14 — le vrai multiplicateur figure sur la vignette', () => {
  let renderer: GameRenderer;

  beforeEach(() => {
    setupDom();
    renderer = new GameRenderer();
  });

  it('affiche le facteur de la case par-dessus celui gravé dans l\'image', () => {
    // Une seule illustration sert pour ×2, ×3 et ×4 : sans ce badge, l'écran
    // d'une case ×4 montrerait une vignette marquée « ×2 ».
    renderer.showEffectModal('🎁', 'JOUEUR 1 distribue 4 🍺', '', 'assets/cells/distribute_sip.png', 4);

    const badge = document.querySelector('#effectIcon .tile-amount');
    expect(badge).not.toBeNull();
    expect(badge!.querySelector('.tile-amount-value')!.textContent).toBe('4');
    expect(badge!.querySelector('.tile-amount-sign')!.textContent).toBe('×');
  });

  it('n\'ajoute aucun badge sur une case sans multiplicateur', () => {
    renderer.showEffectModal('🐔', 'PETIT POULET', '', 'assets/cells/chicken.png');

    expect(document.querySelector('#effectIcon .tile-amount')).toBeNull();
  });

  it('enveloppe vignette et badge, pour que le badge se cale dessus', () => {
    renderer.showEffectModal('🎁', 'Titre', '', 'assets/cells/distribute_sip.png', 3);

    const figure = document.querySelector('#effectIcon .tile-effect-figure');
    expect(figure).not.toBeNull();
    expect(figure!.querySelector('.tile-effect-image')).not.toBeNull();
    expect(figure!.querySelector('.tile-amount')).not.toBeNull();
  });

  it('remplace toute la figure si l\'image manque, badge compris', () => {
    // Sinon un badge « ×4 » resterait seul, flottant sans illustration.
    renderer.showEffectModal('🎁', 'Titre', '', 'assets/cells/absent.png', 4);

    const img = document.querySelector<HTMLImageElement>('.tile-effect-image');
    expect(img!.getAttribute('onerror')).toContain('tile-effect-figure');
  });
});
