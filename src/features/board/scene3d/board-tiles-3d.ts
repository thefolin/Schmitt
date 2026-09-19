import {
  Group,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  BoxGeometry,
  CylinderGeometry,
  TextureLoader,
  SRGBColorSpace,
  Color,
  type Texture,
} from 'three';
import type { TileConfig } from '@/core/models/Tile';
import {
  calculatePlacementBounds,
  type BoardLayoutConfig,
} from '../camera/board-layout.config';

/**
 * Les cases du plateau, posées dans la scène 3D.
 *
 * Elles vivent dans le même espace que le dé et les pions : c'est tout
 * l'intérêt de la refonte. Plus de transformation CSS à synchroniser à la
 * main, plus de constante d'angle dupliquée entre deux fichiers.
 *
 * Le module ne suppose rien de la forme du parcours : il lit les placements
 * du layout, quels qu'ils soient. Un plateau en U, en cercle ou en T se rend
 * par le même chemin que le plateau officiel.
 */

/**
 * Épaisseur d'une case, en unités monde.
 *
 * 28 sur une case de 120, soit près d'un quart : franchement plus marqué que
 * les 14 du premier jet. Sous une plongée légère on ne voit qu'une mince
 * bande de la tranche, et c'est elle qui dit que la case est un objet posé
 * plutôt qu'un dessin sur le tapis.
 */
const TILE_THICKNESS = 28;

/**
 * Couleurs des cases par famille d'effet.
 *
 * Les illustrations viendront ensuite — Quentin veut d'abord juger les
 * volumes. Elles reprennent le code couleur du plateau physique : rouge pour
 * boire, vert pour distribuer, jaune pour les flèches, bleu pour les cases
 * spéciales.
 */
const TILE_COLORS: Record<string, number> = {
  start: 0xe8e2d2,
  finish: 0xe3c169,
  drink_2: 0xc4382f,
  drink_3: 0xc4382f,
  drink_4: 0xc4382f,
  drink_5: 0xc4382f,
  distribute_2: 0x2f8f4e,
  distribute_3: 0x2f8f4e,
  distribute_4: 0x2f8f4e,
  everyone_drinks: 0xa8422f,
  forward_2: 0xe0a53c,
  chicken: 0x3d7fc4,
  big_chicken: 0x3d7fc4,
  copy: 0x3d7fc4,
  schmitt_call: 0x3d7fc4,
  rule: 0x3d7fc4,
  temple: 0x9b7fd4,
  power: 0xe3c169,
};

/** Couleur de repli pour une case dont le type n'est pas répertorié. */
const TILE_COLOR_DEFAULT = 0xb9c0d0;

/** Dimensions d'un pion, en unités monde. */
const PAWN_RADIUS = 26;
const PAWN_HEIGHT = 46;

/** Couleur du plateau sous les cases. */
const TABLE_COLOR = 0x11512f;

/** Marge du tapis autour des cases. */
const TABLE_PADDING = 90;

export interface TilePosition {
  x: number;
  z: number;
}

export class BoardTiles3D {
  readonly group = new Group();

  private positions: TilePosition[] = [];
  private table: Mesh | null = null;
  private readonly pawns = new Group();
  /** L'illustration de chaque case POSÉE, dans l'ordre du parcours. */
  private images: (string | undefined)[] = [];
  private readonly loader = new TextureLoader();
  /** Les textures chargées, pour pouvoir les libérer. */
  private readonly textures: Texture[] = [];

