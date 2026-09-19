import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BoardScene } from '@/features/board/scene3d/board-scene';

/**
 * 3D-45 — la vue suit le pion du joueur courant.
 *
 * Quentin a tranché : plutôt que de montrer tout le parcours avec des cases
 * illisibles, on cadre une portion autour du joueur. C'est le même arbitrage
 * que pour l'effet Monopoly, et il retombe du même côté — la lisibilité.
 *
 * LE CRITÈRE EST CHIFFRÉ : sur un 5 pouces, une case doit faire au moins
 * 48 px — la cible tactile — SANS zoomer.
 *
 * Une correction de méthode qui décide de toute la conception : le paramètre
 * n'est PAS un nombre de cases. Mesuré sur le plateau officiel, cadrer 12
 * cases donne exactement la même taille que d'en cadrer 23 (40 px), parce que
 * le plateau est fait de deux rangées de dix : les douze premières couvrent
 * déjà toute la largeur, et c'est elle qui contraint. Ce qu'on doit borner,
 * c'est l'EMPRISE cadrée, pas le nombre de cases qu'elle contient. Un nombre
 * de cases ne voudrait d'ailleurs rien dire sur un plateau en U ou en cercle.
 */

const SMALL: [number, number] = [360, 640];
const HUD = { top: 210, bottom: 0 };

/** La cible tactile, et donc le seuil de lisibilité d'une case. */
const TOUCH_TARGET = 48;

let container: HTMLElement;
let scene: BoardScene;

/** Le plateau officiel : deux rangées de dix, plus les extrémités. */
function officialBoard(): { x: number; z: number }[] {
  const tiles = [];
  for (let col = 0; col < 10; col++) tiles.push({ x: col * 135, z: 0 });
  for (let col = 0; col < 10; col++) tiles.push({ x: col * 135, z: 675 });
  return tiles;
}

function mount([w, h]: [number, number]): void {
  document.body.innerHTML = '<div id="boardCamera"></div>';
  container = document.getElementById('boardCamera')!;
  Object.defineProperty(container, 'clientWidth', { value: w, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: h, configurable: true });
  scene = new BoardScene({ container, hudInsets: HUD });
}

afterEach(() => scene?.dispose());

