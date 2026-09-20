import { describe, it, expect, afterEach } from 'vitest';
import { BoardTiles3D } from '@/features/board/scene3d/board-tiles-3d';
import { Dice3DScene } from '@/features/board/scene3d/dice-3d-scene';
import { DIE_EDGE } from '@/features/board/scene3d/dice-world-config';
import type { TileConfig } from '@/core/models/Tile';
import type { BoardLayoutConfig } from '@/features/board/camera/board-layout.config';

/**
 * 3D-68 — le dé roule SUR le plateau, pas dedans.
 *
 * Quentin (20/09/2026) : « je vois que les dés traversent les joueurs et les
 * cases ».
 *
 * IL AVAIT RAISON, et le défaut était grossier une fois trouvé : le dé était
 * posé à la hauteur de la TABLE (y = 0), alors que les cases ont 28 unités
 * d'épaisseur. Il roulait donc ENFONCÉ DE 28 dans le plateau — la moitié de
 * sa propre hauteur — et passait visuellement sous les pions, qui sont posés
 * SUR les cases.
 *
 * AUCUN TEST NE POUVAIT LE DIRE, et c'est la leçon : les collisions étaient
 * justes, la physique aussi, les 683 tests passaient. C'est la hauteur
 * D'AFFICHAGE qui était fausse, et elle ne se voit qu'à l'écran — jusqu'à ce
 * qu'on la compare à la géométrie du plateau, ce que fait ce fichier.
 *
 * Le second défaut, trouvé en corrigeant le premier : la boîte des pions
 * donnait son sommet en coordonnées MONDE, alors que la hauteur de vol du dé
 * se compte au-dessus des CASES. Deux repères pour une même comparaison — le
 * genre d'écart qui marche par chance jusqu'au jour où il ne marche plus.
 */

let tiles: BoardTiles3D;

afterEach(() => tiles?.dispose());

/** Le plateau officiel a des cases épaisses : c'est ce qui crée le piège. */
const TILE_THICKNESS = 28;
const PAWN_HEIGHT = 46;

function boardOf(count: number): BoardTiles3D {
  const built = new BoardTiles3D();

  built.build(
    Array.from({ length: count }, () => ({ type: 'start', icon: '', name: '' })) as TileConfig[],
    {
      gridRows: 1,
      gridCols: count,
      tileSize: 120,
      tileGap: 15,
      placements: Array.from({ length: count }, (_, index) => ({
        tileId: index,
        gridRow: 0,
        gridCol: index,
        size: 'full',
      })),
    } as unknown as BoardLayoutConfig
  );

  return built;
}

describe('3D-68 — la surface de roulement est le DESSUS des cases', () => {
  it('ne pose pas le dé au niveau de la table', () => {
    // LE DÉFAUT EXACT. La table est à 0, les cases à 28 : poser le dé à 0 le
    // faisait rouler dans le plateau.
    expect(BoardTiles3D.diceSurface).toBeGreaterThan(0);
  });

  it('pose le dé sur l\'épaisseur des cases', () => {
    expect(BoardTiles3D.diceSurface).toBe(TILE_THICKNESS);
  });

  it('laisse le bas du dé affleurer la case, sans s\'y enfoncer', () => {
    // Le dé est dessiné par son CENTRE : sa hauteur d'affichage est donc la
    // surface plus la demi-arête. Le bas du dé tombe alors exactement sur le
    // dessus de la case.
    const centre = BoardTiles3D.diceSurface + Dice3DScene.halfSize;
    const bottom = centre - DIE_EDGE / 2;

    expect(bottom).toBeCloseTo(TILE_THICKNESS, 5);
  });

  it('ne fait pas flotter le dé au-dessus des cases', () => {
    // L'autre bord : un dé qui léviterait se verrait tout autant.
    const centre = BoardTiles3D.diceSurface + Dice3DScene.halfSize;
    const bottom = centre - DIE_EDGE / 2;

    expect(bottom).toBeLessThanOrEqual(TILE_THICKNESS + 0.001);
  });
});

describe('3D-68 — les pions et le dé se mesurent dans le MÊME repère', () => {
  it('donne la hauteur des pions au-dessus des cases, pas de la table', () => {
    // LE SECOND DÉFAUT. La hauteur de vol du dé (`state.height`) vaut 0 quand
    // il est posé sur le plateau. Comparer cette hauteur à un sommet exprimé
    // en coordonnées monde revenait à croire les pions 28 unités plus hauts
    // qu'ils ne sont.
    tiles = boardOf(5);
    tiles.setPawns([{ position: 1, color: '#f00' }]);

    const [pawn] = tiles.pawnObstacles();

    expect(pawn.top).toBe(PAWN_HEIGHT);
  });

  it('place les obstacles là où les pions sont réellement posés', () => {
    tiles = boardOf(5);
    tiles.setPawns([{ position: 1, color: '#f00' }, { position: 3, color: '#0f0' }]);

    const obstacles = tiles.pawnObstacles();

    expect(obstacles).toHaveLength(2);
    for (const obstacle of obstacles) {
      expect(Number.isFinite(obstacle.x)).toBe(true);
      expect(Number.isFinite(obstacle.z)).toBe(true);
    }
  });

  it('n\'annonce aucun obstacle quand aucun pion n\'est posé', () => {
    tiles = boardOf(5);

    expect(tiles.pawnObstacles()).toHaveLength(0);
  });

  it('donne aux pions un rayon qui couvre leur base évasée', () => {
    // Le pion est un cylindre légèrement plus large en bas : c'est cette
    // base que le dé heurte.
    tiles = boardOf(5);
    tiles.setPawns([{ position: 2, color: '#f00' }]);

    const [pawn] = tiles.pawnObstacles();

    expect(pawn.radius).toBeGreaterThan(26);
  });
});
