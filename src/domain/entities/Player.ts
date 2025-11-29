import { Position } from '../value-objects/Position';

/**
 * Joueur (Entité du domaine)
 * Représente un joueur dans n'importe quel type de jeu
 */
export class Player {
  private _position: Position;
  private _resources: Map<string, number> = new Map();

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly color: string,
    initialPosition: Position = Position.fromIndex(0)
  ) {
    this._position = initialPosition;
  }

  // Position
  get position(): Position {
    return this._position;
  }

  moveTo(newPosition: Position): void {
    this._position = newPosition;
  }

  moveBy(steps: number): void {
    const newIndex = this._position.index + steps;
    this._position = Position.fromIndex(Math.max(0, newIndex));
  }

  // Resources (gorgées, points, monnaie, etc.)
  getResource(resourceId: string): number {
    return this._resources.get(resourceId) ?? 0;
  }

  addResource(resourceId: string, amount: number): void {
    const current = this.getResource(resourceId);
    this._resources.set(resourceId, current + amount);
  }

  setResource(resourceId: string, amount: number): void {
    this._resources.set(resourceId, Math.max(0, amount));
  }

  // Serialization
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      position: {
        index: this._position.index,
        x: this._position.x,
        y: this._position.y
      },
      resources: Object.fromEntries(this._resources)
    };
  }

  static fromJSON(data: any): Player {
    const position = data.position.x !== undefined
      ? Position.fromCoordinates(data.position.x, data.position.y)
      : Position.fromIndex(data.position.index);

    const player = new Player(data.id, data.name, data.color, position);

    // Restore resources
    if (data.resources) {
      Object.entries(data.resources).forEach(([key, value]) => {
        player._resources.set(key, value as number);
      });
    }

    return player;
  }
}
