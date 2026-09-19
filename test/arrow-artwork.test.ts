import { describe, it, expect, afterEach } from 'vitest';
import { Mesh } from 'three';
import { BoardTiles3D } from '@/features/board/scene3d/board-tiles-3d';
import { isArrowTile, arrowDirection } from '@/features/board/scene3d/arrow-tile';
import type { TileConfig } from '@/core/models/Tile';
import type { BoardLayoutConfig } from '@/features/board/camera/board-layout.config';

/**
 * 3D-57 — le dessin de la flèche suit sa direction.
 *
 * Quentin : « besoin de pouvoir tourner les flèches visuellement, certaines
 * doivent faire reculer au lieu d'avancer ».
 *
 * LA LOGIQUE EST DÉJÀ JUSTE : `direction` existe dans le format des cases et
 * dans les règles, et `movePlayerInDirection` l'applique — c'est l'acquis
 * #10, vérifié sur 756 flèches en phase de retour. Ce qui manquait, c'est que
 * le DESSIN ne tournait pas : une flèche déclarée `backward` s'affichait
 * pointant vers l'avant, et disait donc le contraire de ce qu'elle fait.
 *
 * Une flèche qui ment sur son sens est pire qu'une flèche absente : le joueur
 * anticipe son déplacement en la regardant.
 */

let tiles: BoardTiles3D;

afterEach(() => tiles?.dispose());

function layoutOf(count: number): BoardLayoutConfig {
  return {
    tileSize: 120,
    tileGap: 15,
    columns: count,
    rows: 1,
    placements: Array.from({ length: count }, (_, index) => ({
      tileId: index,
      col: index,
      row: 0,
    })),
  } as BoardLayoutConfig;
}

/** La face du dessus, celle qui porte l'illustration. */
function faceOf(index: number): Mesh {
  return tiles.group
    .getObjectByName(`tile-${index}`)!
    .children.find(child => child.name === 'tile-face') as Mesh;
}

describe('3D-57 — une flèche qui recule se dessine à l\'envers', () => {
  it('ne tourne pas le dessin d\'une flèche qui avance', () => {
    tiles = new BoardTiles3D();
    tiles.build(
      [{ type: 'forward_2', direction: 'forward', image: 'a.png' }] as TileConfig[],
      layoutOf(1)
    );

    expect(faceOf(0).rotation.z).toBeCloseTo(0, 5);
  });

  it('retourne le dessin d\'une flèche qui recule', () => {
    tiles = new BoardTiles3D();
    tiles.build(
      [{ type: 'forward_2', direction: 'backward', image: 'a.png' }] as TileConfig[],
      layoutOf(1)
    );

    // Un demi-tour dans le plan de la case : la flèche pointe à l'opposé.
    expect(Math.abs(faceOf(0).rotation.z)).toBeCloseTo(Math.PI, 5);
  });

  it('traite l\'absence de direction comme un avancement', () => {
    // Les cases du plateau officiel ne déclaraient pas toutes leur sens : le
    // défaut ne doit pas être de tourner le dessin au hasard.
    tiles = new BoardTiles3D();
    tiles.build([{ type: 'forward_2', image: 'a.png' }] as TileConfig[], layoutOf(1));

    expect(faceOf(0).rotation.z).toBeCloseTo(0, 5);
  });
});

describe('3D-57 — seules les flèches tournent', () => {
  it('ne retourne pas une case ordinaire', () => {
    // `direction` n'a de sens que sur une flèche. Une case de boisson qui
    // porterait ce champ par accident ne doit pas s'afficher à l'envers.
    tiles = new BoardTiles3D();
    tiles.build(
      [{ type: 'drink_2', direction: 'backward', image: 'a.png' }] as TileConfig[],
      layoutOf(1)
    );

    expect(faceOf(0).rotation.z).toBeCloseTo(0, 5);
  });
});

describe('3D-57 — le sens vient de la case posée', () => {
  it('lit la direction de la case du rang, pas du catalogue', () => {
    // Le correctif #30 : sur un plateau composé dans l'éditeur, la case posée
    // au rang N n'est pas la case N du catalogue. Une flèche prise dans
    // l'ordre du catalogue pointerait dans le sens d'une autre case.
    const catalog = [
      { type: 'forward_2', direction: 'forward', image: 'a.png' },
      { type: 'forward_2', direction: 'backward', image: 'b.png' },
    ] as TileConfig[];

    const layout = {
      tileSize: 120,
      tileGap: 15,
      columns: 2,
      rows: 1,
      // Le parcours pose la case 1 en premier, puis la 0.
      placements: [
        { tileId: 1, col: 0, row: 0 },
        { tileId: 0, col: 1, row: 0 },
      ],
    } as BoardLayoutConfig;

    tiles = new BoardTiles3D();
    tiles.build(catalog, layout);

    expect(Math.abs(faceOf(0).rotation.z)).toBeCloseTo(Math.PI, 5);
    expect(faceOf(1).rotation.z).toBeCloseTo(0, 5);
  });
});

