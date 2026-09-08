import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  calculatePlacementBounds,
  loadBoardLayout,
  validateBoardLayout,
  DEFAULT_BOARD_LAYOUT,
  fetchBoardLayout,
  type BoardLayoutConfig,
  type TilePlacement,
} from '@/features/board/camera/board-layout.config';

const baseConfig: BoardLayoutConfig = {
  gridRows: 9,
  gridCols: 9,
  tileSize: 120,
  tileGap: 15,
  placements: [],
};

describe('calculatePlacementBounds - taille "full"', () => {
  it('place la première case (0,0) à l\'origine avec la taille complète', () => {
    const placement: TilePlacement = { tileId: 0, gridRow: 0, gridCol: 0, size: 'full' };
    const bounds = calculatePlacementBounds(placement, baseConfig);

    expect(bounds).toEqual({ x: 0, y: 0, width: 120, height: 120 });
  });

  it('avance en X d\'un pas plein (tileSize + tileGap) par colonne', () => {
    const placement: TilePlacement = { tileId: 1, gridRow: 0, gridCol: 1, size: 'full' };
    const bounds = calculatePlacementBounds(placement, baseConfig);

    expect(bounds.x).toBe(120 + 15); // step = 135
  });

  it('compresse le pas en Y de 65% pour compenser la perspective 40deg', () => {
    const placement: TilePlacement = { tileId: 1, gridRow: 1, gridCol: 0, size: 'full' };
    const bounds = calculatePlacementBounds(placement, baseConfig);

    const step = baseConfig.tileSize + baseConfig.tileGap; // 135
    expect(bounds.y).toBeCloseTo(step * 0.65, 5); // 87.75
  });
});

describe('calculatePlacementBounds - taille "half"', () => {
  it('slot 0 (horizontal) prend toute la largeur, moitié de la hauteur', () => {
    const placement: TilePlacement = { tileId: 0, gridRow: 0, gridCol: 0, size: 'half', slot: 0 };
    const bounds = calculatePlacementBounds(placement, baseConfig);

    expect(bounds.width).toBe(120);
    expect(bounds.height).toBe(60);
  });

  it('slot 1 (vertical) prend la moitié de la largeur, toute la hauteur', () => {
    const placement: TilePlacement = { tileId: 0, gridRow: 0, gridCol: 0, size: 'half', slot: 1 };
    const bounds = calculatePlacementBounds(placement, baseConfig);

    expect(bounds.width).toBe(60);
    expect(bounds.height).toBe(120);
  });
});

describe('calculatePlacementBounds - taille "quarter"', () => {
  it.each([
    [0, 0, 0],   // top-left
    [1, 60, 0],  // top-right
    [2, 0, 60],  // bottom-left
    [3, 60, 60], // bottom-right
  ])('slot %i est positionné à l\'offset (%i, %i) dans la case', (slot, offsetX, offsetY) => {
    const placement: TilePlacement = { tileId: 0, gridRow: 0, gridCol: 0, size: 'quarter', slot };
    const bounds = calculatePlacementBounds(placement, baseConfig);

    expect(bounds.x).toBe(offsetX);
    expect(bounds.y).toBe(offsetY);
    expect(bounds.width).toBe(60);
    expect(bounds.height).toBe(60);
  });

  it('utilise le slot 0 par défaut quand non spécifié', () => {
    const placement: TilePlacement = { tileId: 0, gridRow: 0, gridCol: 0, size: 'quarter' };
    const bounds = calculatePlacementBounds(placement, baseConfig);

    expect(bounds).toEqual({ x: 0, y: 0, width: 60, height: 60 });
  });
});

