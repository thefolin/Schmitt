import { describe, it, expect, afterEach } from 'vitest';
import { Mesh } from 'three';
import { BoardTiles3D } from '@/features/board/scene3d/board-tiles-3d';
import layout from '../public/assets/schmitt.json';
import { TILE_CONFIGS } from '@/features/tiles/tile.config';
import type { BoardLayoutConfig } from '@/features/board/camera/board-layout.config';

/**
 * Trois cases se distinguent du parcours : les deux temples de la faveur des
 * dieux et le Schmitt.
 *
 * Quentin : « les ajustements ne s'appliquent qu'à 3 cases — les pouvoirs
 * des dieux et le Schmitt. Les 20 autres restent comme avant. »
 *
 * Ce sont les trois cases qui ne font pas boire mais DÉCLENCHENT quelque
 * chose. Les voir de loin aide le joueur à anticiper.
 *
 * LE CHEVAUCHEMENT EST LA CONTRAINTE, et il se mesure : une case agrandie ne
 * doit pas mordre sur ses voisines, sinon le parcours devient illisible.
 */

let tiles: BoardTiles3D;

afterEach(() => tiles?.dispose());

/** Les rangs des trois cases spéciales sur le plateau officiel. */
const SPECIAL = [4, 11, 18];

function buildOfficialBoard(): void {
  tiles = new BoardTiles3D();
  tiles.build(TILE_CONFIGS, layout as unknown as BoardLayoutConfig);
}

function bodyOf(index: number): Mesh {
  return tiles.group
    .getObjectByName(`tile-${index}`)!
    .children.find(child => child.name === 'tile-body') as Mesh;
}

/** La demi-largeur d'une case : rayon si elle est ronde, demi-côté sinon. */
function reachOf(index: number): number {
  const geometry = bodyOf(index).geometry as {
    type: string;
    parameters: { radiusTop?: number; width?: number };
  };

  if (geometry.type === 'CylinderGeometry') return geometry.parameters.radiusTop!;

  return geometry.parameters.width! / 2;
}

/**
 * L'espace libre entre une case RONDE et une case CARRÉE, en unités monde.
 *
 * Négatif si elles se recouvrent.
 *
 * MESURÉ CORRECTEMENT, et c'est le piège : une première version de ce test
 * traitait le carré comme un disque de rayon égal à sa demi-diagonale. Elle
 * le gonflait donc dans TOUTES les directions, alors que la diagonale ne
 * pointe que vers les quatre coins — un voisin posé sur la même ligne n'est
 * éloigné que de son demi-côté. Le test refusait un agrandissement que la
 * géométrie autorise.
 *
 * On cherche donc le point du carré le plus proche du centre du disque, ce
 * qui est la vraie distance entre les deux formes.
 */
function clearance(round: number, square: number, dx: number, dz: number): number {
  const half = reachOf(square);

  const nearestX = Math.max(-half, Math.min(dx, half));
  const nearestZ = Math.max(-half, Math.min(dz, half));

  return Math.hypot(dx - nearestX, dz - nearestZ) - reachOf(round);
}

describe('cases spéciales — elles sont rondes', () => {
  it('donne un corps cylindrique aux trois cases visées', () => {
    buildOfficialBoard();

    for (const index of SPECIAL) {
      expect(bodyOf(index).geometry.type).toBe('CylinderGeometry');
    }
  });

  it('laisse les vingt autres carrées', () => {
    // C'EST LA PRÉCISION DE QUENTIN, et elle est facile à perdre : une
    // première version avait rendu TOUT le parcours rond.
    buildOfficialBoard();

    for (let index = 0; index < TILE_CONFIGS.length; index += 1) {
      if (SPECIAL.includes(index)) continue;

      expect(bodyOf(index).geometry.type).toBe('BoxGeometry');
    }
  });

  it('accorde la face au corps', () => {
    // Une face carrée sur un corps rond dépasserait aux quatre coins.
    buildOfficialBoard();

    const face = (index: number): string =>
      (
        tiles.group
          .getObjectByName(`tile-${index}`)!
          .children.find(child => child.name === 'tile-face') as Mesh
      ).geometry.type;

    expect(face(4)).toBe('CircleGeometry');
    expect(face(0)).toBe('PlaneGeometry');
  });
});

describe('cases spéciales — elles sont plus grandes', () => {
  it('les agrandit par rapport aux cases ordinaires', () => {
    buildOfficialBoard();

    expect(reachOf(4)).toBeGreaterThan(reachOf(3));
    expect(reachOf(11)).toBeGreaterThan(reachOf(10));
  });

  it('ne touche pas à la taille des autres', () => {
    buildOfficialBoard();

    const ordinary = reachOf(0);

    for (let index = 0; index < TILE_CONFIGS.length; index += 1) {
      if (SPECIAL.includes(index)) continue;

      expect(reachOf(index)).toBeCloseTo(ordinary, 3);
    }
  });
});

describe('cases — aucune n\'en recouvre une autre', () => {
  it('garde les cases spéciales à l\'écart de toutes leurs voisines', () => {
    // C'EST LA CONTRAINTE. Une case agrandie qui mord sur sa voisine rend le
    // parcours illisible : le joueur ne sait plus sur quelle case il est.
    //
    // Toutes les paires sont examinées, et pas seulement les cases
    // consécutives : le serpentin replie le parcours sur lui-même, donc deux
    // branches peuvent se frôler sans se suivre dans l'ordre de marche.
    buildOfficialBoard();

    const positions = tiles.getPositions();

    for (const index of SPECIAL) {
      for (let other = 0; other < positions.length; other += 1) {
        if (other === index) continue;

        const a = positions[index];
        const b = positions[other];
        if (!a || !b) continue;

        expect(clearance(index, other, b.x - a.x, b.z - a.z)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('les fait tout de même aussi grandes que la place le permet', () => {
    // LE RISQUE INVERSE : une case à peine plus grande ne se distinguerait
    // pas, et ne répondrait pas à la demande. Elle doit occuper l'essentiel
    // de l'espace libre jusqu'à sa voisine.
    buildOfficialBoard();

    const positions = tiles.getPositions();
    const a = positions[4]!;
    const b = positions[3]!;

    // Les bords se frôlent : moins de 5 unités d'écart sur un pas de 135.
    expect(clearance(4, 3, b.x - a.x, b.z - a.z)).toBeLessThan(5);
  });
});
