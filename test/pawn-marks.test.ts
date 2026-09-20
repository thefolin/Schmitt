import { describe, it, expect, afterEach } from 'vitest';
import { Sprite, Vector3 } from 'three';
import { BoardTiles3D } from '@/features/board/scene3d/board-tiles-3d';
import type { TileConfig } from '@/core/models/Tile';
import type { BoardLayoutConfig } from '@/features/board/camera/board-layout.config';
import {
  pawnMarks,
  hasMarks,
  MARK_LIFT,
  MARK_STACK,
} from '@/features/board/scene3d/pawn-marks';
import { getPawnBadges } from '@/features/board/camera/pawn-badges';
import type { Player } from '@/core/models/Player';

/**
 * SCH-17 — le statut d'un joueur se lit sur le plateau 3D.
 *
 * Bastien l'a demandé deux fois : « ajouter un logo permanent à côté du
 * joueur 🐔 ». Le rendu CSS le fait depuis longtemps ; le plateau 3D posait
 * des volumes nus — « sans badge ni texture », disait le commentaire de
 * `setPawns`, « le reste viendra ».
 *
 * Ce qui est vérifié ici n'est pas l'image (jsdom n'a pas de WebGL) mais la
 * DÉCISION : qui porte quoi, et à quelle hauteur.
 */

function playerWith(status: Partial<Player> = {}): Player {
  return {
    name: 'Alice',
    color: '#ff0000',
    position: 0,
    hasSchmittPower: false,
    hasAthenaShield: false,
    chickenRank: 0,
    ...status,
  } as Player;
}

describe('SCH-17 — un pion sans statut ne porte rien', () => {
  it('ne donne aucune marque à un joueur ordinaire', () => {
    expect(pawnMarks(playerWith())).toEqual([]);
    expect(hasMarks(playerWith())).toBe(false);
  });
});

describe('SCH-17 — chaque statut durable se voit', () => {
  it('marque le Poulet', () => {
    const marks = pawnMarks(playerWith({ chickenRank: 2 }));

    expect(marks).toHaveLength(1);
    expect(marks[0].label).toBe('Gros Poulet');
    expect(hasMarks(playerWith({ chickenRank: 2 }))).toBe(true);
  });

  it('distingue les deux rangs de Poulet', () => {
    // Le petit et le gros Poulet ne sont pas la même sanction : un seul
    // glyphe pour les deux effacerait la différence sur le plateau.
    const small = pawnMarks(playerWith({ chickenRank: 1 }))[0];
    const big = pawnMarks(playerWith({ chickenRank: 2 }))[0];

    expect(small.icon).not.toBe(big.icon);
  });

  it('marque le bouclier d\'Athéna', () => {
    const marks = pawnMarks(playerWith({ hasAthenaShield: true }));

    expect(marks[0].label).toBe("Bouclier d'Athéna");
  });

  it('marque le pouvoir du Schmitt', () => {
    const marks = pawnMarks(playerWith({ hasSchmittPower: true }));

    expect(marks[0].label).toBe('Pouvoir du Schmitt');
  });
});

describe('SCH-17 — plusieurs marques s\'empilent sans se recouvrir', () => {
  it('porte les trois statuts à la fois', () => {
    // Rien n'interdit au Poulet de prendre le pouvoir du Schmitt.
    const marks = pawnMarks(
      playerWith({ chickenRank: 1, hasAthenaShield: true, hasSchmittPower: true })
    );

    expect(marks).toHaveLength(3);
  });

  it('donne à chaque marque une hauteur distincte', () => {
    const marks = pawnMarks(
      playerWith({ chickenRank: 1, hasAthenaShield: true, hasSchmittPower: true })
    );
    const lifts = marks.map(m => m.lift);

    expect(new Set(lifts).size).toBe(3);
  });

  it('les empile vers le haut, dans l\'ordre', () => {
    const marks = pawnMarks(
      playerWith({ chickenRank: 1, hasAthenaShield: true, hasSchmittPower: true })
    );

    expect(marks[0].lift).toBe(MARK_LIFT);
    expect(marks[1].lift).toBeGreaterThan(marks[0].lift);
    expect(marks[2].lift).toBeGreaterThan(marks[1].lift);
  });

  it('les espace d\'au moins leur propre hauteur', () => {
    // C'EST LE POINT : deux marques trop proches se chevauchent et deviennent
    // illisibles, ce qui est pire qu'une seule — le joueur croit lire un
    // badge unique. L'écart doit valoir au moins le pas d'empilement.
    const marks = pawnMarks(playerWith({ chickenRank: 1, hasSchmittPower: true }));

    expect(marks[1].lift - marks[0].lift).toBeGreaterThanOrEqual(MARK_STACK);
  });
});

