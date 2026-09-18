import { describe, it, expect, beforeEach } from 'vitest';
import { GameRenderer } from '@/features/game/game.renderer';

/**
 * SCH-06 — l'historique doit rester lisible pendant la partie.
 *
 * Bastien (18/09) signale deux défauts distincts : l'historique n'apparaît
 * qu'une seconde environ, et il recouvre le bandeau « JOUEUR X — À vous de
 * jouer ».
 *
 * Les notifications s'effaçaient au bout de deux secondes : quand on sert à
 * boire au lieu de fixer l'écran, on ratait ce qui venait de se passer, sans
 * moyen de le retrouver sans ouvrir le tiroir.
 */

function setupDom(): void {
  document.body.innerHTML = `
    <div class="turn-banner" id="currentPlayerIndicator">
      <span id="currentPlayerName">Joueur 1</span>
    </div>
    <div class="turn-log" id="turnLog"></div>
    <ul class="history-list" id="historyList"></ul>
  `;
}

describe('SCH-06 — le journal de partie reste affiché', () => {
  let renderer: GameRenderer;

  beforeEach(() => {
    setupDom();
    renderer = new GameRenderer();
  });

  it('affiche les derniers évènements', () => {
    renderer.updateHistory(['Alice avance de 3', 'Bob boit 2 🍺']);

    const log = document.getElementById('turnLog')!;
    expect(log.classList.contains('is-visible')).toBe(true);
    expect(log.textContent).toContain('Bob boit 2 🍺');
  });

  it('met le plus récent en premier, et le distingue', () => {
    renderer.updateHistory(['premier', 'deuxième', 'troisième']);

    const lines = Array.from(document.querySelectorAll('.turn-log-line'));
    expect(lines.map(l => l.textContent)).toEqual(['troisième', 'deuxième', 'premier']);
    expect(lines[0].classList.contains('is-latest')).toBe(true);
    expect(lines[1].classList.contains('is-latest')).toBe(false);
  });

  it('se limite à trois lignes, même sur un historique long', () => {
    renderer.updateHistory(Array.from({ length: 30 }, (_, i) => `event ${i}`));

    // Assez pour rattraper un tour manqué, assez peu pour ne pas manger le
    // plateau. L'historique complet reste dans le tiroir.
    expect(document.querySelectorAll('.turn-log-line')).toHaveLength(3);
  });

  it('reste masqué tant qu\'il ne s\'est rien passé', () => {
    renderer.updateHistory([]);

    const log = document.getElementById('turnLog')!;
    expect(log.classList.contains('is-visible')).toBe(false);
    expect(log.innerHTML).toBe('');
  });

  it('survit à plusieurs mises à jour sans accumuler de lignes', () => {
    renderer.updateHistory(['a', 'b', 'c']);
    renderer.updateHistory(['a', 'b', 'c', 'd']);

    expect(document.querySelectorAll('.turn-log-line')).toHaveLength(3);
    expect(document.querySelector('.turn-log-line')!.textContent).toBe('d');
  });

  it('continue d\'alimenter l\'historique complet du tiroir', () => {
    // Le journal ne remplace pas le tiroir : il le double pour les trois
    // derniers évènements.
    renderer.updateHistory(['un', 'deux']);

    expect(document.querySelectorAll('.history-item')).toHaveLength(2);
  });
});

describe('SCH-06 — le journal ne recouvre pas le bandeau du joueur', () => {
  beforeEach(() => {
    setupDom();
  });

  it('se place sous le bandeau, à une distance mesurée sur lui', () => {
    const banner = document.getElementById('currentPlayerIndicator')!;
    // jsdom ne calcule aucune mise en page : on simule une hauteur réelle.
    banner.getBoundingClientRect = () => ({ height: 72 }) as DOMRect;

    new GameRenderer().updateHistory(['quelque chose']);

    // Une hauteur écrite en dur finirait par diverger : un nom de joueur long
    // passe sur deux lignes, et le journal recouvrirait le bandeau — le défaut
    // même qu'on corrige.
    expect(
      document.documentElement.style.getPropertyValue('--turn-banner-height')
    ).toBe('78px');
  });

  it('garde le repli CSS quand la hauteur n\'est pas mesurable', () => {
    document.documentElement.style.removeProperty('--turn-banner-height');
    const banner = document.getElementById('currentPlayerIndicator')!;
    banner.getBoundingClientRect = () => ({ height: 0 }) as DOMRect;

    new GameRenderer().updateHistory(['quelque chose']);

    expect(
      document.documentElement.style.getPropertyValue('--turn-banner-height')
    ).toBe('');
  });
});
