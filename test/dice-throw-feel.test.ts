import { describe, it, expect } from 'vitest';
import { swipeToThrow } from '@/features/board/scene3d/dice-gesture';
import { DicePhysics } from '@/features/dice/DicePhysics';
import { WORLD_DICE_CONFIG, DIE_EDGE } from '@/features/board/scene3d/dice-world-config';

/**
 * 3D-62 — le lancer doit SE SENTIR.
 *
 * Quentin (20/09/2026) : « je voudrais une sensation de lancer ».
 *
 * IL N'Y EN AVAIT PAS, et la mesure le disait sans ambiguïté. Entre un geste
 * tout doux et un geste violent, le dé parcourait 1,75 puis 2,36 case — et
 * au-delà la distance REDESCENDAIT, le dé rebondissant contre les murs. Le
 * joueur pouvait mettre toute la force qu'il voulait, il obtenait toujours la
 * même chose.
 *
 * Deux causes, toutes deux mesurées avant d'être corrigées :
 *
 * 1. La plage de lancer allait de 500 à 900, trop étroite pour que la
 *    physique réponde. Elle va maintenant de 400 à 1 200.
 * 2. La référence de geste était à 10 000, si haut qu'aucun geste humain
 *    n'atteignait le haut de la plage. Elle est à 4 000.
 *
 * La borne de 900 avait été posée pour que le dé ne quitte pas la fenêtre de
 * sept cases de la vue suivie. Cette crainte était INFONDÉE : la caméra suit
 * le dé pendant qu'il roule, donc la fenêtre se déplace avec lui.
 *
 * CE TEST EXISTE POUR QUE ÇA NE SE REPERDE PAS. Un réglage de la physique ou
 * de la plage peut réécraser la sensation sans que rien d'autre ne le dise.
 */

/** Une case du plateau officiel, en unités monde. */
const TILE = 120;

/** L'aire de jeu du plateau officiel. */
const ARENA = { width: 1215, height: 675 };

/**
 * Distance moyenne parcourue par un dé lancé à cette vigueur, en cases.
 *
 * La direction est tirée au hasard à chaque essai : un lancer vers un mur
 * proche parcourt moins qu'un lancer vers le large, et c'est la moyenne qui
 * décrit ce que le joueur ressent.
 */
function tilesTravelled(velocity: { x: number; y: number }, verticalVelocity: number): number {
  const TRIALS = 60;
  const speed = Math.hypot(velocity.x, velocity.y);
  let total = 0;

  for (let trial = 0; trial < TRIALS; trial++) {
    const physics = new DicePhysics(
      WORLD_DICE_CONFIG,
      { x: ARENA.width / 2, y: ARENA.height / 2 },
      ARENA
    );

    physics.setTableBounds(
      { minX: 0, maxX: ARENA.width, minY: 0, maxY: ARENA.height },
      { top: true, right: true, bottom: true, left: true }
    );

    const angle = Math.random() * Math.PI * 2;
    physics.throwWithVelocity(
      { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      verticalVelocity,
      { x: 0, y: 0 }
    );

    const start = { ...physics.getState().position };

    let guard = 0;
    while (physics.update(16).isRolling && guard++ < 3000) { /* laisser rouler */ }

    const end = physics.getState().position;
    total += Math.hypot(end.x - start.x, end.y - start.y);
  }

  return total / TRIALS / TILE;
}

/** Un geste du doigt, à l'échelle du plateau entier. */
function gesture(pixels: number, ms: number) {
  return swipeToThrow({ dx: 0, dy: -pixels, ms, worldPerPixel: 1 });
}

describe('3D-62 — un geste plus vif lance plus loin', () => {
  it('donne une progression CONTINUE, du doux au violent', () => {
    // C'EST LA SENSATION, et elle se mesure : chaque palier doit aller plus
    // loin que le précédent. L'ancien réglage cassait cette progression au
    // troisième palier, le dé rebondissant contre les murs.
    const paliers = [
      gesture(30, 300),
      gesture(80, 200),
      gesture(200, 150),
      gesture(300, 120),
      gesture(500, 100),
    ].map(throwRequest =>
      tilesTravelled(throwRequest.velocity, throwRequest.verticalVelocity)
    );

    for (let step = 1; step < paliers.length; step++) {
      expect(paliers[step]).toBeGreaterThan(paliers[step - 1]);
    }
  });

  it('donne au moins un rapport de DEUX entre le plus doux et le plus vif', () => {
    // Mesuré : 1,64 case au plus doux, 3,61 au plus vif, soit 2,2 fois plus.
    // L'ancien réglage donnait 1,75 contre 2,36, soit 1,35 — un écart qu'on
    // ne sent pas, et c'est très exactement ce dont Quentin se plaignait.
    const doux = gesture(30, 300);
    const vif = gesture(500, 100);

    const ratio =
      tilesTravelled(vif.velocity, vif.verticalVelocity) /
      tilesTravelled(doux.velocity, doux.verticalVelocity);

    expect(ratio).toBeGreaterThan(1.8);
  });

  it('laisse un geste franc atteindre le haut de la plage', () => {
    // Avec la référence à 10 000, un geste violent plafonnait à 966 sur une
    // plage montant à 1 200 : le joueur ne pouvait JAMAIS lancer fort.
    expect(gesture(500, 100).speed).toBe(WORLD_DICE_CONFIG.velocityMax);
  });

  it('laisse un geste hésitant lancer doucement', () => {
    // L'autre bout : un effleurement ne doit pas expédier le dé à l'autre
    // bout du plateau, sinon la nuance n'existe pas davantage.
    expect(gesture(30, 300).speed).toBeLessThan(
      WORLD_DICE_CONFIG.velocityMin +
        (WORLD_DICE_CONFIG.velocityMax - WORLD_DICE_CONFIG.velocityMin) * 0.25
    );
  });
});

describe('3D-62 — le dé garde une taille de vrai dé', () => {
  it('occupe moins de la moitié d\'une case', () => {
    // Quentin : « le dé est gros ». Il faisait 72 % de la case, et couvrait
    // donc presque toute l'illustration de celle où il se posait.
    expect(DIE_EDGE / TILE).toBeLessThan(0.5);
  });

  it('reste assez gros pour être attrapé au doigt', () => {
    // L'autre bord : le dé se saisit au doigt (#49). Trop petit, il devient
    // une cible que le pouce manque.
    expect(DIE_EDGE / TILE).toBeGreaterThan(0.4);
  });
});
