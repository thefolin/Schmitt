import { describe, it, expect, beforeEach } from 'vitest';
import { BoardCameraRenderer } from '@/features/board/camera/board.renderer.camera';
import { GameLogic } from '@/features/game/game.logic';
import type { TileConfig } from '@/core/models/Tile';
import type { BoardLayoutConfig } from '@/features/board/camera/board-layout.config';

/**
 * SCH-22 — la partie doit se jouer sur le plateau composé dans l'éditeur.
 *
 * Retour de Bastien (18/09/2026, capture 00000047) : « il joue les cases du
 * vrai schmitt... et pas du tout celle dans l'ordre que j'ai sélectionné dans
 * l'édition. »
 *
 * Sur sa capture, les six cases gardent leurs numéros de catalogue —
 * 0, 3, 6, 15, 19, 22 — au lieu d'être renumérotées 0 à 5. Ce `tileId` servait
 * d'index de position : le parcours était donc troué, et l'effet joué venait
 * du catalogue officiel et non de la case posée.
 */

/** Catalogue minimal : l'indice EST le tileId, comme TILE_CONFIGS. */
const catalog: TileConfig[] = Array.from({ length: 23 }, (_, i) => ({
  type: 'drink_2' as TileConfig['type'],
  icon: '🍺',
  name: `CASE-${i}`,
}));
catalog[0] = { type: 'start' as TileConfig['type'], icon: '🏁', name: 'START' };
catalog[22] = { type: 'finish' as TileConfig['type'], icon: '🏆', name: 'FINISH' };

/** Le plateau de la capture 00000047 : 6 cases, numéros de catalogue épars. */
const BASTIEN_TILE_IDS = [0, 3, 6, 15, 19, 22];

const customLayout: BoardLayoutConfig = {
  gridRows: 1,
  gridCols: 6,
  tileSize: 120,
  tileGap: 15,
  placements: BASTIEN_TILE_IDS.map((tileId, i) => ({
    tileId,
    gridRow: 0,
    gridCol: i,
    size: 'full' as const,
  })),
};

function makeRenderer(layout: BoardLayoutConfig): BoardCameraRenderer {
  document.body.innerHTML = '<div id="boardCamera"></div>';
  const renderer = new BoardCameraRenderer('boardCamera');
  // @ts-expect-error — accès direct au layout : l'éditeur passe par un
  // chargement asynchrone qui n'a pas lieu d'être dans un test unitaire.
  renderer.boardLayout = layout;
  return renderer;
}

