import { describe, it, expect, afterEach } from 'vitest';
import { Mesh } from 'three';
import { BoardTiles3D } from '@/features/board/scene3d/board-tiles-3d';
import type { TileConfig } from '@/core/models/Tile';
import type { BoardLayoutConfig } from '@/features/board/camera/board-layout.config';

/**
 * Les colonnes de pouvoirs, de part et d'autre du parcours.
 *
 * Quentin a d'abord demandé le plateau imprimé entier en fond, puis l'a
 * remplacé par un fond noir et ces deux colonnes. Le premier essai dessinait
 * les 23 cases une seconde fois sous celles qu'on joue ; les colonnes, elles,
 * portent la TABLE DES FAVEURS — qui n'existe nulle part ailleurs dans la
 * scène, sinon dans `GOD_FAVORS`, côté code.
 *
 * Ce qui se vérifie ici n'est pas leur apparence — jsdom ne rend rien — mais
 * leur PLACE : de chaque côté, jamais sur le parcours.
 */

let tiles: BoardTiles3D;

afterEach(() => tiles?.dispose());

/** Un parcours d'une ligne, de `count` cases. */
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

function column(side: 'left' | 'right'): Mesh | null {
  return (tiles.group.getObjectByName(`column-${side}`) as Mesh | undefined) ?? null;
}

describe('colonnes — elles encadrent le parcours', () => {
  it('pose une colonne de chaque côté', () => {
    boardOf(5);

    expect(column('left')).not.toBeNull();
    expect(column('right')).not.toBeNull();
  });

  it('les place de part et d\'autre, pas du même côté', () => {
    boardOf(5);

    expect(column('left')!.position.x).toBeLessThan(column('right')!.position.x);
  });

  it('ne les pose JAMAIS sur une case', () => {
    // C'EST LE POINT QUI CASSE. Une colonne qui empiète sur le parcours
    // masquerait les cases qu'elle est censée accompagner — et le décor
    // prendrait le pas sur le jeu.
    boardOf(5);

    const first = tiles.group.getObjectByName('tile-0')!;
    const last = tiles.group.getObjectByName('tile-4')!;

    expect(column('left')!.position.x).toBeLessThan(first.position.x);
    expect(column('right')!.position.x).toBeGreaterThan(last.position.x);
  });

  it('s\'écarte d\'autant que le parcours est large', () => {
    // Le rendu ne suppose rien de la forme du plateau (CLAUDE.md) : sur un
    // parcours plus long, les colonnes doivent s'écarter avec lui plutôt que
    // de rester à une distance fixe du centre.
    boardOf(3);
    const narrow = column('right')!.position.x;

    tiles.dispose();
    boardOf(12);
    const wide = column('right')!.position.x;

    expect(wide).toBeGreaterThan(narrow);
  });
});

describe('colonnes — elles se tiennent debout', () => {
  it('les dresse au-dessus du tapis, et non couchées dessus', () => {
    // DEBOUT, parce que ce sont des colonnes : posées à plat elles se
    // liraient de biais, et le joueur incline la vue comme il veut (#74).
    boardOf(5);

    const table = tiles.group.getObjectByName('table')!;

    expect(column('left')!.position.y).toBeGreaterThan(table.position.y);
    expect(column('left')!.rotation.x).toBeCloseTo(0, 5);
  });

  it('garde les proportions de l\'image', () => {
    // 790×1920 : hautes et étroites. Les étirer écraserait les dieux.
    boardOf(8);

    const geometry = column('left')!.geometry as {
      parameters: { width: number; height: number };
    };

    expect(geometry.parameters.width / geometry.parameters.height).toBeCloseTo(
      790 / 1920,
      2
    );
  });
});

describe('colonnes — elles ne fuient pas en mémoire', () => {
  it('libère leurs textures quand la partie recommence', () => {
    // Three.js ne libère rien tout seul : deux textures de plus à chaque
    // partie recommencée finiraient par saturer la mémoire graphique.
    boardOf(5);

    const freed: string[] = [];

    for (const side of ['left', 'right'] as const) {
      const material = column(side)!.material as { map: { dispose: () => void } | null };
      const texture = material.map!;
      const original = texture.dispose;

      texture.dispose = function (): void {
        freed.push(side);
        original.call(this);
      };
    }

    tiles.dispose();

    expect(freed.sort()).toEqual(['left', 'right']);
  });
});
