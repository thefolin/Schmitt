/**
 * Position dans le jeu
 * Peut représenter :
 * - Index linéaire (jeux de plateau : 0-23)
 * - Coordonnées 2D (jeux de grille : x, y)
 */
export class Position {
  constructor(
    public readonly index: number,
    public readonly x?: number,
    public readonly y?: number
  ) {}

  static fromIndex(index: number): Position {
    return new Position(index);
  }

  static fromCoordinates(x: number, y: number): Position {
    return new Position(-1, x, y);
  }

  equals(other: Position): boolean {
    if (this.index >= 0 && other.index >= 0) {
      return this.index === other.index;
    }
    return this.x === other.x && this.y === other.y;
  }

  toString(): string {
    if (this.index >= 0) {
      return `Position(${this.index})`;
    }
    return `Position(${this.x}, ${this.y})`;
  }
}
