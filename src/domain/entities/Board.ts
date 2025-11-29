import { Tile } from './Tile';
import { Position } from '../value-objects/Position';

/**
 * Plateau de jeu (Entité du domaine)
 */
export class Board {
  private tilesMap: Map<string, Tile> = new Map();

  constructor(
    public readonly id: string,
    public readonly layout: 'linear' | 'grid' | 'custom',
    tiles: Tile[] = []
  ) {
    tiles.forEach(tile => this.tilesMap.set(tile.id, tile));
  }

  // Tiles
  get tiles(): Tile[] {
    return Array.from(this.tilesMap.values());
  }

  get size(): number {
    return this.tilesMap.size;
  }

  getTile(id: string): Tile | undefined {
    return this.tilesMap.get(id);
  }

  getTileAt(position: Position): Tile | undefined {
    return this.tiles.find(tile => tile.position.equals(position));
  }

  getTileByIndex(index: number): Tile | undefined {
    return this.tiles.find(tile => tile.position.index === index);
  }

  addTile(tile: Tile): void {
    this.tilesMap.set(tile.id, tile);
  }

  // Serialization
  toJSON() {
    return {
      id: this.id,
      layout: this.layout,
      tiles: this.tiles.map(tile => tile.toJSON())
    };
  }

  static fromJSON(data: any): Board {
    const tiles = data.tiles.map((tileData: any) => Tile.fromJSON(tileData));
    return new Board(data.id, data.layout, tiles);
  }
}
