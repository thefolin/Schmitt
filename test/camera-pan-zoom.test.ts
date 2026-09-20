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

/**
 * LE GESTE SUIT LA CAMÉRA.
 *
 * Retour de Quentin : « quand on retourne la caméra, les gestes ne suivent
 * plus l'orientation ». Le déplacement était ajouté tel quel sur les axes du
 * MONDE : mesuré, un glissement de 100 px vers la droite déplaçait la visée
 * de dx = -370 et dz = 0 à 0°, 90°, 180° ET 270° — la même direction du
 * monde dans les quatre cas. Vue de face c'était juste ; vue retournée, le
 * plateau partait à l'envers sous le doigt.
 *
 * Ce qui se vérifie ici est une INVARIANCE, et non quatre valeurs attendues
 * écrites à la main : le déplacement doit aller du même côté DE L'ÉCRAN quel
 * que soit l'angle. Reproduire le calcul dans le test n'aurait rien prouvé.
 */
describe('caméra — le déplacement suit l\'orientation de la vue', () => {
  /** Le vecteur « vers la droite de l'écran », au sol, vu d'où l'on regarde. */
  function screenRight(): { x: number; z: number } {
    const camera = scene.getCameraPosition();
    const aim = scene.getAimPoint();

    const fx = aim.x - camera.x;
    const fz = aim.z - camera.z;
    const length = Math.hypot(fx, fz);

    // La droite de l'écran est la visée tournée d'un quart de tour au sol.
    return { x: fz / length, z: -fx / length };
  }

  /** De combien la visée avance-t-elle vers la droite de l'écran ? */
  function slideRight(dxPx: number): number {
    const right = screenRight();
    const before = scene.getAimPoint();

    scene.panBy(dxPx, 0);

    const after = scene.getAimPoint();

    return (after.x - before.x) * right.x + (after.z - before.z) * right.z;
  }

  it('va du même côté de l\'écran à toutes les orientations', () => {
    const slides = [0, 90, 180, 270].map(yaw => {
      scene.resetView();
      scene.orbitBy(yaw, 0);

      return slideRight(100);
    });

    // Tous du même signe, et de même ampleur : c'est ce que « suivre la
    // caméra » veut dire. Avant correction, les quatre valeurs étaient
    // identiques en coordonnées du MONDE, donc opposées à l'écran.
    for (const slide of slides) {
      expect(Math.sign(slide)).toBe(Math.sign(slides[0]));
      expect(Math.abs(slide - slides[0])).toBeLessThan(1);
    }
  });

  /** De combien la visée avance-t-elle vers le HAUT de l'écran ? */
  function slideUp(dyPx: number): number {
    const camera = scene.getCameraPosition();
    const before = scene.getAimPoint();

    // « Vers le haut de l'écran », au sol, c'est s'éloigner de la caméra.
    const fx = before.x - camera.x;
    const fz = before.z - camera.z;
    const length = Math.hypot(fx, fz);

    scene.panBy(0, dyPx);

    const after = scene.getAimPoint();

    return ((after.x - before.x) * fx + (after.z - before.z) * fz) / length;
  }

  it('suit la caméra AUSSI dans le sens vertical', () => {
    // SANS CE TEST, une erreur de signe sur la seule composante verticale
    // passait inaperçue : le glissement horizontal restait juste, et le
    // vertical partait à l'envers dès que la vue était tournée.
    const slides = [0, 90, 180, 270].map(yaw => {
      scene.resetView();
      scene.orbitBy(yaw, 0);

      return slideUp(100);
    });

    for (const slide of slides) {
      expect(Math.sign(slide)).toBe(Math.sign(slides[0]));
      expect(Math.abs(slide - slides[0])).toBeLessThan(1);
    }
  });

  it('inverse le déplacement quand on inverse le geste', () => {
    scene.resetView();
    scene.orbitBy(180, 0);

    const right = slideRight(100);
    scene.resetView();
    scene.orbitBy(180, 0);
    const left = slideRight(-100);

    expect(Math.sign(right)).toBe(-Math.sign(left));
  });

  it('garde le geste juste à une orientation quelconque', () => {
    // Les angles ronds pourraient masquer une erreur de signe qui ne se voit
    // qu'entre deux quadrants.
    const slides = [37, 154, 221, 318].map(yaw => {
      scene.resetView();
      scene.orbitBy(yaw, 0);

      return slideRight(100);
    });

    for (const slide of slides) {
      expect(Math.sign(slide)).toBe(Math.sign(slides[0]));
      expect(Math.abs(slide - slides[0])).toBeLessThan(1);
    }
  });
});