describe('SCH-17 — la 3D et le CSS lisent la même liste', () => {
  it('porte exactement les badges que le rendu CSS porterait', () => {
    // C'EST LA LIVRAISON. Les deux rendus doivent dire la même chose du même
    // joueur : si chacun décidait de son côté ce qu'est un statut, un badge
    // ajouté plus tard n'apparaîtrait que d'un seul côté, et le plateau
    // mentirait sur ce que le joueur possède.
    const cases: Partial<Player>[] = [
      {},
      { chickenRank: 1 },
      { chickenRank: 2 },
      { hasAthenaShield: true },
      { hasSchmittPower: true },
      { chickenRank: 2, hasAthenaShield: true, hasSchmittPower: true },
    ];

    for (const status of cases) {
      const player = playerWith(status);

      expect(pawnMarks(player).map(m => m.label)).toEqual(
        getPawnBadges(player).map(b => b.label)
      );
      expect(hasMarks(player)).toBe(getPawnBadges(player).length > 0);
    }
  });

  it('garde l\'ordre d\'affichage du rendu CSS', () => {
    const player = playerWith({
      chickenRank: 2,
      hasAthenaShield: true,
      hasSchmittPower: true,
    });

    expect(pawnMarks(player).map(m => m.icon)).toEqual(
      getPawnBadges(player).map(b => b.icon)
    );
  });
});

/**
 * SCH-17 — la marque est rattachée au pion, pas posée à côté.
 *
 * CE POINT NE SE VOIT PAS dans les fonctions pures ci-dessus, et c'est
 * justement pour ça qu'il mérite son test : le pion MARCHE vers sa case
 * (#48), déplacé et non reconstruit. Une marque posée dans la scène à la
 * position du pion resterait sur place pendant qu'il avance, et flotterait au
 * milieu du plateau.
 *
 * jsdom n'offre AUCUN contexte 2D, donc `paintMark` renvoie `null` et aucun
 * sprite ne serait créé : le test ne verrait rien. On fournit donc un
 * contexte minimal le temps du test — sans quoi ce test passerait quoi qu'on
 * fasse, ce qui a été vérifié en cassant le rattachement exprès.
 */
