import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Vector3 } from 'three';
import { BoardScene } from '@/features/board/scene3d/board-scene';

/**
 * 3D-43 — le plateau doit être centré dans ce que le HUD laisse libre.
 *
 * Quentin : « il faut mieux regarder, le plateau n'est pas au milieu de
 * l'écran. »
 *
 * Le défaut était plus grave qu'un décentrage : le plateau DÉBORDAIT. La
 * caméra recevait un rapport d'image calculé sur la surface réduite du HUD
 * alors que le renderer dessine dans le canvas entier, et surtout la distance
 * de recul venait d'une formule qui modélisait le plateau comme une carte
 * plate face à l'objectif. Le plateau est un plan INCLINÉ : son bord proche
 * est bien plus près de la caméra que son centre, et le cône y est d'autant
 * plus étroit. Mesuré : les coins tombaient à -72 px et 532 px sur un écran
 * de 390 px de large — un bon tiers du parcours hors de l'écran, alors que le
 * cadrage automatique est justement censé garantir qu'on voit tout.
 *
 * On projette ici de vraies coordonnées monde vers les pixels écran : c'est
 * la seule façon de vérifier ce que le joueur voit, sans navigateur.
 */

const SCREEN_W = 390;
const SCREEN_H = 844;

type Insets = { top: number; bottom: number };

let container: HTMLElement;
let scene: BoardScene;

/** Le plateau officiel : large et plat. */
function officialBoard(): { x: number; z: number }[] {
  const tiles = [];
  for (let col = 0; col < 10; col++) tiles.push({ x: col * 135, z: 0 });
  for (let col = 0; col < 10; col++) tiles.push({ x: col * 135, z: 675 });
  return tiles;
}

const BOARD_CENTER = { x: (9 * 135) / 2, z: 675 / 2 };

function corners(): [number, number][] {
  return [
    [0, 0],
    [9 * 135, 0],
    [0, 675],
    [9 * 135, 675],
  ];
}

/**
 * Où un point du monde atterrit, en pixels du canvas.
 *
 * Le repère a été vérifié plutôt que supposé, et il est contre-intuitif :
 * `setViewOffset` décale le CÔNE DE VISION pour que la sous-fenêtre tombe au
 * bon endroit, mais les coordonnées normalisées continuent de se rapporter au
 * canvas entier. Un point centré dans la zone libre du HUD rend donc un ndc
 * légèrement positif — c'est correct, et non le signe d'un décentrage. Se
 * tromper de repère ici fait chercher un défaut là où il n'y en a pas.
 */
function toScreen(x: number, z: number, _insets: Insets): { x: number; y: number } {
  const p = new Vector3(x, 0, z).project(scene.camera);

  return {
    x: (p.x * 0.5 + 0.5) * SCREEN_W,
    y: (-p.y * 0.5 + 0.5) * SCREEN_H,
  };
}

function build(insets: Insets): Insets {
  scene = new BoardScene({ container, hudInsets: insets });
  scene.setBoardExtent(officialBoard(), 120);
  return insets;
}

beforeEach(() => {
  document.body.innerHTML = '<div id="boardCamera"></div>';
  container = document.getElementById('boardCamera')!;
  Object.defineProperty(container, 'clientWidth', { value: SCREEN_W, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: SCREEN_H, configurable: true });
});

afterEach(() => scene.dispose());

describe('3D-43 — tout le parcours tient dans l\'écran', () => {
  it('ne laisse aucune case déborder latéralement', () => {
    const insets = build({ top: 64, bottom: 0 });

    for (const [x, z] of corners()) {
      const p = toScreen(x, z, insets);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(SCREEN_W);
    }
  });

  it('ne laisse aucune case passer sous le HUD ni sortir par le bas', () => {
    const insets = build({ top: 64, bottom: 0 });

    for (const [x, z] of corners()) {
      const p = toScreen(x, z, insets);
      expect(p.y).toBeGreaterThanOrEqual(insets.top);
      expect(p.y).toBeLessThanOrEqual(SCREEN_H);
    }
  });

  it('reste contenu même avec un HUD encombrant', () => {
    // Dans le jeu réel le HUD prend bien plus de place qu'en page d'aperçu :
    // si le cadrage ne le suivait pas, le défaut ne ferait qu'empirer.
    const insets = build({ top: 120, bottom: 160 });

    for (const [x, z] of corners()) {
      const p = toScreen(x, z, insets);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(SCREEN_W);
      expect(p.y).toBeGreaterThanOrEqual(insets.top);
      expect(p.y).toBeLessThanOrEqual(SCREEN_H - insets.bottom);
    }
  });
});

describe('3D-43 — le plateau est centré dans la zone libre', () => {
  it('centre le parcours horizontalement', () => {
    const insets = build({ top: 64, bottom: 0 });

    const center = toScreen(BOARD_CENTER.x, BOARD_CENTER.z, insets);

    expect(center.x).toBeCloseTo(SCREEN_W / 2, 0);
  });

  it('centre le parcours sous le HUD, et non derrière lui', () => {
    const insets = build({ top: 64, bottom: 0 });

    const center = toScreen(BOARD_CENTER.x, BOARD_CENTER.z, insets);

    // Le milieu de la bande laissée libre, en pixels du canvas. Centrer dans
    // l'écran ENTIER pousserait le plateau derrière le bandeau.
    expect(center.y).toBeCloseTo(insets.top + (SCREEN_H - insets.top) / 2, 0);
  });

  it('suit le HUD quand il grandit', () => {
    const insets = build({ top: 120, bottom: 160 });

    const center = toScreen(BOARD_CENTER.x, BOARD_CENTER.z, insets);

    expect(center.y).toBeCloseTo(
      insets.top + (SCREEN_H - insets.top - insets.bottom) / 2,
      0
    );
  });
});

describe('3D-43 — le cadrage survit à la rotation', () => {
  it('garde le parcours centré quel que soit l\'angle', () => {
    const insets = build({ top: 64, bottom: 0 });

    for (const yaw of [0, 45, 90, 180, 270]) {
      scene.resetView();
      scene.orbitBy(yaw, 0);

      const center = toScreen(BOARD_CENTER.x, BOARD_CENTER.z, insets);

      expect(center.x).toBeCloseTo(SCREEN_W / 2, 0);
      expect(center.y).toBeCloseTo(insets.top + (SCREEN_H - insets.top) / 2, 0);
    }
  });

  it('garde tout le parcours visible quel que soit l\'angle', () => {
    // C'est l'exigence de #41 — montrer tout le parcours — qui doit tenir
    // maintenant que la caméra tourne, et non seulement à la vue par défaut.
    const insets = build({ top: 64, bottom: 0 });

    for (const yaw of [0, 45, 90, 135, 180, 225, 270, 315]) {
      scene.resetView();
      scene.orbitBy(yaw, 0);

      for (const [x, z] of corners()) {
        const p = toScreen(x, z, insets);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(SCREEN_W);
        expect(p.y).toBeGreaterThanOrEqual(insets.top);
        expect(p.y).toBeLessThanOrEqual(SCREEN_H);
      }
    }
  });
});
