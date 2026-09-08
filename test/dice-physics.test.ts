import { describe, it, expect, vi, afterEach } from 'vitest';
import { DicePhysics } from '@/features/dice/DicePhysics';
import { DEFAULT_DICE_CONFIG } from '@/features/dice/DiceConfig';

const bounds = { width: 800, height: 600 };
const initialPosition = { x: 400, y: 300 };

describe('DicePhysics.throw', () => {
  it('met le dé en mouvement (isRolling) avec la valeur cible fournie', () => {
    const physics = new DicePhysics(DEFAULT_DICE_CONFIG, initialPosition, bounds);
    physics.throw(4);

    expect(physics.isRolling()).toBe(true);
    expect(physics.getValue()).toBe(4);
  });

  it('choisit une valeur aléatoire entre 1 et 6 si aucune cible n\'est donnée', () => {
    const physics = new DicePhysics(DEFAULT_DICE_CONFIG, initialPosition, bounds);
    physics.throw();

    const value = physics.getValue();
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(6);
  });

  it('donne une hauteur initiale (le dé "saute" au lancer)', () => {
    const physics = new DicePhysics(DEFAULT_DICE_CONFIG, initialPosition, bounds);
    physics.throw(3);

    expect(physics.getState().height).toBeGreaterThan(0);
  });
});

describe('DicePhysics.update - gravité et rebond', () => {
  it('applique la gravité : le dé retombe progressivement', () => {
    const physics = new DicePhysics(DEFAULT_DICE_CONFIG, initialPosition, bounds);
    physics.throw(1);

    const heightAfterThrow = physics.getState().height;
    physics.update(16); // ~1 frame à 60fps
    const heightAfterOneFrame = physics.getState().height;

    expect(heightAfterOneFrame).toBeLessThan(heightAfterThrow);
  });

  it('ne descend jamais sous 0 (le sol arrête la chute)', () => {
    const physics = new DicePhysics(DEFAULT_DICE_CONFIG, initialPosition, bounds);
    physics.throw(1);

    // Simuler beaucoup de temps pour être sûr de toucher le sol
    for (let i = 0; i < 200; i++) {
      physics.update(16);
    }

    expect(physics.getState().height).toBeGreaterThanOrEqual(0);
  });

  it('finit par s\'arrêter (isRolling devient false après suffisamment de temps)', () => {
    const physics = new DicePhysics(DEFAULT_DICE_CONFIG, initialPosition, bounds);
    physics.throw(5);

    for (let i = 0; i < 500; i++) {
      physics.update(16);
    }

    expect(physics.isRolling()).toBe(false);
  });

  it('affiche la valeur cible une fois arrêté (getValue reste stable)', () => {
    const physics = new DicePhysics(DEFAULT_DICE_CONFIG, initialPosition, bounds);
    physics.throw(6);

    for (let i = 0; i < 500; i++) {
      physics.update(16);
    }

    expect(physics.getValue()).toBe(6);
  });

  it('update() est un no-op si le dé n\'est pas en train de rouler', () => {
    const physics = new DicePhysics(DEFAULT_DICE_CONFIG, initialPosition, bounds);
    const stateBefore = physics.getState();

    const stateAfter = physics.update(16);
    expect(stateAfter.position).toEqual(stateBefore.position);
    expect(physics.isRolling()).toBe(false);
  });
});

describe('DicePhysics - collisions avec les bords du container (sans table définie)', () => {
  it('rebondit sur le bord gauche du container', () => {
    const physics = new DicePhysics(
      DEFAULT_DICE_CONFIG,
      { x: 5, y: 300 },
      bounds
    );
    physics.throw(1);
    physics.update(16);

    const halfSize = DEFAULT_DICE_CONFIG.size / 2;
    expect(physics.getState().position.x).toBeGreaterThanOrEqual(halfSize - 0.01);
  });

  it('rebondit sur le bord droit du container', () => {
    const physics = new DicePhysics(
      DEFAULT_DICE_CONFIG,
      { x: bounds.width - 2, y: 300 },
      bounds
    );
    physics.throw(1);
    physics.update(16);

    const halfSize = DEFAULT_DICE_CONFIG.size / 2;
    expect(physics.getState().position.x).toBeLessThanOrEqual(bounds.width - halfSize + 0.01);
  });
});

describe('DicePhysics - limites de table (setTableBounds / checkFall)', () => {
  const tableBounds = { minX: 100, maxX: 700, minY: 100, maxY: 500 };

  it('checkFall retourne false si aucune limite de table n\'est configurée', () => {
    const physics = new DicePhysics(DEFAULT_DICE_CONFIG, initialPosition, bounds);
    expect(physics.checkFall()).toBe(false);
  });

  it('détecte une chute quand le dé sort d\'un bord sans bordure', () => {
    const physics = new DicePhysics(DEFAULT_DICE_CONFIG, { x: 50, y: 300 }, bounds);
    physics.setTableBounds(tableBounds, { top: true, right: true, bottom: true, left: false });

    expect(physics.checkFall()).toBe(true);
    expect(physics.getState().hasFallen).toBe(true);
  });

  it('ne détecte pas de chute sur un bord protégé par une bordure', () => {
    const physics = new DicePhysics(DEFAULT_DICE_CONFIG, { x: 50, y: 300 }, bounds);
    physics.setTableBounds(tableBounds, { top: true, right: true, bottom: true, left: true });

    expect(physics.checkFall()).toBe(false);
  });

  it('resetFall remet hasFallen à false', () => {
    const physics = new DicePhysics(DEFAULT_DICE_CONFIG, { x: 50, y: 300 }, bounds);
    physics.setTableBounds(tableBounds, { top: true, right: true, bottom: true, left: false });
    physics.checkFall();
    expect(physics.getState().hasFallen).toBe(true);

    physics.resetFall();
    expect(physics.getState().hasFallen).toBe(false);
  });

  it('un dé bien à l\'intérieur de la table ne tombe jamais', () => {
    const physics = new DicePhysics(DEFAULT_DICE_CONFIG, { x: 400, y: 300 }, bounds);
    physics.setTableBounds(tableBounds, { top: false, right: false, bottom: false, left: false });

    expect(physics.checkFall()).toBe(false);
  });
});

describe('DicePhysics.throwWithVelocity (drag-and-drop)', () => {
  it('démarre le mouvement avec la vélocité et la valeur cible fournies', () => {
    const physics = new DicePhysics(DEFAULT_DICE_CONFIG, initialPosition, bounds);
    physics.throwWithVelocity({ x: 100, y: -50 }, 400, { x: 720, y: 720 }, 2);

    expect(physics.isRolling()).toBe(true);
    expect(physics.getValue()).toBe(2);
    expect(physics.getState().hasFallen).toBe(false);
  });
});

describe('DicePhysics - alignement final des faces (alignToValue via stop)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('chaque valeur de 1 à 6 produit une rotation finale stable et déterministe', () => {
    const rotationsByValue = new Map<number, { x: number; y: number }>();

    for (let value = 1; value <= 6; value++) {
      const physics = new DicePhysics(DEFAULT_DICE_CONFIG, initialPosition, bounds);
      physics.throw(value);
      for (let i = 0; i < 500; i++) {
        physics.update(16);
      }
      rotationsByValue.set(value, { ...physics.getState().rotation });
    }

    // Chaque valeur doit produire une rotation finale différente des autres
    const seen = new Set<string>();
    for (const [, rotation] of rotationsByValue) {
      const key = `${rotation.x},${rotation.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