describe('3D-57 — le dessin et le déplacement lisent la même déclaration', () => {
  it('fait tourner le dessin ET le déplacement avec le même champ', () => {
    // C'EST LA LIVRAISON. Les deux faces du problème étaient déjà traitées
    // séparément — les règles savaient reculer (SCH-02), le dessin sait
    // maintenant tourner — mais elles ne valent que branchées ensemble :
    // Quentin change `direction` dans la donnée, et le pion comme l'image
    // suivent. Si chacun jugeait de son côté ce qu'est une flèche, un type
    // ajouté plus tard bougerait le pion sans tourner l'image.
    const backward = { type: 'forward_2', direction: 'backward' } as TileConfig;
    const forward = { type: 'forward_2', direction: 'forward' } as TileConfig;

    expect(arrowDirection(backward)).toBe('backward');
    expect(arrowDirection(forward)).toBe('forward');

    // Et le rendu n'a pas son propre avis sur la question.
    tiles = new BoardTiles3D();
    tiles.build([backward, forward], layoutOf(2));

    expect(Math.abs(faceOf(0).rotation.z)).toBeCloseTo(Math.PI, 5);
    expect(faceOf(1).rotation.z).toBeCloseTo(0, 5);
  });

  it('ne considère pas comme flèche une case que les règles ignorent', () => {
    // Le critère est partagé : ce que `applyArrows` refuse de traiter ne doit
    // pas se dessiner comme une flèche non plus.
    expect(isArrowTile({ type: 'drink_2' } as TileConfig)).toBe(false);
    expect(isArrowTile({ type: 'forward_2' } as TileConfig)).toBe(true);
    expect(arrowDirection({ type: 'drink_2', direction: 'backward' } as TileConfig))
      .toBe('forward');
  });
});

describe('3D-57 — redresser le dessin sur un parcours qui tourne', () => {
  /** Un plateau d'une case, avec une rotation de placement donnée. */
  function placedAt(rotation: number | undefined, tile: Partial<TileConfig> = {}): Mesh {
    tiles?.dispose();
    tiles = new BoardTiles3D();
    tiles.build(
      [{ type: 'forward_2', image: 'a.png', ...tile }] as TileConfig[],
      {
        tileSize: 120,
        tileGap: 15,
        columns: 1,
        rows: 1,
        placements: [{ tileId: 0, col: 0, row: 0, rotation }],
      } as unknown as BoardLayoutConfig
    );

    return faceOf(0);
  }

  it('ne tourne rien quand le placement ne demande rien', () => {
    // Les placements du plateau officiel n'ont jamais porté d'angle : le
    // défaut ne doit pas se mettre à tourner les dessins existants.
    expect(placedAt(undefined).rotation.z).toBeCloseTo(0, 5);
  });

  it('tourne du quart demandé', () => {
    expect(Math.abs(placedAt(90).rotation.z)).toBeCloseTo(Math.PI / 2, 5);
  });

  it('tourne dans le sens HORAIRE à l\'écran', () => {
    // C'EST LE PIÈGE, et il n'a rien d'évident : la face est vue DE DESSUS,
    // et sa normale pointe vers l'observateur. Une rotation positive sur z
    // tourne donc dans le sens anti-horaire à l'écran. Quentin raisonne en
    // « tourner vers la droite » devant son téléphone — c'est ce sens-là qui
    // doit être respecté, sinon chaque angle qu'il donne part à l'opposé.
    expect(placedAt(90).rotation.z).toBeCloseTo(-Math.PI / 2, 5);
  });

  it('accepte un demi-tour de placement', () => {
    expect(Math.abs(placedAt(180).rotation.z)).toBeCloseTo(Math.PI, 5);
  });

  it('s\'ajoute au demi-tour d\'une flèche qui recule', () => {
    // Les deux sont SÉPARÉS : l'angle redresse le dessin sur le plateau, le
    // sens vient de la règle. Une flèche redressée de 90° qui recule doit
    // montrer les deux effets, pas l'un écraser l'autre.
    const rotated = placedAt(90, { direction: 'backward' });

    expect(rotated.rotation.z).toBeCloseTo(-Math.PI / 2 + Math.PI, 5);
  });

  it('laisse une case ordinaire se redresser aussi', () => {
    // La rotation appartient au PLACEMENT : elle vaut pour n'importe quelle
    // illustration, pas seulement pour les flèches.
    const ordinary = placedAt(90, { type: 'drink_2', direction: undefined });

    expect(ordinary.rotation.z).toBeCloseTo(-Math.PI / 2, 5);
  });
});
