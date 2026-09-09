import { describe, it, expect, vi, afterEach } from 'vitest';
import { DicePhysics } from '@/features/dice/DicePhysics';
import { DEFAULT_DICE_CONFIG } from '@/features/dice/DiceConfig';
import { readTopFace, faceAlignment } from '@/features/dice/dice-faces';

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

  it('la valeur finale est celle réellement lue sur la face du dessus', () => {
    // Le résultat n'est plus imposé au lancer : il découle de l'orientation
    // atteinte par la physique. On vérifie donc la cohérence entre la valeur
    // annoncée et le dé tel qu'il repose, pas une valeur décidée d'avance.
    const physics = new DicePhysics(DEFAULT_DICE_CONFIG, initialPosition, bounds);
    physics.throw();

    for (let i = 0; i < 500; i++) {
      physics.update(16);
    }

    const state = physics.getState();
    expect(physics.isRolling()).toBe(false);
    expect(physics.getValue()).toBe(readTopFace(state.orientation));
  });

  it('repose bien à plat une fois arrêté (pas en équilibre sur une arête)', () => {
    const physics = new DicePhysics(DEFAULT_DICE_CONFIG, initialPosition, bounds);
    physics.throw();

    for (let i = 0; i < 500; i++) {
      physics.update(16);
    }

    expect(faceAlignment(physics.getState().orientation)).toBeCloseTo(1, 3);
  });

  it('produit les 6 valeurs sur de nombreux lancers (dé non biaisé)', () => {
    const seen = new Set<number>();

    for (let roll = 0; roll < 250; roll++) {
      const physics = new DicePhysics(DEFAULT_DICE_CONFIG, initialPosition, bounds);
      physics.throw();
      for (let i = 0; i < 500 && physics.isRolling(); i++) {
        physics.update(16);
      }
      seen.add(physics.getValue());
    }

    expect(seen.size).toBe(6);
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

describe('DicePhysics - orientation 3D du cube', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('le cube tourne réellement pendant le vol (orientation qui évolue)', () => {
    const physics = new DicePhysics(DEFAULT_DICE_CONFIG, initialPosition, bounds);
    physics.throw();

    const start = { ...physics.getState().orientation };
    for (let i = 0; i < 10; i++) physics.update(16);
    const after = physics.getState().orientation;

    const changed =
      Math.abs(after.w - start.w) > 1e-4 ||
      Math.abs(after.x - start.x) > 1e-4 ||
      Math.abs(after.y - start.y) > 1e-4 ||
      Math.abs(after.z - start.z) > 1e-4;
    expect(changed).toBe(true);
  });

  it('l\'orientation reste un quaternion unitaire tout au long du lancer', () => {
    const physics = new DicePhysics(DEFAULT_DICE_CONFIG, initialPosition, bounds);
    physics.throw();

    for (let i = 0; i < 200; i++) {
      physics.update(16);
      const q = physics.getState().orientation;
      expect(Math.hypot(q.w, q.x, q.y, q.z)).toBeCloseTo(1, 5);
    }
  });

  it('un lancer vigoureux fait plus culbuter le dé qu\'un lancer mou', () => {
    const spinAfterThrow = (speed: number): number => {
      const physics = new DicePhysics(DEFAULT_DICE_CONFIG, initialPosition, bounds);
      physics.throwWithVelocity({ x: speed, y: 0 }, 400, { x: 0, y: 0 });
      const { spin } = physics.getState();
      return Math.hypot(spin.x, spin.y, spin.z);
    };

    // Moyenne sur plusieurs tirages : le couple comporte une part aléatoire
    const avg = (speed: number) => {
      let total = 0;
      for (let i = 0; i < 40; i++) total += spinAfterThrow(speed);
      return total / 40;
    };

    expect(avg(700)).toBeGreaterThan(avg(80));
  });

  it('le dé finit toujours par se stabiliser sur une face', () => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const physics = new DicePhysics(DEFAULT_DICE_CONFIG, initialPosition, bounds);
      physics.throw();

      let frames = 0;
      while (physics.isRolling() && frames < 1000) {
        physics.update(16);
        frames++;
      }

      expect(physics.isRolling()).toBe(false);
      expect(faceAlignment(physics.getState().orientation)).toBeCloseTo(1, 3);
    }
  });
});
