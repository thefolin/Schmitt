import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  BoxGeometry,
  Texture,
  TextureLoader,
  SRGBColorSpace,
  DoubleSide,
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

/** Épaisseur d'une case, en unités monde. Donne son assise au plateau. */
const TILE_THICKNESS = 14;

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

  private readonly loader = new TextureLoader();
  private readonly textures = new Map<string, Texture>();
  private positions: TilePosition[] = [];
  private table: Mesh | null = null;

  /**
   * Dessine le parcours et renvoie la position de chaque case.
   *
   * Les positions servent au cadrage et au placement des pions : elles sont
   * calculées ici, une seule fois, plutôt que recalculées par chaque module
   * qui en a besoin.
   */
  public build(
    catalog: TileConfig[],
    layout: BoardLayoutConfig,
    onReady?: () => void
  ): TilePosition[] {
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
      this.group.add(this.createTile(tile, bounds, index, onReady));
    });

    this.createTable(step);

    return this.positions;
  }

  public getPositions(): TilePosition[] {
    return this.positions;
  }

  /** Une case : un pavé fin, texturé par son illustration. */
  private createTile(
    tile: TileConfig,
    bounds: { x: number; y: number; width: number; height: number },
    index: number,
    onReady?: () => void
  ): Group {
    const holder = new Group();
    holder.position.set(bounds.x + bounds.width / 2, 0, bounds.y + bounds.height / 2);
    holder.name = `tile-${index}`;

    // La tranche, qui donne au plateau son épaisseur. Sans elle, les cases
    // ont l'air peintes sur le tapis plutôt que posées dessus.
    const edge = new Mesh(
      new BoxGeometry(bounds.width, TILE_THICKNESS, bounds.height),
      new MeshBasicMaterial({ color: 0xf2efe6 })
    );
    edge.position.y = TILE_THICKNESS / 2;
    holder.add(edge);

    // La face visible, posée sur le dessus du pavé.
    const face = new Mesh(
      new PlaneGeometry(bounds.width, bounds.height),
      new MeshBasicMaterial({
        color: tile.image ? 0xffffff : 0xdfe4ef,
        side: DoubleSide,
        transparent: true,
      })
    );
    face.rotation.x = -Math.PI / 2;
    face.position.y = TILE_THICKNESS + 0.5;
    holder.add(face);

    if (tile.image) {
      this.applyTexture(face.material as MeshBasicMaterial, tile.image, onReady);
    }

    return holder;
  }

  /**
   * Charge une illustration et l'applique, sans bloquer l'affichage.
   *
   * Les textures sont partagées : le plateau officiel réutilise la même
   * image pour ses quatre cases « distribuez », et en charger quatre copies
   * gaspillerait la mémoire graphique — la ressource rare sur un téléphone
   * d'entrée de gamme.
   */
  private applyTexture(
    material: MeshBasicMaterial,
    url: string,
    onReady?: () => void
  ): void {
    const cached = this.textures.get(url);
    if (cached) {
      material.map = cached;
      material.needsUpdate = true;
      return;
    }

    this.loader.load(
      url,
      texture => {
        // Sans cela les illustrations sortent délavées : elles sont encodées
        // en sRGB, pas en linéaire.
        texture.colorSpace = SRGBColorSpace;
        this.textures.set(url, texture);
        material.map = texture;
        material.needsUpdate = true;
        onReady?.();
      },
      undefined,
      () => {
        // Illustration absente (plateau importé, fichier renommé) : la case
        // garde sa couleur unie plutôt que de disparaître.
        console.warn(`Illustration introuvable : ${url}`);
      }
    );
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
      new MeshBasicMaterial({ color: new Color(TABLE_COLOR) })
    );
    table.rotation.x = -Math.PI / 2;
    table.position.set((minX + maxX) / 2, -1, (minZ + maxZ) / 2);
    table.name = 'table';

    this.group.add(table);
    this.table = table;
  }

  /** Vide le plateau, en libérant la mémoire graphique. */
  public clear(): void {
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

    this.textures.forEach(texture => texture.dispose());
    this.textures.clear();
    this.clear();
  }
}
