import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, type Object3D } from 'three';
import { BoardScene, DICE_PANEL_LAYER } from '@/features/board/scene3d/board-scene';

/**
 * LE DÉ CHANGE DE POINT DE VUE, PAS D'OBJET.
 *
 * POURQUOI CE FICHIER EXISTE : le second passage dessinait TOUTE la scène
 * dans le rectangle du panneau. Le plateau y occupait tout le cadre, vu de
 * très près, et le dé s'y perdait — Quentin : « les dés ne sont plus
 * visibles du tout ».
 *
 * Le calque sépare les deux vues sans rien dupliquer : c'est le même dé, la
 * même scène, et la caméra du panneau ne regarde que lui. Dupliquer l'objet
 * rouvrirait le défaut que `dice-3d-scene.ts` documente — la face vue
 * pouvant différer de la face jouée.
 *
 * RÈGLE MÉTIER (Quentin, 26/10/2026) :
 *   panneau fermé  → le dé roule sur le PLATEAU
 *   panneau ouvert → le dé roule dans le PANNEAU, et quitte le plateau
 */

let container: HTMLElement;
let scene: BoardScene | null = null;

/** Un dé d'essai, avec un enfant : le calque doit descendre sur les deux. */
function fakeDie(): Group {
  const group = new Group();
  group.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()));

  return group;
}

/** Le panneau, réduit à ce que la scène lui demande. */
const panel = {
  getBoundingClientRect: () =>
    ({ left: 290, top: 0, width: 210, height: 915, right: 500, bottom: 915, x: 290, y: 0, toJSON: () => ({}) }) as DOMRect,
};

/** Les calques portés par le dé et toute sa descendance. */
function layersOf(die: Object3D): number[] {
  const seen: number[] = [];
  die.traverse((object: Object3D) => seen.push(object.layers.mask));

  return seen;
}

/** Le masque d'un calque unique, tel que `layers.set` le pose. */
const maskOf = (layer: number): number => 1 << layer;

beforeEach(() => {
  document.body.innerHTML = '<div id="boardCamera"></div>';
  container = document.getElementById('boardCamera')!;
  Object.defineProperty(container, 'clientWidth', { value: 500, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: 915, configurable: true });
  scene = new BoardScene({ container });
});

afterEach(() => {
  scene?.dispose();
  scene = null;
  vi.restoreAllMocks();
});

describe('Le dé ne vit QUE dans le panneau', () => {
  it('le pose sur le calque du panneau, une fois pour toutes', () => {
    // RÈGLE DE QUENTIN (26/10/2026) : « retirer le dé du plateau central
    // complètement. Le dé n'apparaît SEULEMENT que dans le panneau. »
    // La caméra du plateau ne regarde que le calque ordinaire : poser le dé
    // ailleurs suffit à l'en faire disparaître, sans rien dupliquer.
    const die = fakeDie();

    scene!.keepDiceInPanel(die);

    expect(layersOf(die)).toEqual([maskOf(DICE_PANEL_LAYER), maskOf(DICE_PANEL_LAYER)]);
  });

  it('emmène aussi les ENFANTS du dé', () => {
    // Un calque posé sur le seul groupe laisserait les faces sur le
    // plateau : le dé serait à moitié ici, à moitié là.
    const die = fakeDie();

    scene!.keepDiceInPanel(die);

    expect(new Set(layersOf(die)).size).toBe(1);
    expect(layersOf(die)).toHaveLength(2);
  });

  it('NE LE REND PAS au plateau quand le panneau se ferme', () => {
    // C'EST LE CŒUR DE LA NOUVELLE RÈGLE, et l'inverse de la précédente :
    // le dé ne doit JAMAIS réapparaître sur le plateau, pas même panneau
    // fermé. Le joueur ouvre le panneau pour lancer — le bouton « Lancer »
    // s'en charge pour lui.
    const die = fakeDie();

    scene!.keepDiceInPanel(die);
    scene!.setDiceView({ panel, target: { x: 0, y: 0, z: 0 }, size: 10, die });
    scene!.setDiceView(null);

    expect(layersOf(die)).toEqual([maskOf(DICE_PANEL_LAYER), maskOf(DICE_PANEL_LAYER)]);
  });
});

describe('Viser le dé dans le panneau', () => {
  it('ne donne aucune cible tant que le panneau est fermé', () => {
    // Le geste de prise s'appuie dessus : sans vue, pas de dé à attraper.
    expect(scene!.diceViewAim()).toBeNull();
  });

  it('n\'en donne pas davantage sans contexte graphique', () => {
    // SANS WEBGL IL N'Y A PAS DE CANVAS, donc pas de repère écran : la visée
    // n'a rien à offrir, et elle doit le dire plutôt que de rendre un
    // rectangle inventé. C'est le cas d'un appareil sans accélération, le
    // même chemin de repli que teste `board-scene.test.ts`.
    scene!.setDiceView({ panel, target: { x: 0, y: 0, z: 0 }, size: 10, die: fakeDie() });

    expect(scene!.diceViewAim()).toBeNull();
  });

  it('vise avec une caméra DISTINCTE de celle du plateau', () => {
    // C'est tout l'objet de `diceViewAim` : le geste lance un rayon depuis
    // une caméra, et viser avec celle du plateau manquerait le dé de
    // plusieurs centaines d'unités — ce sont deux points de vue sur le même
    // objet. On vérifie la séparation, que WebGL manque ou non.
    const dicePanelCamera = (scene as unknown as {
      diceCamera: unknown;
    }).diceCamera;

    expect(dicePanelCamera).toBeDefined();
    expect(dicePanelCamera).not.toBe(scene!.camera);
  });
});

describe('La caméra du panneau voit de PRÈS', () => {
  it('garde un tronc de vision serré, et non celui du plateau', () => {
    // LE `far` DU PLATEAU EST 40 000, pour contenir tout le parcours. La
    // caméra du panneau, elle, regarde un objet de quelques dizaines
    // d'unités à quelques centaines de distance : garder ce `far` écrasait
    // la précision de profondeur — le dé se projetait à z = 0,997, au ras
    // du plan lointain. Mesuré en projetant sa position dans le repère de
    // cette caméra, après que la trace du rendu eut montré qu'il dessinait
    // pourtant bien.
    const camera = (scene as unknown as {
      diceCamera: { near: number; far: number };
    }).diceCamera;

    expect(camera.far).toBeLessThanOrEqual(5000);
    expect(camera.near).toBeGreaterThanOrEqual(10);
  });
});

describe('Le dé n\'est jamais dupliqué', () => {
  it('garde le MÊME objet des deux côtés', () => {
    // C'est tout l'intérêt du calque. `dice-3d-scene.ts` rappelle que les
    // quatre défauts successifs du dé en CSS venaient de représentations
    // dupliquées : deux objets, et la face vue peut différer de la face
    // jouée — défaut qui se conteste à table.
    const die = fakeDie();
    const before = die.children[0];

    scene!.setDiceView({ panel, target: { x: 0, y: 0, z: 0 }, size: 10, die });
    scene!.setDiceView(null);

    expect(die.children).toHaveLength(1);
    expect(die.children[0]).toBe(before);
  });
});

describe('Le branchement ne fait pas tomber le jeu', () => {
  it('accepte une vue sans dé', () => {
    expect(() => {
      scene!.setDiceView({ panel, target: { x: 0, y: 0, z: 0 }, size: 10 });
      scene!.setDiceView(null);
    }).not.toThrow();
  });
});
