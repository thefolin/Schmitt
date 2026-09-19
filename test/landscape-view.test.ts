import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BoardScene } from '@/features/board/scene3d/board-scene';

/**
 * 3D-48 — le plateau vu de face, en paysage.
 *
 * Quentin : « positionner la caméra devant le plateau », et « le jeu mobile
 * sera en orientation HORIZONTALE ».
 *
 * MESURÉ AVANT DE CODER, et ça change une décision : en paysage, le plateau
 * ENTIER passe le critère des 48 px sur tous les appareils visés — 67 px sur
 * un Pixel 10, 58 sur un iPhone SE, 56 sur un 5 pouces. La vue suivie de #45
 * existait parce qu'en portrait le plateau entier tombait à 40 px. Ce
 * problème-là n'existe plus en paysage.
 *
 * Mieux : sur un Pixel 10 en paysage, la vue d'ensemble (67,2 px) est
 * MEILLEURE que la vue suivie (63,8 px). Suivre le pion n'y gagne rien et
 * fait perdre la vision du parcours.
 *
 * D'où la règle : la vue par défaut se choisit selon la FORME DE L'ÉCRAN,
 * comme le quart de tour de #41 se choisit selon la forme du plateau. On ne
 * fige pas un choix qui dépend du contexte.
 */

const TOUCH_TARGET = 48;

let container: HTMLElement;
let scene: BoardScene;

function officialBoard(): { x: number; z: number }[] {
  const tiles = [];
  for (let col = 0; col < 10; col++) tiles.push({ x: col * 135, z: 0 });
  for (let col = 0; col < 10; col++) tiles.push({ x: col * 135, z: 675 });
  return tiles;
}

function mount(w: number, h: number, insets = { top: 60, bottom: 60 }): void {
  document.body.innerHTML = '<div id="boardCamera"></div>';
  container = document.getElementById('boardCamera')!;
  Object.defineProperty(container, 'clientWidth', { value: w, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: h, configurable: true });
  scene = new BoardScene({ container, hudInsets: insets });
  scene.setBoardExtent(officialBoard(), 120);
}

afterEach(() => scene?.dispose());

describe('3D-48 — en paysage, tout le plateau se lit', () => {
  it('tient le critère des 48 px en montrant le parcours entier', () => {
    for (const [w, h] of [[932, 412], [667, 375], [640, 360]] as [number, number][]) {
      mount(w, h);
      scene.showWholeBoard();

      expect(scene.worldToScreenPixels(120)).toBeGreaterThanOrEqual(TOUCH_TARGET);
      scene.dispose();
    }
  });

  it('ne tourne pas le plateau en paysage', () => {
    // Le plateau officiel est large et plat, un écran paysage aussi : ils ont
    // la même forme. La caméra « devant le plateau » tombe donc juste sans
    // quart de tour à expliquer au joueur.
    mount(932, 412);
    scene.showWholeBoard();

    expect(scene.getFraming().yawDeg).toBe(0);
  });

  it('tourne encore le plateau en portrait', () => {
    // L'acquis de #41 n'est pas perdu : en portrait le quart de tour reste
    // gagnant, et c'est mesuré, pas supposé.
    mount(412, 932, { top: 96, bottom: 88 });
    scene.showWholeBoard();

    expect(scene.getFraming().yawDeg).toBe(90);
  });
});

describe('3D-48 — la vue par défaut suit la forme de l\'écran', () => {
  it('montre tout le plateau en paysage', () => {
    mount(932, 412);

    expect(scene.prefersWholeBoard()).toBe(true);
  });

  it('suit le pion en portrait', () => {
    // En portrait le plateau entier tombe à 40 px, sous la cible tactile :
    // la vue suivie y reste nécessaire.
    mount(412, 932, { top: 96, bottom: 88 });

    expect(scene.prefersWholeBoard()).toBe(false);
  });

  it('bascule quand l\'appareil tourne', () => {
    mount(412, 932, { top: 96, bottom: 88 });
    expect(scene.prefersWholeBoard()).toBe(false);

    Object.defineProperty(container, 'clientWidth', { value: 932, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 412, configurable: true });
    scene.layout();

    expect(scene.prefersWholeBoard()).toBe(true);
  });
});

describe('3D-48 — la caméra regarde le plateau de face', () => {
  it('part de face, sans lacet', () => {
    // « Le plateau devient la vue fixe de référence » : on le regarde d'en
    // face, pas de trois quarts.
    mount(932, 412);

    expect(scene.getOrbit().yawDeg).toBe(0);
  });

  it('revient de face après avoir tourné', () => {
    mount(932, 412);
    scene.orbitBy(70, 15);

    scene.resetView();

    expect(scene.getOrbit().yawDeg).toBe(0);
    expect(scene.getOrbit().tiltDeg).toBeCloseTo(scene.getDefaultTiltDeg());
  });

  it('laisse regarder autour sans perdre la référence', () => {
    // La rotation libre reste possible — c'est le mode « regarder ». Ce qui
    // change, c'est qu'on en revient toujours.
    mount(932, 412);
    scene.orbitBy(120, 0);

    expect(scene.getOrbit().yawDeg).toBeCloseTo(120);

    scene.resetView();

    expect(scene.getOrbit().yawDeg).toBe(0);
  });
});

describe('3D-48 — le choix se fait sur la place RESTANTE', () => {
  it('tient compte du HUD, pas seulement des proportions de l\'écran', () => {
    // Un écran à peine plus large que haut, avec des bandeaux épais : la
    // bande libre y est plus large que haute, mais de peu. Comparer les
    // dimensions BRUTES de l'écran donnerait la même réponse dans les deux
    // cas, alors que c'est la surface réellement disponible qui décide du
    // cadrage — c'est elle qu'on mesure partout ailleurs.
    mount(700, 660, { top: 0, bottom: 0 });
    expect(scene.prefersWholeBoard()).toBe(true);
    scene.dispose();

    // Le même écran, avec un HUD qui mange 200 px : la bande libre passe à
    // 460 px de haut pour 700 de large. Toujours du paysage, en plus marqué.
    mount(700, 660, { top: 120, bottom: 80 });
    expect(scene.prefersWholeBoard()).toBe(true);
    scene.dispose();

    // Un écran haut, mais dont les bandeaux laissent une bande plus large
    // que haute : c'est un cadre paysage, quoi qu'en dise la forme de
    // l'écran. Sans le HUD dans le calcul, on répondrait « portrait » et on
    // suivrait le pion sans raison.
    mount(600, 700, { top: 200, bottom: 160 });
    expect(scene.prefersWholeBoard()).toBe(true);
  });
});
