import { describe, it, expect } from 'vitest';
import { DicePhysics } from '@/features/dice/DicePhysics';
import { WORLD_DICE_CONFIG } from '@/features/board/scene3d/dice-world-config';
import { readFavorRoll } from '@/features/board/scene3d/god-favor-roll';
import { FavorDice } from '@/features/board/scene3d/favor-dice';

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

/**
 * 3D-61 — les deux dés partent du geste du joueur.
 *
 * Quentin (20/09/2026) : « les 2 dés de FAVEUR DES DIEUX ne doivent PAS se
 * lancer automatiquement. Le joueur doit les lancer lui-même (geste, comme le
 * dé normal). »
 *
 * Les deux dés partent du MÊME geste, avec la MÊME vitesse : c'est une seule
 * poignée qu'on jette.
 *
 * J'AI FAILLI COMPLIQUER ÇA POUR RIEN, et la trace en vaut la peine. Je
 * redoutais que deux dés lancés identiquement s'arrêtent identiquement, donc
 * un double à chaque tirage — c'est-à-dire la COLÈRE DES DIEUX à chaque
 * passage sur la case. J'avais ajouté un écart de trajectoire pour l'éviter.
 *
 * Mesure faite avant de le garder : sans aucun écart, le taux de doubles est
 * de 16,7 %, exactement celui de deux dés honnêtes. `beginRoll` tire une
 * orientation de départ au hasard pour chaque dé, et le couple de rotation
 * diverge ensuite. Même en forçant les deux dés à partir de la MÊME face et
 * du MÊME point, le taux ne monte qu'à 26 %.
 *
 * L'écart a été retiré : il ne corrigeait rien. Et aucun test n'est écrit
 * sur cette propriété, parce que aucun défaut réaliste ne la met en défaut —
 * un test qui ne peut pas échouer donne une confiance que rien ne soutient,
 * et j'en ai déjà écrit sept de cette sorte sur ce projet.
 */

describe('3D-61 — les dés posés doivent être attrapables', () => {
  it('sont posés sur le plateau, et non à l\'origine du monde', () => {
    // LE DÉFAUT que ce test a trouvé : la position des dés n'était fixée que
    // PENDANT l'animation du lancer. Tant que Quentin lançait la faveur
    // automatiquement, ça ne se voyait pas — l'animation démarrait aussitôt.
    //
    // Depuis que le joueur les lance lui-même, les dés restent posés en
    // attente. Sans `rest()`, ils attendaient à l'origine du monde : hors du
    // plateau, l'un dans l'autre, et le doigt n'avait rien à attraper.
    const dice = new FavorDice(ARENA);
    dice.rest();

    for (const view of dice.views) {
      const { x, z } = view.group.position;

      expect(x).toBeGreaterThan(ARENA.minX);
      expect(x).toBeLessThan(ARENA.maxX);
      expect(z).toBeGreaterThan(ARENA.minZ);
      expect(z).toBeLessThan(ARENA.maxZ);
    }

    dice.dispose();
  });

  it('sont posés SUR le plateau, pas enfoncés dedans', () => {
    const dice = new FavorDice(ARENA);
    dice.rest();

    for (const view of dice.views) {
      expect(view.group.position.y).toBeGreaterThan(0);
    }

    dice.dispose();
  });

  it('sont assez écartés pour qu\'on vise l\'un ou l\'autre', () => {
    // Deux dés superposés ne feraient qu'une cible : le joueur croirait en
    // attraper un et en manquerait l'autre.
    const dice = new FavorDice(ARENA);
    dice.rest();

    const [first, second] = dice.views.map(view => view.group.position);

    expect(Math.abs(first.x - second.x)).toBeGreaterThan(100);

    dice.dispose();
  });
});