describe('SCH-22 — un plateau composé dans l\'éditeur est bien joué', () => {
  let renderer: BoardCameraRenderer;

  beforeEach(() => {
    renderer = makeRenderer(customLayout);
  });

  it('compte les cases du parcours, pas celles du catalogue', () => {
    expect(renderer.getTileCount()).toBe(6);
  });

  it('chaque position du parcours renvoie la case posée à ce rang', () => {
    BASTIEN_TILE_IDS.forEach((tileId, position) => {
      expect(renderer.getTileIdAtPosition(position)).toBe(tileId);
    });
  });

  it('ne laisse aucun trou : toutes les positions 0..5 sont occupées', () => {
    // C'est le cœur du bug : les positions 1, 2, 4, 5 étaient vides parce que
    // l'index utilisé était le tileId (0, 3, 6, 15, 19, 22).
    for (let position = 0; position < 6; position++) {
      expect(renderer.getTileIdAtPosition(position)).not.toBeNull();
    }
  });

  it('ne déborde pas au-delà du parcours', () => {
    expect(renderer.getTileIdAtPosition(6)).toBeNull();
  });

  it('applique l\'effet de la case POSÉE, pas celle du catalogue au même rang', () => {
    // Position 1 porte la case de catalogue 3. Avant le correctif, la partie
    // jouait la case 1 du plateau officiel.
    const tileId = renderer.getTileIdAtPosition(1);
    expect(tileId).toBe(3);
    expect(catalog[tileId!].name).toBe('CASE-3');
  });

  it('dessine une case par position du parcours, dans l\'ordre choisi', () => {
    renderer.render(catalog, []);

    const drawn = Array.from(document.querySelectorAll('.board-tile'));

    // Avant le correctif, les 23 cases du catalogue étaient dessinées : le
    // joueur voyait le plateau officiel et non le sien.
    expect(drawn).toHaveLength(6);

    // Et chaque case dessinée est bien celle POSÉE à ce rang.
    const names = drawn.map(el => el.querySelector('.tile-icon')?.textContent ?? '');
    expect(names).toEqual(
      BASTIEN_TILE_IDS.map(id => catalog[id].icon)
    );
  });

  it('renumérote les cases de 0 à 5 dans le parcours', () => {
    renderer.render(catalog, []);

    // C'est la signature exacte du bug sur la capture 00000047 : les cases
    // affichaient leurs numéros de catalogue (0, 3, 6, 15, 19, 22) au lieu
    // d'être renumérotées selon le parcours.
    const numbers = Array.from(
      document.querySelectorAll<HTMLElement>('.board-tile')
    ).map(el => el.dataset.index);

    expect(numbers).toEqual(['0', '1', '2', '3', '4', '5']);
  });

  it('place chaque case à sa position de parcours, sans trou', () => {
    renderer.render(catalog, []);

    // Les 6 cases sont alignées sur une ligne, à pas régulier. Quand le tileId
    // servait d'index, les cases se retrouvaient dispersées aux abscisses
    // 0, 3, 6, 15, 19 et 22 pas — le parcours devenait illisible.
    const step = customLayout.tileSize + customLayout.tileGap;
    const lefts = Array.from(document.querySelectorAll<HTMLElement>('.board-tile')).map(el =>
      Math.round(parseFloat(el.style.left))
    );

    expect(lefts).toEqual(BASTIEN_TILE_IDS.map((_, i) => i * step));
  });

  it('accepte deux fois la même case du catalogue', () => {
    // L'éditeur le permet ; la recherche par tileId renvoyait alors deux fois
    // le même placement et superposait les cases.
    const repeated: BoardLayoutConfig = {
      ...customLayout,
      placements: [7, 7, 7].map((tileId, i) => ({
        tileId,
        gridRow: 0,
        gridCol: i,
        size: 'full' as const,
      })),
    };
    const r = makeRenderer(repeated);
    r.render(catalog, []);

    expect(r.getTileCount()).toBe(3);
    expect(document.querySelectorAll('.board-tile')).toHaveLength(3);
  });
});

describe('SCH-22 — la logique de jeu suit la taille du plateau édité', () => {
  it('la dernière case du plateau édité est la position finale', () => {
    const renderer = makeRenderer(customLayout);
    const g = new GameLogic();
    g.setBoardSize(renderer.getTileCount());
    g.startGame([
      { name: 'A', color: '#f00' },
      { name: 'B', color: '#00f' },
    ]);

    // 6 cases → positions 0 à 5
    expect(g.getLastPosition()).toBe(5);

    g.setPlayerPosition(0, 3);
    g.movePlayer(0, 2);
    expect(g.getPlayers()[0].position).toBe(5);
  });

  it('le retour vers START se fait sur le plateau édité', () => {
    const renderer = makeRenderer(customLayout);
    const g = new GameLogic();
    g.setBoardSize(renderer.getTileCount());
    g.startGame([
      { name: 'A', color: '#f00' },
      { name: 'B', color: '#00f' },
    ]);

    g.setPlayerPosition(0, 5);
    expect(g.claimSchmittPower(0)).toBe(true);

    g.movePlayer(0, 5);
    expect(g.getPlayers()[0].position).toBe(0);
    expect(g.checkVictory()?.name).toBe('A');
  });
});
