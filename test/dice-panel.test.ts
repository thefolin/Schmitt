import { describe, it, expect, beforeEach, vi } from 'vitest';
import { attachDicePanel, dicePanelElements } from '@/features/board/scene3d/dice-panel';

/**
 * LE PANNEAU DES DÉS — ce qu'il fait, et surtout ce qu'il NE fait pas.
 *
 * Arbitrage de Quentin du 22/10/2026 : layout gauche/droite, quitte à itérer
 * sur le rendu réel. Ce qui se vérifie ici est donc d'abord la MÉCANIQUE —
 * le plateau cède bien la place, et la rend — parce que c'est elle qui
 * décidera si le cadrage portrait tient (TODO.md §2 : « 8 cases sur 23 »).
 */

/** La page, réduite à ce que le panneau pilote. */
function page(): void {
  document.body.innerHTML = `
    <div id="scene"></div>
    <button id="dice-open"></button>
    <aside id="dice-panel" data-open="false">
      <button id="dice-panel-close"></button>
      <span id="dice-panel-value">—</span>
      <span id="dice-panel-caption">Aucun lancer</span>
      <button id="dice-panel-roll"></button>
    </aside>`;
  document.documentElement.style.removeProperty('--dice-panel');
}

/** La largeur que le plateau cède, telle que `#scene` la lira. */
const ceded = (): string =>
  document.documentElement.style.getPropertyValue('--dice-panel').trim();

const click = (id: string): void =>
  document.getElementById(id)!.dispatchEvent(new Event('click'));

beforeEach(page);

describe('Panneau des dés — il est fermé au départ', () => {
  it('ne prend AUCUNE largeur au plateau', () => {
    // C'EST LA DÉCISION DE FOND : en portrait la largeur est comptée, et un
    // panneau ouvert d'office amputerait le plateau en continu.
    attachDicePanel(dicePanelElements(), { onRoll: vi.fn() });

    expect(ceded()).toBe('0px');
    expect(document.getElementById('dice-panel')!.dataset.open).toBe('false');
  });

  it('n\'annonce aucune face tant qu\'on n\'a pas lancé', () => {
    // UN « 1 » AFFICHÉ D'OFFICE se confondrait avec un vrai résultat : le
    // joueur croirait avoir fait 1.
    attachDicePanel(dicePanelElements(), { onRoll: vi.fn() });

    expect(document.getElementById('dice-panel-value')!.textContent).toBe('—');
    expect(document.getElementById('dice-panel-caption')!.textContent).toBe('Aucun lancer');
  });
});

describe('Panneau des dés — il coulisse', () => {
  it('rend la largeur au plateau quand il s\'ouvre', () => {
    // LE PLATEAU CÈDE LA PLACE plutôt que de passer dessous : la scène se
    // mesure sur son conteneur et recadre sur ce qui lui reste.
    const panel = attachDicePanel(dicePanelElements(), { onRoll: vi.fn() });

    panel.open();

    expect(ceded()).toBe('var(--dice-panel-width)');
    expect(document.getElementById('dice-panel')!.dataset.open).toBe('true');
  });

  it('rend TOUTE la largeur en se refermant', () => {
    // Sans cela le plateau resterait amputé après la fermeture, et le
    // panneau aurait coûté sa place pour rien.
    const panel = attachDicePanel(dicePanelElements(), { onRoll: vi.fn() });

    panel.open();
    panel.close();

    expect(ceded()).toBe('0px');
  });

  it('s\'ouvre au bouton, se ferme à la croix', () => {
    const panel = attachDicePanel(dicePanelElements(), { onRoll: vi.fn() });

    click('dice-open');
    expect(panel.isOpen()).toBe(true);

    click('dice-panel-close');
    expect(panel.isOpen()).toBe(false);
  });

  it('marque le corps de page, pour effacer le bouton d\'ouverture', () => {
    // Les deux commandes se chevaucheraient sur un écran étroit.
    const panel = attachDicePanel(dicePanelElements(), { onRoll: vi.fn() });

    panel.open();

    expect(document.body.dataset.dicePanel).toBe('open');
  });

  it('ne publie rien deux fois pour une ouverture déjà acquise', () => {
    // Chaque publication déclenche un recadrage de la scène : le répéter
    // ferait recadrer pour rien pendant qu'on joue.
    const onResize = vi.fn();
    const panel = attachDicePanel(dicePanelElements(), { onRoll: vi.fn(), onResize });

    onResize.mockClear();
    panel.open();
    panel.open();

    expect(onResize).toHaveBeenCalledTimes(1);
  });
});

describe('Panneau des dés — il prévient qu\'il faut recadrer', () => {
  it('signale le changement de largeur à l\'ouverture ET à la fermeture', () => {
    // SANS CE SIGNAL le plateau garderait son cadrage d'avant : il
    // resterait décentré, ou déborderait sous le panneau.
    const onResize = vi.fn();
    const panel = attachDicePanel(dicePanelElements(), { onRoll: vi.fn(), onResize });

    onResize.mockClear();
    panel.open();
    panel.close();

    expect(onResize).toHaveBeenCalledTimes(2);
  });
});

describe('Panneau des dés — il n\'arbitre PAS le lancer', () => {
  it('rend la main à la scène, et ne lance rien lui-même', () => {
    // LE DÉ APPARTIENT À LA SCÈNE : elle tient la physique. Un second
    // chemin de lancer donnerait deux résultats concurrents.
    const onRoll = vi.fn();
    attachDicePanel(dicePanelElements(), { onRoll });

    click('dice-panel-roll');

    expect(onRoll).toHaveBeenCalledTimes(1);
  });

  it('n\'invente aucune face : il affiche celle qu\'on lui donne', () => {
    const panel = attachDicePanel(dicePanelElements(), { onRoll: vi.fn() });

    panel.showFace(5);

    expect(document.getElementById('dice-panel-value')!.textContent).toBe('5');
    expect(document.getElementById('dice-panel-caption')!.textContent).toBe('Dernier lancer');
  });

  it('GARDE la dernière face quand on referme et rouvre', () => {
    // C'est l'état 4 de la demande : « si on rouvre plus tard, on voit
    // toujours le dernier dé ».
    const panel = attachDicePanel(dicePanelElements(), { onRoll: vi.fn() });

    panel.showFace(3);
    panel.close();
    panel.open();

    expect(document.getElementById('dice-panel-value')!.textContent).toBe('3');
  });

  it('se grise pendant qu\'un lancer est en cours', () => {
    // Deux lancers simultanés feraient deux résultats pour un seul tour.
    const panel = attachDicePanel(dicePanelElements(), { onRoll: vi.fn() });

    panel.setRollEnabled(false);

    expect((document.getElementById('dice-panel-roll') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Panneau des dés — il ne fait pas tomber le jeu', () => {
  it('se branche sans broncher sur une page qui n\'a aucun de ses éléments', () => {
    // La page du rendu CSS n'en porte aucun, et un identifiant renommé ne
    // doit pas lever au chargement.
    document.body.innerHTML = '';

    expect(() => {
      const panel = attachDicePanel(dicePanelElements(), { onRoll: vi.fn() });
      panel.open();
      panel.showFace(4);
      panel.setRollEnabled(false);
    }).not.toThrow();
  });
});
