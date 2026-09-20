import { describe, it, expect } from 'vitest';
import { DicePhysics } from '@/features/dice/DicePhysics';
import { WORLD_DICE_CONFIG } from '@/features/board/scene3d/dice-world-config';

/**
 * 3D-70 — la caméra ne poursuit pas le dé.
 *
 * Quentin (20/09/2026) : « cela m'a presque fait vomir comme cela tourne si
 * vite », sur un Pixel 10.
 *
 * CE N'EST PAS UN DÉTAIL DE CONFORT : c'est un mal des transports, provoqué
 * par une image qui défile sans que le joueur commande ce mouvement.
 *
 * La caméra suivait le dé image par image. Mesuré sur un Pixel 10 en
 * portrait, au plus fort de la plage de lancer : jusqu'à 1 372 px par seconde
 * de panoramique subi. Le seuil d'inconfort se situe bien en deçà, vers
 * 800 px/s. J'avais AGGRAVÉ la chose en allongeant les lancers (#69) sans
 * revoir le cadrage qui allait avec.
 *
 * LA CORRECTION tient à une mesure : le dé ne s'écarte jamais de plus de
 * 4,75 cases de son point de départ. Un cadre de ONZE cases posé sur ce
 * départ le contient donc toujours, et peut rester IMMOBILE. C'est le joueur
 * qui suit le dé des yeux, pas l'image qui défile sous lui.
 */

/** Le cadre retenu pendant un lancer, en cases. */
const ROLL_SPAN_TILES = 11;
const TILE = 120;

/** La moitié du cadre : l'écart maximal tolérable depuis le départ. */
const HALF_FRAME = (ROLL_SPAN_TILES * TILE) / 2;

const ARENA = { width: 1215, height: 675 };

/** L'écart maximal du dé à son point de départ, sur un lancer. */
function straying(speed: number, seed: number): number {
  const physics = new DicePhysics(
    WORLD_DICE_CONFIG,
    { x: ARENA.width / 2, y: ARENA.height / 2 },
    ARENA
  );

  physics.setTableBounds(
    { minX: 0, maxX: ARENA.width, minY: 0, maxY: ARENA.height },
    { top: true, right: true, bottom: true, left: true }
  );

  // Une direction répartie sur le tour, pour balayer tous les cas plutôt que
  // de retomber sur la même diagonale.
  const angle = (seed / 64) * Math.PI * 2;
  physics.throwWithVelocity(
    { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    300,
    { x: 0, y: 0 }
  );

  const start = { ...physics.getState().position };

  let guard = 0;
  let worst = 0;

  while (physics.getState().isRolling && guard++ < 2000) {
    const state = physics.update(16);

    worst = Math.max(
      worst,
      Math.abs(state.position.x - start.x),
      Math.abs(state.position.y - start.y)
    );
  }

  return worst;
}

describe('3D-70 — un cadre IMMOBILE suffit à contenir le lancer', () => {
  it('garde le dé dans le cadre, à pleine vigueur', () => {
    // C'EST LA CONDITION qui rend l'immobilité acceptable : si le dé sortait
    // du cadre, il faudrait bien le suivre, et la nausée reviendrait.
    for (let seed = 0; seed < 64; seed++) {
      expect(straying(WORLD_DICE_CONFIG.velocityMax, seed)).toBeLessThan(HALF_FRAME);
    }
  });

  it('le garde aussi sur un lancer mou', () => {
    for (let seed = 0; seed < 32; seed++) {
      expect(straying(WORLD_DICE_CONFIG.velocityMin, seed)).toBeLessThan(HALF_FRAME);
    }
  });

  it('garde de la MARGE, et pas seulement de justesse', () => {
    // Un cadre au plus juste donnerait envie de suivre le dé dès qu'il frôle
    // le bord. On veut qu'il reste franchement à l'intérieur.
    let worst = 0;

    for (let seed = 0; seed < 64; seed++) {
      worst = Math.max(worst, straying(WORLD_DICE_CONFIG.velocityMax, seed));
    }

    expect(worst).toBeLessThan(HALF_FRAME * 0.9);
  });
});

describe('3D-70 — le cadre reste lisible sur un grand téléphone', () => {
  it('laisse une case au-dessus de la cible tactile, prise comprise', () => {
    // Pixel 10 en portrait : 915 px de haut, champ de 38°. Un cadre de onze
    // cases y donne 83 px la case et 40 px le dé — auxquels s'ajoutent les
    // 12 px de zone de prise de chaque côté (#63), soit 64 px de cible.
    const screenHeight = 915;
    const fov = (38 * Math.PI) / 180;

    const span = ROLL_SPAN_TILES * TILE;
    const distance = span / 2 / Math.tan(fov / 2);
    const visible = 2 * distance * Math.tan(fov / 2);
    const pixelsPerUnit = screenHeight / visible;

    const diceTarget = 58 * pixelsPerUnit + 12 * 2;

    expect(diceTarget).toBeGreaterThanOrEqual(48);
  });
});
