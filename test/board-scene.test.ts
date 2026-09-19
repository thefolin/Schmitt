import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BoardScene } from '@/features/board/scene3d/board-scene';

/**
 * 3D-01 — le socle : une seule source de vérité pour l'observateur.
 *
 * jsdom n'a pas de WebGL : `WebGLRenderer` échoue à la construction. C'est
 * exactement le chemin de repli qu'on veut vérifier — sur un appareil Android
 * sans accélération graphique, le jeu doit se rabattre sur l'ancien rendu au
 * lieu d'afficher un écran noir.
 *
 * Les tests qui demandent un vrai contexte graphique (pixels, matrices de
 * projection) n'ont pas leur place ici : ils relèvent d'une vérification en
 * navigateur réel, comme celle de `tools/test-drive/`.
 */

let container: HTMLElement;
let scene: BoardScene | null = null;

beforeEach(() => {
  document.body.innerHTML = '<div id="boardCamera"></div>';
  container = document.getElementById('boardCamera')!;
  // jsdom donne une taille nulle à tout : on simule un écran de téléphone.
  Object.defineProperty(container, 'clientWidth', { value: 390, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: 844, configurable: true });
});

afterEach(() => {
  scene?.dispose();
  scene = null;
  vi.restoreAllMocks();
});

describe('3D-01 — repli quand WebGL manque à l\'appel', () => {
  it('se construit sans lever, même sans contexte graphique', () => {
    // Un appareil Android 5.1 sans accélération, ou une WebView bridée par le
    // constructeur : le jeu ne doit pas planter au démarrage.
    expect(() => {
      scene = new BoardScene({ container });
    }).not.toThrow();
  });

  it('signale que le rendu 3D est indisponible', () => {
    scene = new BoardScene({ container });

    // L'appelant peut alors retomber sur l'ancien rendu en connaissance de
    // cause, au lieu d'afficher un canvas vide.
    expect(scene.isAvailable()).toBe(false);
  });

  it('reste pilotable sans contexte : aucune méthode ne lève', () => {
    scene = new BoardScene({ container });

    expect(() => {
      scene!.setBoardExtent([{ x: 0, z: 0 }], 120);
      scene!.setUserZoom(2);
      scene!.panBy(10, 10);
      scene!.resetView();
      scene!.layout();
      scene!.start();
      scene!.stop();
    }).not.toThrow();
  });

  it('se détruit proprement, même sans avoir rien créé', () => {
    scene = new BoardScene({ container });

    expect(() => scene!.dispose()).not.toThrow();
  });
});

describe('3D-01 — le cadrage est exposé, pas enfoui dans le rendu', () => {
  it('donne le cadrage retenu pour le parcours déclaré', () => {
    scene = new BoardScene({ container });

    // Le plateau officiel : large et plat.
    const tiles = [];
    for (let col = 0; col < 10; col++) tiles.push({ x: col * 135, z: 0 });
    for (let col = 0; col < 10; col++) tiles.push({ x: col * 135, z: 675 });

    scene.setBoardExtent(tiles, 120);

    // En portrait, il doit tourner d'un quart de tour (mesuré : +68 %).
    expect(scene.getFraming().yawDeg).toBe(90);
  });

  it('s\'adapte à la forme du parcours, sans rien présumer', () => {
    scene = new BoardScene({ container });

    // Un parcours en colonne est déjà dans le bon sens pour un écran haut.
    const column = Array.from({ length: 12 }, (_, i) => ({ x: 0, z: i * 135 }));
    scene.setBoardExtent(column, 120);

    expect(scene.getFraming().yawDeg).toBe(0);
  });

  it('recadre quand le parcours change', () => {
    scene = new BoardScene({ container });

    scene.setBoardExtent([{ x: 0, z: 0 }], 120);
    const small = scene.getFraming().scale;

    const wide = Array.from({ length: 20 }, (_, i) => ({ x: i * 135, z: 0 }));
    scene.setBoardExtent(wide, 120);

    // Un parcours plus grand doit être davantage réduit pour tenir.
    expect(scene.getFraming().scale).toBeLessThan(small);
  });
});

describe('3D-01 — les réglages du joueur (#15)', () => {
  beforeEach(() => {
    scene = new BoardScene({ container });
    scene.setBoardExtent([{ x: 0, z: 0 }], 120);
  });

  it('retient le zoom demandé', () => {
    scene!.setUserZoom(2);
    expect(scene!.getUserZoom()).toBe(2);
  });

  it('borne le zoom : ni plateau invisible, ni case unique en plein écran', () => {
    scene!.setUserZoom(100);
    expect(scene!.getUserZoom()).toBeLessThanOrEqual(3);

    scene!.setUserZoom(0.01);
    expect(scene!.getUserZoom()).toBeGreaterThanOrEqual(0.5);
  });

  it('revient au cadrage automatique', () => {
    scene!.setUserZoom(2.5);
    scene!.panBy(120, 80);

    scene!.resetView();

    expect(scene!.getUserZoom()).toBe(1);
  });
});

describe('3D-01 — la boucle de rendu ne tourne pas pour rien', () => {
  it('s\'arrête quand la page passe en arrière-plan', () => {
    scene = new BoardScene({ container });
    const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame');

    scene.start();
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    // Sur Android, continuer à dessiner en arrière-plan vide la batterie sans
    // que personne ne regarde.
    expect(cancel).toHaveBeenCalled();

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  it('libère le contexte graphique à la destruction', () => {
    // Android limite le nombre de contextes WebGL simultanés : sans
    // libération, quelques parties suffisent à ne plus pouvoir en créer.
    scene = new BoardScene({ container });
    scene.start();

    scene.dispose();

    // Après destruction, plus rien ne doit répondre ni relancer la boucle.
    expect(scene.isAvailable()).toBe(false);
    expect(() => scene!.layout()).not.toThrow();
  });

  it('retire ses écouteurs globaux à la destruction', () => {
    scene = new BoardScene({ container });
    const remove = vi.spyOn(window, 'removeEventListener');

    scene.dispose();

    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