describe('3D-45 — le critère chiffré de Quentin', () => {
  it('rend une case lisible sur un 5 pouces, sans zoomer', () => {
    mount(SMALL);
    scene.setBoardExtent(officialBoard(), 120);

    scene.followTile(0);

    expect(scene.worldToScreenPixels(120)).toBeGreaterThanOrEqual(TOUCH_TARGET);
    expect(scene.getUserZoom()).toBe(1);
  });

  it('tient le critère sur les appareils plus grands', () => {
    for (const device of [[375, 667], [412, 932]] as [number, number][]) {
      mount(device);
      scene.setBoardExtent(officialBoard(), 120);
      scene.followTile(5);

      expect(scene.worldToScreenPixels(120)).toBeGreaterThanOrEqual(TOUCH_TARGET);
      scene.dispose();
    }
  });

  it('tient le critère où que soit le pion sur le parcours', () => {
    mount(SMALL);
    scene.setBoardExtent(officialBoard(), 120);

    // Y compris aux extrémités, où la fenêtre déborde du plateau : la
    // recadrer sur ce qui reste donnerait des cases plus grosses à un bout
    // qu'à l'autre, et la vue changerait d'échelle en jouant.
    for (let tile = 0; tile < 20; tile++) {
      scene.followTile(tile);

      expect(scene.worldToScreenPixels(120)).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
  });

  it('garde une échelle constante, y compris près des bords', () => {
    mount(SMALL);
    scene.setBoardExtent(officialBoard(), 120);

    // La comparaison porte sur un COIN et le MILIEU, et non sur les deux
    // extrémités : celles-ci sont symétriques, et une fenêtre rognée sur ce
    // qui reste du plateau les traiterait à l'identique. Le défaut ne se voit
    // qu'en comparant un endroit où la fenêtre déborde à un endroit où elle
    // tient tout entière.
    const sizes = [0, 1, 5, 9, 10, 15, 19].map(tile => {
      scene.followTile(tile);
      return scene.worldToScreenPixels(120);
    });

    const spread = Math.max(...sizes) - Math.min(...sizes);

    // Une vue qui change d'échelle en jouant se remarque immédiatement, et
    // le joueur ne se l'explique pas.
    expect(spread).toBeLessThan(0.5);
  });
});

describe('3D-45 — la vue glisse avec le pion', () => {
  it('centre la vue sur la case suivie', () => {
    mount(SMALL);
    scene.setBoardExtent(officialBoard(), 120);

    scene.followTile(0);
    const first = scene.getCameraPosition();

    scene.followTile(9);
    const later = scene.getCameraPosition();

    // La caméra s'est déplacée le long du parcours.
    expect(Math.hypot(later.x - first.x, later.z - first.z)).toBeGreaterThan(100);
  });

  it('suit sans changer l\'angle de vue', () => {
    mount(SMALL);
    scene.setBoardExtent(officialBoard(), 120);
    scene.orbitBy(35, 0);

    const before = scene.getOrbit();
    scene.followTile(12);

    // Le suivi déplace la vue, il ne la réoriente pas : un joueur qui a
    // tourné la caméra ne doit pas la voir pivoter à chaque tour de jeu.
    expect(scene.getOrbit().yawDeg).toBeCloseTo(before.yawDeg);
    expect(scene.getOrbit().tiltDeg).toBeCloseTo(before.tiltDeg);
  });
});

describe('3D-45 — la vue d\'ensemble reste accessible', () => {
  it('montre tout le parcours à la demande', () => {
    mount(SMALL);
    scene.setBoardExtent(officialBoard(), 120);

    scene.followTile(3);
    const followed = scene.worldToScreenPixels(120);

    scene.showWholeBoard();
    const whole = scene.worldToScreenPixels(120);

    // Tout le plateau tient forcément à plus petite échelle que la portion.
    expect(whole).toBeLessThan(followed);
  });

  it('revient au suivi après la vue d\'ensemble', () => {
    mount(SMALL);
    scene.setBoardExtent(officialBoard(), 120);

    scene.followTile(3);
    const followed = scene.worldToScreenPixels(120);

    scene.showWholeBoard();
    scene.followTile(3);

    expect(scene.worldToScreenPixels(120)).toBeCloseTo(followed, 1);
  });

  it('dit dans quel mode on est', () => {
    mount(SMALL);
    scene.setBoardExtent(officialBoard(), 120);

    scene.followTile(3);
    expect(scene.isFollowing()).toBe(true);

    scene.showWholeBoard();
    expect(scene.isFollowing()).toBe(false);
  });
});

describe('3D-45 — ce que #41 apporte n\'est pas perdu', () => {
  it('choisit encore l\'orientation d\'après la forme cadrée', () => {
    mount(SMALL);
    scene.setBoardExtent(officialBoard(), 120);

    // En vue d'ensemble, le plateau officiel se tourne d'un quart de tour.
    scene.showWholeBoard();
    expect(scene.getFraming().yawDeg).toBe(90);
  });

  it('applique le choix d\'orientation à la portion, pas au plateau entier', () => {
    mount(SMALL);

    // Un parcours en colonne : la portion suivie est haute et étroite, elle
    // ne doit pas être tournée. Décider sur le plateau entier reviendrait à
    // cadrer la portion dans le mauvais sens.
    const column = Array.from({ length: 24 }, (_, i) => ({ x: 0, z: i * 135 }));
    scene.setBoardExtent(column, 120);
    scene.followTile(12);

    expect(scene.getFraming().yawDeg).toBe(0);
  });

  it('ne suppose rien de la forme du parcours', () => {
    mount(SMALL);

    // Un plateau en U, comme l'éditeur permet d'en composer.
    const u = [
      ...Array.from({ length: 6 }, (_, i) => ({ x: 0, z: i * 135 })),
      ...Array.from({ length: 5 }, (_, i) => ({ x: (i + 1) * 135, z: 5 * 135 })),
      ...Array.from({ length: 6 }, (_, i) => ({ x: 5 * 135, z: (4 - i) * 135 })),
    ];
    scene.setBoardExtent(u, 120);

    for (let tile = 0; tile < u.length; tile++) {
      scene.followTile(tile);

      expect(scene.worldToScreenPixels(120)).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
  });
});
