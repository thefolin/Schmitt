import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BoardScene } from '@/features/board/scene3d/board-scene';

/**
 * LA SCÈNE SE MESURE SUR SON CONTENEUR, jamais sur la fenêtre.
 *
 * POURQUOI CE FICHIER EXISTE : depuis que le panneau des dés occupe une
 * colonne, `#scene` est plus étroit que la fenêtre. Or `measureViewport`
 * préférait `visualViewport` — la FENÊTRE — au conteneur. La caméra cadrait
 * donc sur une largeur qui n'existe pas, et le plateau partait sous le
 * panneau.
 *
 * C'est exactement le défaut consigné dans TODO.md §2 : « le cadrage se
 * cassait en portrait : 8 cases visibles sur 23 ». La contrainte de
 * CLAUDE.md le dit sans détour — le cadrage en portrait se traite EN
 * PREMIER, jamais en dernier.
 *
 * `measureViewport` est privée : on y accède par indexation plutôt que de
 * l'exposer. Ce qu'on protège est son RÉSULTAT, pas sa signature.
 */

let container: HTMLElement;
let scene: BoardScene | null = null;

/** Pose les dimensions d'un conteneur, que jsdom laisse à zéro. */
function sized(width: number, height: number): HTMLElement {
  const element = document.getElementById('boardCamera')!;
  Object.defineProperty(element, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(element, 'clientHeight', { value: height, configurable: true });

  return element;
}

/** Fait croire au navigateur que la fenêtre fait cette taille. */
function windowIs(width: number, height: number): void {
  Object.defineProperty(window, 'visualViewport', {
    value: { width, height, addEventListener: vi.fn(), removeEventListener: vi.fn() },
    configurable: true,
  });
}

/** La mesure que la caméra emploiera pour cadrer. */
function measured(): { width: number; height: number } {
  return (scene as unknown as {
    measureViewport(): { width: number; height: number };
  }).measureViewport();
}

beforeEach(() => {
  document.body.innerHTML = '<div id="boardCamera"></div>';
  container = sized(390, 844);
});

afterEach(() => {
  scene?.dispose();
  scene = null;
  vi.restoreAllMocks();
});

describe('Cadrage — la scène ne déborde pas de son conteneur', () => {
  it('s\'en tient au conteneur quand le panneau des dés le rétrécit', () => {
    // LE CAS QUI CASSAIT TOUT : fenêtre de 390 px, mais `#scene` n'en occupe
    // que 230 parce que le panneau prend la droite. Mesurer 390 ferait
    // cadrer la caméra sur 160 px qui n'existent pas.
    windowIs(390, 844);
    sized(230, 844);

    scene = new BoardScene({ container });

    expect(measured().width).toBe(230);
  });

  it('ne rétrécit RIEN quand le conteneur occupe tout l\'écran', () => {
    // Le panneau fermé est le cas ordinaire : les deux mesures coïncident,
    // et le correctif ne doit alors rien changer.
    windowIs(390, 844);
    sized(390, 844);

    scene = new BoardScene({ container });

    expect(measured()).toEqual({ width: 390, height: 844 });
  });

  it('garde la mesure du navigateur quand elle est PLUS PETITE', () => {
    // C'est la raison d'être de `visualViewport` : le clavier ouvert, ou la
    // barre d'URL déployée, réduisent la zone réellement visible sans que
    // le conteneur le sache. On ne doit pas perdre ce comportement.
    windowIs(390, 500);
    sized(390, 844);

    scene = new BoardScene({ container });

    expect(measured().height).toBe(500);
  });

  it('se rabat sur le conteneur quand le navigateur ne sait rien', () => {
    // Les WebViews d'Android 5.1 — la cible — ne connaissent pas
    // `visualViewport`. Sans ce repli, le plateau disparaîtrait.
    Object.defineProperty(window, 'visualViewport', {
      value: null,
      configurable: true,
    });
    sized(230, 844);

    scene = new BoardScene({ container });

    expect(measured()).toEqual({ width: 230, height: 844 });
  });

  it('ne rapporte jamais zéro, quoi qu\'annonce le navigateur', () => {
    // Une mesure nulle ferait disparaître le plateau : `aspect` vaudrait
    // zéro ou l'infini.
    windowIs(0, 0);
    sized(230, 844);

    scene = new BoardScene({ container });

    const { width, height } = measured();

    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });
});