describe('SCH-17 — la marque suit le pion qui marche', () => {
  let painted: BoardTiles3D | null = null;

  afterEach(() => {
    painted?.dispose();
    painted = null;
  });

  /** Un contexte 2D muet : assez pour que `paintMark` aboutisse. */
  function lendCanvas(): () => void {
    const proto = globalThis.HTMLCanvasElement?.prototype;
    if (!proto) return () => {};

    const previous = proto.getContext;
    proto.getContext = function (): unknown {
      return {
        fillStyle: '',
        font: '',
        textAlign: '',
        textBaseline: '',
        beginPath() {},
        arc() {},
        fill() {},
        fillText() {},
      };
    } as typeof proto.getContext;

    return () => {
      proto.getContext = previous;
    };
  }

  it('attache la marque au pion, pour qu\'elle le suive', () => {
    const giveBack = lendCanvas();

    try {
      painted = new BoardTiles3D();
      painted.build(
        [{ type: 'drink_2', image: 'a.png' }] as TileConfig[],
        {
          tileSize: 120,
          tileGap: 15,
          columns: 1,
          rows: 1,
          placements: [{ tileId: 0, col: 0, row: 0 }],
        } as unknown as BoardLayoutConfig
      );

      painted.setPawns([
        {
          position: 0,
          color: '#ff0000',
          marks: pawnMarks(playerWith({ chickenRank: 2 })),
        },
      ]);

      const pawn = painted.pawnOf(0);
      expect(pawn).not.toBeNull();

      // LA MARQUE EST UN ENFANT DU PION. C'est ce qui la fait suivre quand
      // `walkPawn` déplace le Mesh, sans que l'animation la connaisse.
      const sprites = pawn!.children.filter(child => child instanceof Sprite);
      expect(sprites).toHaveLength(1);

      // Et elle le suit réellement : le pion avance, la marque aussi.
      pawn!.position.set(300, 0, 120);
      pawn!.updateMatrixWorld(true);

      const world = sprites[0].getWorldPosition(new Vector3());
      expect(world.x).toBeCloseTo(300, 5);
      expect(world.z).toBeCloseTo(120, 5);
    } finally {
      giveBack();
    }
  });

  it('ne pose aucune marque sur un pion sans statut', () => {
    const giveBack = lendCanvas();

    try {
      painted = new BoardTiles3D();
      painted.build(
        [{ type: 'drink_2', image: 'a.png' }] as TileConfig[],
        {
          tileSize: 120,
          tileGap: 15,
          columns: 1,
          rows: 1,
          placements: [{ tileId: 0, col: 0, row: 0 }],
        } as unknown as BoardLayoutConfig
      );

      painted.setPawns([{ position: 0, color: '#ff0000', marks: [] }]);

      const pawn = painted.pawnOf(0);
      expect(pawn!.children.filter(c => c instanceof Sprite)).toHaveLength(0);
    } finally {
      giveBack();
    }
  });
});

/**
 * SCH-17 — les textures des marques sont libérées.
 *
 * Three.js NE LIBÈRE RIEN TOUT SEUL : chaque marque peint sa propre texture,
 * et une partie qu'on recommence en crée de nouvelles. Sans registre, elles
 * s'accumulent dans la mémoire graphique — c'est exactement le problème que
 * `dispose` traite déjà pour les illustrations des cases, et la raison pour
 * laquelle il existe.
 *
 * Ce test a été écrit APRÈS avoir constaté qu'oublier `textures.push` ne
 * faisait échouer aucun des 727 autres tests.
 */
describe('SCH-17 — une partie recommencée ne fuit pas', () => {
  it('enregistre la texture d\'une marque pour pouvoir la libérer', () => {
    const proto = globalThis.HTMLCanvasElement?.prototype;
    const previous = proto.getContext;
    proto.getContext = function (): unknown {
      return {
        fillStyle: '', font: '', textAlign: '', textBaseline: '',
        beginPath() {}, arc() {}, fill() {}, fillText() {},
      };
    } as typeof proto.getContext;

    const tiles = new BoardTiles3D();

    try {
      tiles.build(
        [{ type: 'drink_2', image: 'a.png' }] as TileConfig[],
        {
          tileSize: 120, tileGap: 15, columns: 1, rows: 1,
          placements: [{ tileId: 0, col: 0, row: 0 }],
        } as unknown as BoardLayoutConfig
      );

      tiles.setPawns([
        { position: 0, color: '#ff0000', marks: pawnMarks(playerWith({ chickenRank: 2 })) },
      ]);

      const sprite = tiles
        .pawnOf(0)!
        .children.find(child => child instanceof Sprite) as Sprite;

      const texture = (sprite.material as { map: { dispose: () => void } | null }).map;
      expect(texture).not.toBeNull();

      let freed = false;
      const original = texture!.dispose;
      texture!.dispose = function (): void {
        freed = true;
        original.call(this);
      };

      tiles.dispose();

      // C'EST LE POINT : `dispose` ne peut libérer que ce qu'il connaît.
      // Une texture peinte mais non enregistrée reste en mémoire graphique.
      expect(freed).toBe(true);
    } finally {
      proto.getContext = previous;
    }
  });
});
