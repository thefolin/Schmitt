import { describe, it, expect } from 'vitest';
import { TILE_CONFIGS, getTileConfig, getTileConfigByPosition } from '@/features/tiles/tile.config';

describe('TILE_CONFIGS (règles du plateau)', () => {
  it('contient exactement 23 cases, conformément aux règles du Schmitt', () => {
    expect(TILE_CONFIGS).toHaveLength(23);
  });

  it('commence par la case START et termine par la case FINISH', () => {
    expect(TILE_CONFIGS[0].type).toBe('start');
    expect(TILE_CONFIGS[TILE_CONFIGS.length - 1].type).toBe('finish');
  });

  it('chaque case a un type, une icône, un nom, une description et une image', () => {
    for (const tile of TILE_CONFIGS) {
      expect(tile.type).toBeTruthy();
      expect(tile.icon).toBeTruthy();
      expect(tile.name).toBeTruthy();
      expect(tile.description).toBeTruthy();
      expect(tile.image).toBeTruthy();
    }
  });

  it('n\'a qu\'une seule case START et une seule case FINISH', () => {
    const starts = TILE_CONFIGS.filter(t => t.type === 'start');
    const finishes = TILE_CONFIGS.filter(t => t.type === 'finish');
    expect(starts).toHaveLength(1);
    expect(finishes).toHaveLength(1);
  });
});

describe('getTileConfig', () => {
  it('retrouve la config par type pour les types uniques', () => {
    expect(getTileConfig('start')?.name).toBe('START');
    expect(getTileConfig('finish')?.name).toBe('FINISH');
  });

  it('retourne la première occurrence pour un type dupliqué (ex: forward_2)', () => {
    const config = getTileConfig('forward_2' as any);
    expect(config).toBeDefined();
    expect(config?.name).toBe('AVANCEZ DE 2 CASES');
  });

  it('retourne undefined pour un type inconnu', () => {
    expect(getTileConfig('does_not_exist' as any)).toBeUndefined();
  });
});

describe('getTileConfigByPosition', () => {
  it('retourne la case START à la position 0', () => {
    expect(getTileConfigByPosition(0).type).toBe('start');
  });

  it('retourne la case FINISH à la position 22 (dernier index)', () => {
    expect(getTileConfigByPosition(22).type).toBe('finish');
  });

  it('clamp sur FINISH pour toute position au-delà du plateau (ex: position 23 après victoire)', () => {
    expect(getTileConfigByPosition(23).type).toBe('finish');
    expect(getTileConfigByPosition(999).type).toBe('finish');
  });

  it('retourne une case cohérente pour chaque position valide du plateau', () => {
    for (let pos = 0; pos < TILE_CONFIGS.length; pos++) {
      expect(getTileConfigByPosition(pos)).toBe(TILE_CONFIGS[pos]);
    }
  });
});
