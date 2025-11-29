import { Position } from '../value-objects/Position';

/**
 * Case/Espace du jeu (Entité du domaine)
 * Peut représenter :
 * - Une case de plateau linéaire (Schmitt)
 * - Une cellule de grille (Échecs)
 * - Un espace de jeu (Monopoly)
 */
export class Tile {
  constructor(
    public readonly id: string,
    public readonly position: Position,
    public readonly type: string,
    public readonly name: string,
    public readonly icon?: string,
    public readonly metadata: Record<string, any> = {}
  ) {}

  toJSON() {
    return {
      id: this.id,
      position: {
        index: this.position.index,
        x: this.position.x,
        y: this.position.y
      },
      type: this.type,
      name: this.name,
      icon: this.icon,
      metadata: this.metadata
    };
  }

  static fromJSON(data: any): Tile {
    const position = data.position.x !== undefined
      ? Position.fromCoordinates(data.position.x, data.position.y)
      : Position.fromIndex(data.position.index);

    return new Tile(
      data.id,
      position,
      data.type,
      data.name,
      data.icon,
      data.metadata
    );
  }
}
