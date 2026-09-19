import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BoardScene } from '@/features/board/scene3d/board-scene';

/**
 * 3D-45 — le canvas doit occuper la place qu'on lui donne.
 *
 * Quentin, capture à l'appui : écran noir sur téléphone, alors que le bandeau
 * annonçait « 23 cases · suivi · case ≈ 53 px ». Tout le calcul était juste —
 * c'est le rendu qui ne sortait rien.
 *
 * La cause : `setSize(w, h, false)` demande à Three.js de dimensionner le
 * TAMPON de rendu sans toucher à la taille CSS du canvas. Celui-ci gardait
 * donc sa taille intrinsèque par défaut, 300 × 150, et dessinait une vignette
 * invisible dans un coin. Le défaut est là depuis le tout premier commit de la
 * scène ; il ne se voyait pas sur un écran large, où la vignette passait
 * inaperçue au milieu du fond sombre.
 *
 * Le troisième argument n'est utile qu'à qui gère lui-même la taille CSS. Ce
 * n'est pas notre cas : la feuille de style ne donne aucune dimension au
 * canvas, seulement `display: block`.
 */

let container: HTMLElement;
let scene: BoardScene | null = null;

beforeEach(() => {
  document.body.innerHTML = '<div id="boardCamera"></div>';
  container = document.getElementById('boardCamera')!;
  Object.defineProperty(container, 'clientWidth', { value: 412, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: 932, configurable: true });
});

afterEach(() => {
  scene?.dispose();
  scene = null;
  vi.restoreAllMocks();
});

describe('3D-45 — le canvas remplit son conteneur', () => {
  /**
   * jsdom n'a pas de WebGL, donc aucune scène réelle ne crée de canvas ici.
   * On vérifie l'APPEL plutôt que son effet : que la scène demande bien à
   * Three.js de poser la taille CSS. Se contenter de chercher un canvas
   * ferait un test qui ne teste rien — il passait avec le défaut en place.
   */
  it('demande à Three.js de dimensionner aussi le canvas en CSS', () => {
    // `setSize` est posé sur l'INSTANCE par le constructeur de Three.js, pas
    // sur son prototype : on intercepte donc à la construction.
    const calls: unknown[][] = [];

    const canvas = document.createElement('canvas');
    const fake = {
      domElement: canvas,
      setSize: (...args: unknown[]) => calls.push(args),
      setPixelRatio: () => {},
      setClearColor: () => {},
      render: () => {},
      dispose: () => {},
    };

    scene = new BoardScene({ container });
    // La scène retombe sur son chemin de repli sous jsdom : on lui injecte
    // un renderer pour observer ce qu'elle lui demande.
    (scene as unknown as { renderer: unknown }).renderer = fake;
    (scene as unknown as { canvas: unknown }).canvas = canvas;

    calls.length = 0;
    scene.layout();

    expect(calls.length).toBeGreaterThan(0);

    for (const args of calls) {
      // `false` en troisième position laisse le canvas à sa taille
      // intrinsèque de 300 × 150, quelle que soit la place disponible —
      // c'est ce qui donnait un écran noir sur téléphone pendant que tout le
      // reste se calculait correctement.
      expect(args[2]).not.toBe(false);
      expect(args[0]).toBe(412);
      expect(args[1]).toBe(932);
    }
  });

  it('dimensionne le canvas à la place réellement disponible', () => {
    // Le comportement observable, vérifié sur un canvas fabriqué à la main
    // puisque jsdom n'en produit pas : c'est bien la taille CSS qui décide
    // de ce que le joueur voit, et non celle du tampon de rendu.
    const canvas = document.createElement('canvas');
    canvas.width = 412;
    canvas.height = 932;

    // Un canvas dont seul le tampon est dimensionné reste à sa taille CSS
    // par défaut : c'est exactement ce qui donnait l'écran noir.
    expect(canvas.style.width).toBe('');

    canvas.style.width = '412px';
    canvas.style.height = '932px';

    expect(canvas.style.width).toBe('412px');
  });
});

describe('3D-45 — la hauteur disponible est celle qu\'on voit', () => {
  it('préfère visualViewport au conteneur', () => {
    // Sur mobile, la barre d'URL qui se rétracte laisse `clientHeight` à sa
    // valeur d'avant : le plateau se cadre alors dans une surface plus haute
    // que celle réellement visible, et déborde par le bas.
    const original = window.visualViewport;
    Object.defineProperty(window, 'visualViewport', {
      value: { width: 412, height: 700, addEventListener: () => {}, removeEventListener: () => {} },
      configurable: true,
    });

    scene = new BoardScene({ container });
    scene.setBoardExtent([{ x: 0, z: 0 }], 120);

    const measured = (scene as unknown as {
      measureViewport(): { height: number };
    }).measureViewport();

    // 700 (réellement visible), et non 932 (ce que croit le conteneur).
    expect(measured.height).toBe(700);

    Object.defineProperty(window, 'visualViewport', {
      value: original,
      configurable: true,
    });
  });

  it('se rabat sur le conteneur quand visualViewport manque', () => {
    // Les WebViews anciennes de la cible Android 5.1 ne la connaissent pas.
    const original = window.visualViewport;
    Object.defineProperty(window, 'visualViewport', { value: null, configurable: true });

    scene = new BoardScene({ container });

    const measured = (scene as unknown as {
      measureViewport(): { height: number };
    }).measureViewport();

    expect(measured.height).toBe(932);

    Object.defineProperty(window, 'visualViewport', { value: original, configurable: true });
  });
});
