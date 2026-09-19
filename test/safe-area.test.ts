import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Vector3 } from 'three';
import { BoardScene } from '@/features/board/scene3d/board-scene';

/**
 * 3D-43 — les encoches système entrent dans le cadrage.
 *
 * Quentin : « sur un téléphone comme le Google Pixel 10 le cadrage est mal
 * mis ».
 *
 * Avec `viewport-fit=cover`, la page occupe TOUT l'écran : encoche du haut et
 * barre de gestes du bas comprises. Le canvas s'étend donc sous des zones que
 * le système masque. Les traiter dans le seul padding CSS du bandeau ne suffit
 * pas — la scène 3D, qui se cadre sur le canvas, centre alors le plateau par
 * rapport à un rectangle dont une partie n'est pas visible.
 *
 * Le défaut est invisible en développement : sur un navigateur de bureau ces
 * valeurs sont nulles, et le cadrage paraît correct.
 */

const W = 412;
const H = 932;

let container: HTMLElement;
let scene: BoardScene;

function officialBoard(): { x: number; z: number }[] {
  const tiles = [];
  for (let col = 0; col < 10; col++) tiles.push({ x: col * 135, z: 0 });
  for (let col = 0; col < 10; col++) tiles.push({ x: col * 135, z: 675 });
  return tiles;
}

/**
 * Encoches simulées, que jsdom rapporte nulles par défaut.
 *
 * La sonde est installée UNE FOIS, avant toute scène : elle est mise en cache
 * et retirée à la destruction, si bien qu'un mock posé entre deux scènes ne
 * serait pas vu par la première.
 */
let fakeTop = 0;
let fakeBottom = 0;

function installSafeAreaProbe(): void {
  const real = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
    const style = real.call(window, el);
    if ((el as HTMLElement).getAttribute?.('aria-hidden') !== 'true') return style;

    return {
      ...style,
      getPropertyValue: (prop: string) => {
        if (prop === 'padding-top') return `${fakeTop}px`;
        if (prop === 'padding-bottom') return `${fakeBottom}px`;
        return '0px';
      },
    } as CSSStyleDeclaration;
  });
}

/** Le centre du plateau, en coordonnées normalisées verticales. */
function boardCenterY(): number {
  return new Vector3((9 * 135) / 2, 0, 675 / 2).project(scene.camera).y;
}

function buildWith(top: number, bottom: number): number {
  fakeTop = top;
  fakeBottom = bottom;

  document.body.innerHTML = '<div id="boardCamera"></div>';
  container = document.getElementById('boardCamera')!;
  Object.defineProperty(container, 'clientWidth', { value: W, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: H, configurable: true });

  scene = new BoardScene({ container, hudInsets: { top: 64, bottom: 0 } });
  scene.setBoardExtent(officialBoard(), 120);

  const y = boardCenterY();
  scene.dispose();

  return y;
}

beforeEach(() => {
  document.body.innerHTML = '<div id="boardCamera"></div>';
  container = document.getElementById('boardCamera')!;
  Object.defineProperty(container, 'clientWidth', { value: W, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: H, configurable: true });
});

afterEach(() => {
  scene?.dispose();
  vi.restoreAllMocks();
});

describe('3D-43 — le plateau se centre dans la surface réellement visible', () => {
  beforeEach(() => installSafeAreaProbe());

  it('descend le plateau quand une encoche occupe le haut', () => {
    const without = buildWith(0, 0);
    const withNotch = buildWith(48, 0);

    // Le centre visé descend : l'encoche mange le haut, la bande libre est
    // plus basse, le plateau doit suivre. Sans cela il se centre sur un
    // rectangle dont le système masque le sommet — c'est le décalage que
    // Quentin voit sur son Pixel et qui ne se reproduit pas sur un bureau.
    expect(withNotch).toBeLessThan(without);
  });

  it('remonte le plateau quand la barre de gestes occupe le bas', () => {
    const without = buildWith(0, 0);
    const withBar = buildWith(0, 24);

    expect(withBar).toBeGreaterThan(without);
  });

  it('compose les deux encoches', () => {
    const notchOnly = buildWith(48, 0);
    const both = buildWith(48, 24);

    // La barre du bas compense une part de l'encoche du haut : le plateau
    // remonte par rapport au cas où seule l'encoche compte.
    expect(both).toBeGreaterThan(notchOnly);
  });

  it('se passe d\'encoches sans rien casser', () => {
    // Un navigateur de bureau, ou une WebView Android 5.1 qui ignore env().
    fakeTop = 0;
    fakeBottom = 0;

    scene = new BoardScene({ container, hudInsets: { top: 64, bottom: 0 } });

    expect(() => scene.setBoardExtent(officialBoard(), 120)).not.toThrow();
    expect(scene.getFraming().yawDeg).toBe(90);
  });
});
