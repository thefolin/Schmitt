import { describe, it, expect, afterEach } from 'vitest';
import { Sprite, Object3D } from 'three';
import { BoardTiles3D } from '@/features/board/scene3d/board-tiles-3d';
import type { TileConfig } from '@/core/models/Tile';
import type { BoardLayoutConfig } from '@/features/board/camera/board-layout.config';
import officialLayout from '../public/assets/schmitt.json';
import { TILE_CONFIGS } from '@/features/tiles/tile.config';

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

function column(side: 'left' | 'right'): Object3D | null {
  return tiles.group.getObjectByName(`column-${side}`) ?? null;
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
    // C'EST LE POINT QUI CASSE : une colonne qui empiète sur le parcours
    // masque les cases qu'elle est censée accompagner.
    //
    // CE TEST A ÉTÉ RÉÉCRIT. Il exigeait que les colonnes soient au-delà des
    // bords du parcours — ce qui était le placement d'origine, et que
    // Quentin a corrigé : sur son téléphone, elles sortaient du tapis et
    // l'écran les coupait. Elles vont maintenant dans les creux du parcours.
    //
    // La règle de fond ne change pas : ne recouvrir aucune case. Sur ce
    // plateau d'essai — une seule ligne, sans creux — elles se posent au
    // quart et aux trois quarts, en profondeur dégagée.
    boardOf(5);

    const half = 60;
    const positions = tiles.getPositions().filter(Boolean) as { x: number; z: number }[];

    for (const side of ['left', 'right'] as const) {
      const c = column(side)!;

      for (const tile of positions) {
        const apartX = Math.abs(tile.x - c.position.x) - half - c.scale.x / 2;
        const apartZ = Math.abs(tile.z - c.position.z) - half - c.scale.y / 2;

        expect(Math.max(apartX, apartZ)).toBeGreaterThan(0);
      }
    }
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

describe('colonnes — elles font toujours face au joueur', () => {
  it('en fait des SPRITES, et non des plans', () => {
    // C'EST LA DEMANDE DE QUENTIN : « toujours face à la caméra, peu importe
    // l'angle de vue ». Un sprite l'est par construction — le moteur
    // l'oriente au rendu, sans une ligne de code de réorientation.
    //
    // Ce test ne vérifie donc pas un calcul, il vérifie le CHOIX DE TYPE :
    // repasser à un `Mesh` plan ramènerait le défaut que ça corrige, une
    // colonne qui se présente de profil dès qu'on tourne d'un quart de tour.
    boardOf(5);

    expect(column('left')).toBeInstanceOf(Sprite);
    expect(column('right')).toBeInstanceOf(Sprite);
  });

  it('les dresse au-dessus du tapis', () => {
    boardOf(5);

    const table = tiles.group.getObjectByName('table')!;

    expect(column('left')!.position.y).toBeGreaterThan(table.position.y);
  });

  it('garde les proportions de l\'image', () => {
    // 790×1920 : hautes et étroites. Les étirer écraserait les dieux.
    // Un sprite n'a pas de géométrie : ses dimensions sont dans `scale`.
    boardOf(8);

    const size = column('left')!.scale;

    expect(size.x / size.y).toBeCloseTo(790 / 1920, 2);
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

/**
 * Les colonnes se posent DANS le plateau, pas à côté.
 *
 * Quentin a entouré en rouge les colonnes telles qu'elles étaient — sorties
 * du tapis, coupées par les bords de l'écran — et marqué d'une croix les
 * deux zones vides à l'intérieur du plateau, entre les branches du
 * serpentin. C'est là qu'elles vont.
 *
 * LA CONTRAINTE RESTE LA MÊME : ne recouvrir aucune case. Elle devient
 * simplement plus difficile à tenir, puisque les colonnes sont maintenant
 * entourées de cases au lieu d'être à l'écart.
 */
describe('colonnes — dans les creux du parcours', () => {
  /** Le plateau officiel, avec ses trois branches et ses deux couloirs. */
  function officialBoard(): void {
    tiles?.dispose();
    tiles = new BoardTiles3D();
    tiles.build(TILE_CONFIGS, officialLayout as unknown as BoardLayoutConfig);
  }

  /** Emprise d'une colonne dans le plan du plateau. */
  function boxOf(side: 'left' | 'right'): {
    x: number; z: number; halfX: number; halfZ: number;
  } {
    const column = column2(side)!;

    return {
      x: column.position.x,
      z: column.position.z,
      halfX: column.scale.x / 2,
      halfZ: column.scale.y / 2,
    };
  }

  function column2(side: 'left' | 'right') {
    return tiles.group.getObjectByName(`column-${side}`) as
      | { position: { x: number; z: number }; scale: { x: number; y: number } }
      | undefined;
  }

  it('les pose À L\'INTÉRIEUR de l\'emprise du parcours', () => {
    // C'EST LA CORRECTION. Avant, elles étaient au-delà des bords — donc
    // hors du tapis, et coupées par l'écran.
    officialBoard();

    const positions = tiles.getPositions().filter(Boolean) as { x: number; z: number }[];
    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x));

    for (const side of ['left', 'right'] as const) {
      expect(boxOf(side).x).toBeGreaterThan(minX);
      expect(boxOf(side).x).toBeLessThan(maxX);
    }
  });

  it('ne recouvre AUCUNE case', () => {
    // Toutes les cases, et pas seulement les voisines immédiates : une
    // colonne posée dans un couloir est entourée de trois côtés.
    //
    // La séparation se mesure sur les DEUX axes : deux rectangles sont
    // disjoints dès que l'un des axes les sépare. Une mesure sur le seul axe
    // horizontal annoncerait un chevauchement qui n'existe pas — vérifié en
    // écrivant ce test.
    officialBoard();

    const half = 60;
    const positions = tiles.getPositions().filter(Boolean) as { x: number; z: number }[];

    for (const side of ['left', 'right'] as const) {
      const box = boxOf(side);

      for (const tile of positions) {
        const apartX = Math.abs(tile.x - box.x) - half - box.halfX;
        const apartZ = Math.abs(tile.z - box.z) - half - box.halfZ;

        expect(Math.max(apartX, apartZ)).toBeGreaterThan(0);
      }
    }
  });

  it('mesure chaque couloir séparément', () => {
    // Les deux creux n'ont ni la même hauteur ni le même centre : les arcs
    // du serpentin en traversent un plus bas que l'autre. Une taille commune
    // ferait déborder au moins une colonne.
    officialBoard();

    expect(boxOf('left').halfZ).not.toBeCloseTo(boxOf('right').halfZ, 1);
  });
});