describe('loadBoardLayout', () => {
  it('charge un layout JSON valide tel quel', () => {
    const json = {
      gridRows: 5,
      gridCols: 5,
      tileSize: 100,
      tileGap: 10,
      placements: [{ tileId: 0, gridRow: 0, gridCol: 0, size: 'full' }],
    };

    const layout = loadBoardLayout(json);
    expect(layout.gridRows).toBe(5);
    expect(layout.placements).toHaveLength(1);
  });

  it('applique des valeurs par défaut pour tileSize/tileGap manquants', () => {
    const json = {
      gridRows: 5,
      gridCols: 5,
      placements: [],
    };

    const layout = loadBoardLayout(json);
    expect(layout.tileSize).toBe(120);
    expect(layout.tileGap).toBe(15);
  });

  it('retombe sur le layout par défaut si gridRows est manquant', () => {
    const layout = loadBoardLayout({ gridCols: 5, placements: [] });
    expect(layout).toBe(DEFAULT_BOARD_LAYOUT);
  });

  it('retombe sur le layout par défaut si placements est manquant', () => {
    const layout = loadBoardLayout({ gridRows: 5, gridCols: 5 });
    expect(layout).toBe(DEFAULT_BOARD_LAYOUT);
  });

  it('retombe sur le layout par défaut pour un JSON complètement invalide', () => {
    expect(loadBoardLayout(null)).toBe(DEFAULT_BOARD_LAYOUT);
    expect(loadBoardLayout('pas un objet')).toBe(DEFAULT_BOARD_LAYOUT);
    expect(loadBoardLayout(42)).toBe(DEFAULT_BOARD_LAYOUT);
  });

  it('conserve godPowersZone si présent', () => {
    const json = {
      gridRows: 5,
      gridCols: 5,
      placements: [],
      godPowersZone: { startRow: 1, startCol: 1, rows: 2, cols: 2 },
    };
    const layout = loadBoardLayout(json);
    expect(layout.godPowersZone).toEqual({ startRow: 1, startCol: 1, rows: 2, cols: 2 });
  });
});

describe('validateBoardLayout', () => {
  it('valide un layout complet et correct sans erreur', () => {
    const result = validateBoardLayout({
      gridRows: 9,
      gridCols: 9,
      placements: [{ tileId: 0, gridRow: 0, gridCol: 0, size: 'full' }],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejette un layout sans gridRows', () => {
    const result = validateBoardLayout({ gridCols: 9, placements: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('gridRows is required and must be a number');
  });

  it('rejette un layout sans gridCols', () => {
    const result = validateBoardLayout({ gridRows: 9, placements: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('gridCols is required and must be a number');
  });

  it('rejette un layout où placements n\'est pas un tableau', () => {
    const result = validateBoardLayout({ gridRows: 9, gridCols: 9, placements: 'oops' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('placements is required and must be an array');
  });

  it('rejette un placement avec un tileId non numérique', () => {
    const result = validateBoardLayout({
      gridRows: 9,
      gridCols: 9,
      placements: [{ tileId: 'zero', gridRow: 0, gridCol: 0, size: 'full' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('placements[0].tileId must be a number');
  });

  it('rejette un placement avec une taille invalide', () => {
    const result = validateBoardLayout({
      gridRows: 9,
      gridCols: 9,
      placements: [{ tileId: 0, gridRow: 0, gridCol: 0, size: 'gigantic' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("placements[0].size must be 'full', 'half', or 'quarter'");
  });

  it('accumule toutes les erreurs plutôt que de s\'arrêter à la première', () => {
    const result = validateBoardLayout({
      placements: [{ tileId: 'x', gridRow: 'y', gridCol: 'z', size: 'nope' }],
    });
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
  });
});

describe('fetchBoardLayout', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retourne le layout par défaut si le fetch échoue (réseau coupé)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const layout = await fetchBoardLayout('/assets/schmitt.json');
    expect(layout).toBe(DEFAULT_BOARD_LAYOUT);
  });

  it('retourne le layout par défaut si la réponse HTTP n\'est pas ok (404)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, statusText: 'Not Found' }));

    const layout = await fetchBoardLayout('/assets/missing.json');
    expect(layout).toBe(DEFAULT_BOARD_LAYOUT);
  });

  it('charge et parse le layout quand la réponse est valide', async () => {
    const json = { gridRows: 3, gridCols: 3, placements: [] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => json,
    }));

    const layout = await fetchBoardLayout('/assets/schmitt.json');
    expect(layout.gridRows).toBe(3);
  });
});
