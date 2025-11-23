/**
 * Système de layouts pour le plateau
 * Facilement extensible pour ajouter de nouveaux layouts
 */

export interface TilePosition {
  x: number;
  y: number;
  angle: number;
}

export type LayoutType = 'circle' | 'square' | 'spiral' | 'custom';

export interface BoardLayout {
  name: string;
  type: LayoutType;
  calculatePositions(
    tileCount: number,
    canvasWidth: number,
    canvasHeight: number
  ): TilePosition[];
}

/**
 * Layout circulaire (actuel)
 */
export class CircleLayout implements BoardLayout {
  name = 'Cercle';
  type: LayoutType = 'circle';

  calculatePositions(
    tileCount: number,
    canvasWidth: number,
    canvasHeight: number
  ): TilePosition[] {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const radius = Math.min(canvasWidth, canvasHeight) * 0.35;
    const positions: TilePosition[] = [];

    for (let i = 0; i < tileCount; i++) {
      const angle = (i / tileCount) * Math.PI * 2 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      positions.push({ x, y, angle });
    }

    return positions;
  }
}

/**
 * Layout carré/rectangulaire
 */
export class SquareLayout implements BoardLayout {
  name = 'Carré';
  type: LayoutType = 'square';

  calculatePositions(
    tileCount: number,
    canvasWidth: number,
    canvasHeight: number
  ): TilePosition[] {
    const positions: TilePosition[] = [];
    const margin = 40;
    const width = canvasWidth - margin * 2;
    const height = canvasHeight - margin * 2;

    // Répartir les cases sur le périmètre
    const perimeter = (width + height) * 2;
    const spacing = perimeter / tileCount;

    let currentDistance = 0;

    for (let i = 0; i < tileCount; i++) {
      let x = 0, y = 0, angle = 0;

      if (currentDistance < width) {
        // Côté haut
        x = margin + currentDistance;
        y = margin;
        angle = 0;
      } else if (currentDistance < width + height) {
        // Côté droit
        x = margin + width;
        y = margin + (currentDistance - width);
        angle = Math.PI / 2;
      } else if (currentDistance < width * 2 + height) {
        // Côté bas
        x = margin + width - (currentDistance - width - height);
        y = margin + height;
        angle = Math.PI;
      } else {
        // Côté gauche
        x = margin;
        y = margin + height - (currentDistance - width * 2 - height);
        angle = -Math.PI / 2;
      }

      positions.push({ x, y, angle });
      currentDistance += spacing;
    }

    return positions;
  }
}

/**
 * Layout en spirale
 */
export class SpiralLayout implements BoardLayout {
  name = 'Spirale';
  type: LayoutType = 'spiral';

  calculatePositions(
    tileCount: number,
    canvasWidth: number,
    canvasHeight: number
  ): TilePosition[] {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const maxRadius = Math.min(canvasWidth, canvasHeight) * 0.4;
    const positions: TilePosition[] = [];

    for (let i = 0; i < tileCount; i++) {
      const progress = i / tileCount;
      const angle = progress * Math.PI * 4; // 2 tours complets
      const radius = maxRadius * (0.2 + progress * 0.8); // De 20% à 100%

      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      positions.push({ x, y, angle });
    }

    return positions;
  }
}

/**
 * Layout custom (positions personnalisées)
 */
export class CustomLayout implements BoardLayout {
  name = 'Custom';
  type: LayoutType = 'custom';

  private customPositions: TilePosition[] = [];

  constructor(positions?: TilePosition[]) {
    if (positions) {
      this.customPositions = positions;
    }
  }

  setPositions(positions: TilePosition[]): void {
    this.customPositions = positions;
  }

  calculatePositions(
    tileCount: number,
    canvasWidth: number,
    canvasHeight: number
  ): TilePosition[] {
    if (this.customPositions.length > 0) {
      return this.customPositions;
    }

    // Fallback : cercle par défaut
    return new CircleLayout().calculatePositions(tileCount, canvasWidth, canvasHeight);
  }
}

/**
 * Factory pour obtenir un layout
 */
export class LayoutFactory {
  private static layouts: Map<LayoutType, BoardLayout> = new Map([
    ['circle', new CircleLayout()],
    ['square', new SquareLayout()],
    ['spiral', new SpiralLayout()],
    ['custom', new CustomLayout()]
  ]);

  static getLayout(type: LayoutType): BoardLayout {
    const layout = this.layouts.get(type);
    if (!layout) {
      console.warn(`Layout "${type}" non trouvé, utilisation du cercle par défaut`);
      return this.layouts.get('circle')!;
    }
    return layout;
  }

  static getAllLayouts(): BoardLayout[] {
    return Array.from(this.layouts.values());
  }
}