  /**
   * Dessine le parcours et renvoie la position de chaque case.
   *
   * Les positions servent au cadrage et au placement des pions : elles sont
   * calculées ici, une seule fois, plutôt que recalculées par chaque module
   * qui en a besoin.
   */
  public build(catalog: TileConfig[], layout: BoardLayoutConfig): TilePosition[] {
    this.clear();

    const step = layout.tileSize + layout.tileGap;
    this.positions = [];

    // Le parcours est la SUITE DES PLACEMENTS, pas le catalogue : sur un
    // plateau composé dans l'éditeur, la case posée au rang N n'est pas la
    // case N du catalogue. C'est le correctif #30, qu'on ne perd pas ici.
    layout.placements.forEach((placement, index) => {
      const tile = catalog[placement.tileId];
      if (!tile) return;

      const bounds = calculatePlacementBounds(placement, layout);

      // Le monde 3D est centré sur l'origine : on recentre le parcours pour
      // que les rotations tournent autour de son milieu et non d'un coin.
      const x = bounds.x + bounds.width / 2;
      const z = bounds.y + bounds.height / 2;

      this.positions[index] = { x, z };
      this.images[index] = tile.image;
      this.group.add(this.createTile(tile, bounds, index));
    });

    this.createTable(step);
    this.group.add(this.pawns);

    return this.positions;
  }

  public getPositions(): TilePosition[] {
    return this.positions;
  }

  /**
   * L'illustration de la case posée au rang donné.
   *
   * Exposée pour être vérifiable : c'est ici que se jouait le défaut #30, où
   * les bonnes images se retrouvaient aux mauvais endroits parce qu'on lisait
   * le catalogue dans son ordre au lieu de suivre les placements.
   */
  public imageAt(index: number): string | undefined {
    return this.images[index];
  }

  /** Une case : un pavé épais, éclairé, dont on distingue dessus et tranche. */
  private createTile(
    tile: TileConfig,
    bounds: { x: number; y: number; width: number; height: number },
    index: number
  ): Group {
    const holder = new Group();
    holder.position.set(bounds.x + bounds.width / 2, 0, bounds.y + bounds.height / 2);
    holder.name = `tile-${index}`;

    const color = new Color(TILE_COLORS[tile.type] ?? TILE_COLOR_DEFAULT);

    // Le corps de la case. MeshLambertMaterial RÉAGIT à la lumière : c'est ce
    // qui distingue le dessus de la tranche. Un matériau qui l'ignore rend
    // six faces de la même couleur, et le volume ne se voit pas — c'est ce
    // qui faisait paraître le plateau plat au premier jet.
    const body = new Mesh(
      new BoxGeometry(bounds.width, TILE_THICKNESS, bounds.height),
      new MeshLambertMaterial({ color })
    );
    body.position.y = TILE_THICKNESS / 2;
    body.name = 'tile-body';
    holder.add(body);

    // LA FACE DU DESSUS porte l'illustration. Elle est séparée du corps à
    // dessein : une texture appliquée au pavé entier habillerait les six
    // faces, et une case deviendrait un cube d'affiches. Une case est une
    // pièce posée sur la table — sa tranche est de la matière.
    const face = new Mesh(
      new PlaneGeometry(bounds.width * 0.94, bounds.height * 0.94),
      new MeshLambertMaterial({
        // La couleur reste SOUS l'illustration : pendant le chargement, et
        // si l'image n'arrive jamais, la case se lit quand même. Sur un
        // téléphone, quinze images en retard ne doivent pas donner un
        // plateau vide.
        color: color.clone().lerp(new Color(0xffffff), 0.28),
        transparent: true,
      })
    );
    face.rotation.x = -Math.PI / 2;
    face.position.y = TILE_THICKNESS + 0.6;
    face.name = 'tile-face';
    holder.add(face);

    this.paint(face, tile.image);

    return holder;
  }

  /**
   * Charge l'illustration et la pose sur la face, quand elle arrive.
   *
   * Le chargement est asynchrone et peut échouer : la case est déjà dessinée
   * avec sa couleur de fond, et l'image ne fait que s'ajouter par-dessus. Un
   * échec ne retire donc rien — il laisse la case telle qu'elle était.
   */
  private paint(face: Mesh, image: string | undefined): void {
    if (!image) return;

    this.loader.load(
      image.startsWith('/') ? image : `/${image}`,
      texture => {
        // Sans cet espace colorimétrique, les illustrations ressortent
        // délavées : Three.js les traiterait comme des données brutes.
        texture.colorSpace = SRGBColorSpace;

        const material = face.material as MeshLambertMaterial;
        material.map = texture;
        // La couleur de fond teinterait l'illustration : une fois l'image
        // là, on la laisse parler.
        material.color.set(0xffffff);
        material.needsUpdate = true;

        this.textures.push(texture);
      },
      undefined,
      () => {
        // Rien à faire : la case garde sa couleur, qui reste lisible.
      }
    );
  }

