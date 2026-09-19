import {
  Group,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  BoxGeometry,
  CylinderGeometry,
  Color,
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
      this.group.add(this.createTile(tile, bounds, index));
    });

    this.createTable(step);
    this.group.add(this.pawns);

    return this.positions;
  }

  public getPositions(): TilePosition[] {
    return this.positions;
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
    holder.add(body);

    // Un liseré clair sur le dessus, légèrement débordant : il souligne
    // l'arête supérieure, là où la lumière accroche sur une vraie pièce.
    const rim = new Mesh(
      new PlaneGeometry(bounds.width * 0.88, bounds.height * 0.88),
      new MeshLambertMaterial({ color: color.clone().lerp(new Color(0xffffff), 0.28) })
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = TILE_THICKNESS + 0.6;
    holder.add(rim);

    return holder;
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

    this.clear();
  }
}
