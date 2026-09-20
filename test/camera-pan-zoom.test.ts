import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { BoardScene } from '@/features/board/scene3d/board-scene';

/**
 * Le zoom n'appartient qu'au joueur.
 *
 * Quentin : « quand je me déplace, ou quand la caméra sort du plateau, elle
 * fait du zoom/dézoom automatique. Sur PC et sur mobile. »
 *
 * LE DÉFAUT est dans `layout()`, qui recalcule la distance de caméra à
 * chaque appel pour que le parcours tienne dans le cadre — et `panBy`
 * appelle `layout()`. Déplacer la vue la remettait donc à l'échelle, sans
 * que le joueur ait rien demandé.
 *
 * Ce qui se vérifie ici est la taille APPARENTE d'une case : c'est ce que le
 * joueur voit changer, et c'est mesurable sans WebGL.
 */

let scene: BoardScene;
let container: HTMLElement;

/** Un plateau de 23 cases sur une ligne, assez large pour sortir du cadre. */
function boardExtent(): { x: number; z: number }[] {
  return Array.from({ length: 23 }, (_, index) => ({ x: index * 135, z: 0 }));
}

beforeEach(() => {
  container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { value: 900, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: 500, configurable: true });
  document.body.appendChild(container);

  scene = new BoardScene({ container, hudInsets: { top: 0, bottom: 0 } });
  scene.setBoardExtent(boardExtent(), 120);
});

afterEach(() => {
  scene?.dispose();
  container?.remove();
});

describe('caméra — se déplacer ne change pas l\'échelle', () => {
  it('garde la même taille de case pendant un déplacement', () => {
    // C'EST LE BUG DE QUENTIN. Un glissement est un déplacement, pas un
    // zoom : le plateau ne doit pas grandir ni rétrécir sous le doigt.
    const before = scene.worldToScreenPixels(120);

    scene.panBy(200, 120);

    expect(scene.worldToScreenPixels(120)).toBeCloseTo(before, 3);
  });

  it('garde la même échelle même en sortant loin du plateau', () => {
    // « Quand la caméra sort du plateau » : c'est là que le recadrage
    // automatique se voyait le plus, puisque le cadre n'avait plus rien à
    // cadrer.
    const before = scene.worldToScreenPixels(120);

    for (let i = 0; i < 10; i += 1) scene.panBy(300, 200);

    expect(scene.worldToScreenPixels(120)).toBeCloseTo(before, 3);
  });

  it('garde la même échelle en tournant la vue', () => {
    // Une rotation n'est pas un zoom non plus.
    const before = scene.worldToScreenPixels(120);

    scene.orbitBy(45, 10);

    expect(scene.worldToScreenPixels(120)).toBeCloseTo(before, 3);
  });
});

describe('caméra — le zoom répond au joueur', () => {
  it('rapproche quand le joueur le demande', () => {
    const before = scene.worldToScreenPixels(120);

    scene.setUserZoom(scene.getUserZoom() * 1.5);

    expect(scene.worldToScreenPixels(120)).toBeGreaterThan(before);
  });

  it('éloigne quand le joueur le demande', () => {
    const before = scene.worldToScreenPixels(120);

    scene.setUserZoom(scene.getUserZoom() * 0.5);

    expect(scene.worldToScreenPixels(120)).toBeLessThan(before);
  });

  it('conserve le zoom demandé à travers un déplacement', () => {
    // Le réglage du joueur doit SURVIVRE au geste suivant : c'est la moitié
    // du défaut — non seulement le déplacement zoomait, mais il effaçait le
    // zoom que le joueur venait de choisir.
    scene.setUserZoom(2);
    const zoomed = scene.worldToScreenPixels(120);

    scene.panBy(150, 90);

    expect(scene.worldToScreenPixels(120)).toBeCloseTo(zoomed, 3);
  });
});

describe('caméra — « Recadrer » reste le filet', () => {
  it('ramène la vue quand le joueur le demande', () => {
    // La caméra est libre, donc elle peut se perdre. `resetView` est ce qui
    // rend cette liberté acceptable — sans lui, un joueur égaré devrait
    // relancer la partie.
    scene.panBy(2000, 2000);
    scene.setUserZoom(4);

    scene.resetView();

    expect(scene.getUserZoom()).toBe(1);
  });
});

/**
 * La caméra reste près du plateau.
 *
 * Quentin : « limiter le cadre pour que le joueur ne puisse pas passer trop
 * loin en dehors du plateau quand il se déplace ».
 *
 * C'est la contrepartie du correctif précédent : une caméra qui ne recadre
 * plus toute seule peut se perdre. Sans borne, un glissement continu
 * l'emmène à l'infini, et le joueur se retrouve devant un écran vide sans
 * savoir dans quel sens revenir.
 */
describe('caméra — elle ne part pas à l\'infini', () => {
  it('cesse de s\'éloigner au-delà d\'une certaine distance', () => {
    // Deux glissements énormes doivent finir au même endroit : la borne les
    // arrête tous les deux.
    scene.panBy(5000, 5000);
    const far = scene.getAimPoint();

    scene.panBy(5000, 5000);
    const farther = scene.getAimPoint();

    expect(farther.x).toBeCloseTo(far.x, 3);
    expect(farther.z).toBeCloseTo(far.z, 3);
  });

  it('borne dans les deux sens', () => {
    scene.panBy(-5000, -5000);
    const one = scene.getAimPoint();

    scene.panBy(-5000, -5000);

    expect(scene.getAimPoint().x).toBeCloseTo(one.x, 3);
  });

  it('laisse tout de même parcourir le plateau', () => {
    // LE RISQUE INVERSE, et il est réel : une borne trop serrée
    // empêcherait de regarder les bords, ce qui est le premier usage du
    // déplacement. Le joueur doit pouvoir dépasser l'emprise du parcours.
    const start = scene.getAimPoint();

    scene.panBy(400, 0);

    expect(Math.abs(scene.getAimPoint().x - start.x)).toBeGreaterThan(0);
  });

  it('ne dépend PAS du zoom', () => {
    // Bornée en pixels, la limite changerait avec le zoom : on pourrait
    // s'éloigner deux fois plus en dézoomant, ce qui est exactement ce
    // qu'on veut empêcher. Elle est donc exprimée en unités du monde.
    scene.panBy(9000, 0);
    const atNormalZoom = scene.getAimPoint().x;

    scene.resetView();
    scene.setUserZoom(0.25);
    scene.panBy(9000, 0);

    expect(scene.getAimPoint().x).toBeCloseTo(atNormalZoom, 1);
  });

  it('« Recadrer » ramène toujours au plateau', () => {
    scene.panBy(9000, 9000);

    scene.resetView();

    const home = scene.getAimPoint();
    expect(Math.abs(home.x)).toBeLessThan(9000);
  });
});
