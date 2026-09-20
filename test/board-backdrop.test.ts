import { describe, it, expect, afterEach } from 'vitest';
import { Mesh } from 'three';
import { BoardTiles3D } from '@/features/board/scene3d/board-tiles-3d';
import type { TileConfig } from '@/core/models/Tile';
import type { BoardLayoutConfig } from '@/features/board/camera/board-layout.config';

/**
 * L'illustration du plateau physique, posée sous les cases.
 *
 * Quentin l'a demandée en arrière-plan du plateau 3D. Ce qui se vérifie ici
 * n'est pas son apparence — jsdom ne rend rien — mais sa PLACE : sous les
 * cases, jamais devant, et à ses proportions d'origine.
 */

let tiles: BoardTiles3D;

afterEach(() => tiles?.dispose());

function boardOf(count: number): void {
  tiles = new BoardTiles3D();
  tiles.build(
    Array.from({ length: count }, () => ({
      type: 'drink_2',
      image: 'a.png',
    })) as TileConfig[],
    {
      tileSize: 120,
      tileGap: 15,
      columns: count,
      rows: 1,
      placements: Array.from({ length: count }, (_, index) => ({
        tileId: index,
        gridCol: index,
        gridRow: 0,
      })),
    } as BoardLayoutConfig
  );
}

function backdrop(): Mesh | null {
  return (tiles.group.getObjectByName('backdrop') as Mesh | undefined) ?? null;
}

describe('fond du plateau — il existe et se trouve sous les cases', () => {
  it('pose une illustration sous le parcours', () => {
    boardOf(5);

    expect(backdrop()).not.toBeNull();
  });

  it('la place SOUS les cases, jamais devant', () => {
    // C'EST LE POINT QUI CASSE. Une illustration posée à la même hauteur que
    // les cases, ou au-dessus, masquerait le jeu lui-même : le joueur
    // verrait le dessin d'un plateau au lieu du plateau qu'il joue.
    boardOf(5);

    const image = backdrop()!;
    const tile = tiles.group.getObjectByName('tile-0')!;

    expect(image.position.y).toBeLessThan(tile.position.y);
  });

  it('la place au-dessus du tapis, pour qu\'elle se voie', () => {
    // Entre les deux : sous le tapis, elle serait invisible.
    boardOf(5);

    const table = tiles.group.getObjectByName('table')!;

    expect(backdrop()!.position.y).toBeGreaterThan(table.position.y);
  });
});

describe('fond du plateau — il garde ses proportions', () => {
  it('ne déforme pas l\'illustration pour remplir le tapis', () => {
    // L'image est plus HAUTE que large (4000×4500), le parcours officiel
    // plus LARGE que haut. L'étirer déformerait le titre et le motif grec,
    // qui sont l'identité du plateau.
    boardOf(10);

    const geometry = backdrop()!.geometry as { parameters: { width: number; height: number } };
    const ratio = geometry.parameters.width / geometry.parameters.height;

    expect(ratio).toBeCloseTo(4000 / 4500, 2);
  });

  it('garde ses proportions quelle que soit la forme du parcours', () => {
    // Le rendu ne suppose rien de la forme du plateau (CLAUDE.md) : un
    // parcours très allongé ne doit pas étirer l'image avec lui.
    boardOf(23);

    const geometry = backdrop()!.geometry as { parameters: { width: number; height: number } };

    expect(geometry.parameters.width / geometry.parameters.height).toBeCloseTo(
      4000 / 4500,
      2
    );
  });
});

describe('fond du plateau — il ne fuit pas en mémoire', () => {
  it('libère sa texture quand la partie recommence', () => {
    // Three.js ne libère rien tout seul, et celle-ci pèse 2,5 Mo : une
    // partie recommencée en accumulerait une de plus à chaque fois.
    boardOf(5);

    const material = backdrop()!.material as { map: { dispose: () => void } | null };
    const texture = material.map;
    expect(texture).not.toBeNull();

    let freed = false;
    const original = texture!.dispose;
    texture!.dispose = function (): void {
      freed = true;
      original.call(this);
    };

    tiles.dispose();

    expect(freed).toBe(true);
  });
});
