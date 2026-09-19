import { describe, it, expect } from 'vitest';
import { DicePhysics } from '@/features/dice/DicePhysics';
import { WORLD_DICE_CONFIG } from '@/features/board/scene3d/dice-world-config';
import { readFavorRoll } from '@/features/board/scene3d/god-favor-roll';

/**
 * 3D-58 — les deux dés de la faveur se posent sur des faces lisibles.
 *
 * jsdom n'a pas de WebGL : on ne peut pas vérifier que les dés APPARAISSENT,
 * et un test qui prétendrait le faire passerait avec le défaut présent — on
 * en a déjà eu sept de cette sorte. Ce qui SE vérifie sans rendu, c'est la
 * chaîne de bout en bout : deux corps physiques lancés dans l'aire du
 * plateau s'immobilisent sur des faces entières, et leur somme désigne
 * toujours une faveur de la table.
 *
 * La même physique, aux mêmes réglages monde, que le dé du tour — mesurée à
 * 0 % d'erreur de lecture sur 3 000 tirages. On vérifie ici qu'elle tient
 * AUSSI depuis les deux points de lancer écartés des dés de faveur, qui
 * partent plus près des bords.
 */

/** L'aire du plateau officiel, en unités monde. */
const ARENA = { minX: 0, maxX: 1215, minZ: 0, maxZ: 675 };

/** L'écart de lancer de `FavorDice`. */
const SPREAD = 0.22;

/** Un dé de faveur, lancé et laissé s'immobiliser. */
function settle(side: -1 | 1): number {
  const width = ARENA.maxX - ARENA.minX;
  const height = ARENA.maxZ - ARENA.minZ;

  const physics = new DicePhysics(
    WORLD_DICE_CONFIG,
    { x: (ARENA.minX + ARENA.maxX) / 2 + side * width * SPREAD, y: (ARENA.minZ + ARENA.maxZ) / 2 },
    { width, height }
  );

  physics.setTableBounds(
    { minX: ARENA.minX, maxX: ARENA.maxX, minY: ARENA.minZ, maxY: ARENA.maxZ },
    { top: true, right: true, bottom: true, left: true }
  );

  physics.throw();

  // Un garde-fou, pas une règle : si la physique ne s'arrêtait pas, le test
  // doit échouer plutôt que tourner sans fin.
  let guard = 0;
  while (physics.update(16).isRolling && guard++ < 2000) { /* laisser rouler */ }

  expect(guard).toBeLessThan(2000);

  return physics.getState().currentValue;
}

describe('3D-58 — deux dés lancés ensemble donnent toujours une faveur', () => {
  it('se posent sur des faces entières de 1 à 6', () => {
    const seen = new Set<number>();

    for (let trial = 0; trial < 200; trial++) {
      for (const side of [-1, 1] as const) {
        const face = settle(side);

        expect(Number.isInteger(face)).toBe(true);
        expect(face).toBeGreaterThanOrEqual(1);
        expect(face).toBeLessThanOrEqual(6);

        seen.add(face);
      }
    }

    // Les six faces doivent sortir : un dé qui n'en montrerait que trois
    // serait lesté, et la table des faveurs deviendrait injouable.
    expect(seen.size).toBe(6);
  });

  it('désigne une faveur à tous les coups', () => {
    // C'est la chaîne complète : physique → deux faces → somme → faveur.
    // Un seul tirage sans faveur laisserait le joueur devant deux dés et
    // aucune annonce, ce qui est le défaut de départ sous une autre forme.
    for (let trial = 0; trial < 200; trial++) {
      const roll = readFavorRoll(settle(-1), settle(1));

      expect(roll.favor).not.toBeNull();
    }
  });
});
