import { describe, it, expect, afterEach } from 'vitest';
import { Mesh, MeshLambertMaterial, Texture } from 'three';
import { BoardTiles3D } from '@/features/board/scene3d/board-tiles-3d';
import type { TileConfig } from '@/core/models/Tile';
import type { BoardLayoutConfig } from '@/features/board/camera/board-layout.config';

/**
 * 3D-36 — les illustrations sur la face du dessus des cases.
 *
 * Quentin : « mets les images des cases sur leur face du dessus, ça donnera
 * une vraie vision du jeu ». C'est le retour de #36, mise en attente derrière
 * le squelette le temps qu'il valide les volumes — ce qu'il a fait.
 *
 * Deux exigences qui ne vont pas de soi :
 *
 * L'illustration va sur LE DESSUS, pas sur les six faces. Une case est une
 * pièce posée sur la table : sa tranche est de la matière, pas de l'image.
 *
 * Une image qui n'arrive pas ne doit pas effacer la case. Le rendu doit
 * rester lisible pendant le chargement et après un échec — sur un téléphone,
 * quinze images qui arrivent en retard ne doivent pas donner un plateau vide.
 */

let tiles: BoardTiles3D;

afterEach(() => tiles?.dispose());

/** Un plateau minimal, dont on choisit les cases. */
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

function catalogOf(count: number, image?: string): TileConfig[] {
  return Array.from({ length: count }, (_, index) => ({
    type: 'drink_2',
    image: image ?? `assets/tile-${index}.png`,
  })) as TileConfig[];
}

/** La face du dessus d'une case, celle qui porte l'illustration. */
function topFaceOf(tiles: BoardTiles3D, index: number): Mesh | undefined {
  const holder = tiles.group.getObjectByName(`tile-${index}`);

  return holder?.children.find(child => child.name === 'tile-face') as Mesh | undefined;
}

describe('3D-36 — l\'illustration se pose sur le dessus', () => {
  it('donne une face porteuse d\'image à chaque case', () => {
    tiles = new BoardTiles3D();
    tiles.build(catalogOf(3), layoutOf(3));

    for (let index = 0; index < 3; index++) {
      expect(topFaceOf(tiles, index)).toBeDefined();
    }
  });

  it('pose la face à plat, sur le dessus du pavé', () => {
    tiles = new BoardTiles3D();
    tiles.build(catalogOf(1), layoutOf(1));

    const face = topFaceOf(tiles, 0)!;

    // Horizontale, et au-dessus du corps de la case : une illustration
    // enfoncée dans le pavé ne se verrait pas.
    expect(face.rotation.x).toBeCloseTo(-Math.PI / 2, 5);
    expect(face.position.y).toBeGreaterThan(0);
  });

  it('n\'habille que le dessus, pas les six faces', () => {
    // Une case est une pièce posée sur la table : sa tranche est de la
    // matière. Une image plaquée tout autour donnerait un cube d'affiches.
    //
    // On compte les surfaces à qui une illustration est DEMANDÉE, plutôt que
    // d'inspecter les textures posées : jsdom n'en charge aucune, et un test
    // qui les cherche passerait sans rien vérifier.
    const painted: string[] = [];

    tiles = new BoardTiles3D();
    (tiles as unknown as { paint(face: Mesh, image?: string): void }).paint = (
      face: Mesh
    ) => {
      painted.push(face.name);
    };

    tiles.build(catalogOf(1), layoutOf(1));

    expect(painted).toEqual(['tile-face']);
  });
});

describe('3D-36 — une image absente n\'efface pas la case', () => {
  it('rend la case même sans illustration déclarée', () => {
    // Certaines cases n'en ont pas, et l'éditeur permet d'en composer.
    tiles = new BoardTiles3D();
    tiles.build([{ type: 'drink_2' } as TileConfig], layoutOf(1));

    expect(tiles.group.getObjectByName('tile-0')).toBeDefined();
  });

  it('garde une couleur de fond sous l\'illustration', () => {
    // Pendant le chargement, et si l'image échoue : la case doit se lire.
    // Sur un téléphone, quinze images en retard ne doivent pas donner un
    // plateau vide.
    tiles = new BoardTiles3D();
    tiles.build(catalogOf(1), layoutOf(1));

    const face = topFaceOf(tiles, 0)!;
    const material = face.material as MeshLambertMaterial;

    expect(material.color).toBeDefined();
    expect(material.transparent).toBe(true);
  });

  it('ne lève pas quand le chargement échoue', () => {
    // jsdom ne charge aucune image : c'est exactement le chemin d'échec.
    tiles = new BoardTiles3D();

    expect(() => tiles.build(catalogOf(5), layoutOf(5))).not.toThrow();
  });
});

describe('3D-36 — les illustrations suivent les cases POSÉES', () => {
  it('prend l\'image de la case du rang, pas celle du catalogue', () => {
    // Le correctif #30 : sur un plateau composé dans l'éditeur, la case posée
    // au rang N n'est pas la case N du catalogue. Une illustration prise dans
    // l'ordre du catalogue afficherait les bonnes images aux mauvais endroits
    // — le défaut exact qu'avait vu Bastien.
    const catalog = [
      { type: 'start', image: 'assets/start.png' },
      { type: 'drink_2', image: 'assets/drink_2.png' },
      { type: 'finish', image: 'assets/finish.png' },
    ] as TileConfig[];

    const layout = {
      tileSize: 120,
      tileGap: 15,
      columns: 3,
      rows: 1,
      // Le parcours pose la case 2, puis la 0, puis la 1.
      placements: [
        { tileId: 2, col: 0, row: 0 },
        { tileId: 0, col: 1, row: 0 },
        { tileId: 1, col: 2, row: 0 },
      ],
    } as BoardLayoutConfig;

    tiles = new BoardTiles3D();
    tiles.build(catalog, layout);

    expect(tiles.imageAt(0)).toBe('assets/finish.png');
    expect(tiles.imageAt(1)).toBe('assets/start.png');
    expect(tiles.imageAt(2)).toBe('assets/drink_2.png');
  });

  it('libère les textures à la destruction', () => {
    // Three.js ne libère pas les textures tout seul : sans cela, recommencer
    // une partie en accumule dans la mémoire graphique jusqu'à saturation.
    //
    // La texture est INJECTÉE plutôt qu'attendue d'un chargement : jsdom ne
    // charge aucune image, donc un test qui espère en trouver une passerait
    // sans rien vérifier — il ne verrait jamais la moindre texture, libérée
    // ou non.
    tiles = new BoardTiles3D();
    tiles.build(catalogOf(1), layoutOf(1));

    const texture = new Texture();
    let disposed = false;
    texture.dispose = () => {
      disposed = true;
    };

    (tiles as unknown as { textures: Texture[] }).textures.push(texture);

    tiles.dispose();

    expect(disposed).toBe(true);
  });
});