  /**
   * Pose les pions sur leurs cases.
   *
   * Des volumes simples, sans badge ni texture : Quentin veut d'abord juger
   * si un pion posé sur une case se lit correctement. Le reste viendra.
   */
  public setPawns(players: { position: number; color: string }[]): void {
    this.pawns.clear();

    players.forEach((player, index) => {
      const tile = this.positions[player.position];
      if (!tile) return;

      // Plusieurs pions sur la même case : on les décale en cercle plutôt
      // que de les empiler, sinon seul le dernier se voit.
      const sharing = players.filter(p => p.position === player.position);
      const rank = sharing.indexOf(player);
      const spread = sharing.length > 1 ? 26 : 0;
      const angle = (rank / Math.max(1, sharing.length)) * Math.PI * 2;

      const pawn = new Mesh(
        new CylinderGeometry(PAWN_RADIUS, PAWN_RADIUS * 1.15, PAWN_HEIGHT, 20),
        new MeshLambertMaterial({ color: new Color(player.color) })
      );
      pawn.position.set(
        tile.x + Math.cos(angle) * spread,
        TILE_THICKNESS + PAWN_HEIGHT / 2,
        tile.z + Math.sin(angle) * spread
      );
      pawn.name = `pawn-${index}`;

      this.pawns.add(pawn);
    });
  }

  /**
   * Où poser le pion d'un joueur sur une case donnée.
   *
   * Exposé pour que l'animation puisse placer un pion entre deux cases sans
   * reconstruire toute la scène — `setPawns` recrée chaque pion, ce qui est
   * précisément ce qui donnait une téléportation.
   */
  public pawnAnchor(tileIndex: number): { x: number; y: number; z: number } | null {
    const tile = this.positions[tileIndex];
    if (!tile) return null;

    return { x: tile.x, y: TILE_THICKNESS + PAWN_HEIGHT / 2, z: tile.z };
  }

  /** Le pion d'un joueur, pour le déplacer sans le recréer. */
  public pawnOf(index: number): Mesh | null {
    return (this.pawns.getObjectByName(`pawn-${index}`) as Mesh | undefined) ?? null;
  }

  /** Hauteur d'un pion au repos, au-dessus du plateau. */
  public static get pawnRestHeight(): number {
    return TILE_THICKNESS + PAWN_HEIGHT / 2;
  }

  /** Le tapis sous le plateau, qui lui donne son assise. */
  private createTable(step: number): void {
    if (this.positions.length === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const p of this.positions) {
      if (!p) continue;
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }

    const width = maxX - minX + step + TABLE_PADDING * 2;
    const depth = maxZ - minZ + step + TABLE_PADDING * 2;

    const table = new Mesh(
      new PlaneGeometry(width, depth),
      new MeshLambertMaterial({ color: new Color(TABLE_COLOR) })
    );
    table.rotation.x = -Math.PI / 2;
    table.position.set((minX + maxX) / 2, -1, (minZ + maxZ) / 2);
    table.name = 'table';

    this.group.add(table);
    this.table = table;
  }

  /** Vide le plateau, en libérant la mémoire graphique. */
  public clear(): void {
    this.pawns.clear();
    this.group.clear();
    this.table = null;
    this.positions = [];
    this.images = [];
  }

  /**
   * Libère textures et géométries.
   *
   * Three.js ne le fait pas tout seul : sans cela, recommencer une partie
   * accumule des textures dans la mémoire graphique jusqu'à saturation.
   */
  public dispose(): void {
    this.group.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const material = object.material;
      if (Array.isArray(material)) material.forEach(m => m.dispose());
      else material.dispose();
    });

    // Three.js ne libère pas les textures tout seul : sans cela, recommencer
    // une partie en accumule dans la mémoire graphique jusqu'à saturation.
    for (const texture of this.textures) texture.dispose();
    this.textures.length = 0;

    this.clear();
  }
}
