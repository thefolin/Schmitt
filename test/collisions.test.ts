import { describe, it, expect } from 'vitest';
import {
  collideBodies,
  collideWithFixed,
  type MovingBody,
  type FixedBody,
} from '@/features/board/scene3d/collisions';

/**
 * 3D-67 — les dés se touchent, les pions font obstacle.
 *
 * Quentin (20/09/2026) : « il faut que les dés puissent se toucher », « il
 * faut que les pions et cases aient leur boîte de collision ».
 *
 * `DicePhysics` ne gère QUE les bords de la table. Deux dés se traversaient
 * donc sans se voir, et un dé passait au travers des pions — ce qui se
 * remarque immédiatement et ruine l'illusion d'objets posés sur une table.
 *
 * La physique partagée n'est pas touchée : elle sert aussi au rendu CSS de
 * `main`. Les chocs sont résolus APRÈS son pas de simulation, comme le
 * roulement l'est déjà.
 *
 * DEUX PROPRIÉTÉS SE MESURENT, et ce sont elles qui disent si un choc est
 * juste : les corps ne doivent plus se chevaucher après coup, et leur élan
 * total doit être conservé. Un test qui se contenterait de « ça a bougé »
 * passerait avec n'importe quelle correction, y compris absurde.
 */

/** Un dé au repos, à poser où l'on veut. */
function die(over: Partial<MovingBody> = {}): MovingBody {
  return { x: 0, z: 0, height: 0, vx: 0, vz: 0, radius: 29, ...over };
}

/** L'élan total d'un ensemble de corps. */
function momentum(...bodies: MovingBody[]) {
  return bodies.reduce(
    (sum, body) => ({ x: sum.x + body.vx, z: sum.z + body.vz }),
    { x: 0, z: 0 }
  );
}

/** L'écart entre deux corps, de centre à centre. */
function gap(a: { x: number; z: number }, b: { x: number; z: number }) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

describe('3D-67 — deux dés se touchent', () => {
  it('ne se heurtent pas quand ils sont loin', () => {
    const a = die({ x: 0 });
    const b = die({ x: 500 });

    expect(collideBodies(a, b)).toBe(false);
    expect(b.x).toBe(500);
  });

  it('se heurtent quand ils se chevauchent', () => {
    const a = die({ x: 0, vx: 400 });
    const b = die({ x: 40 });

    expect(collideBodies(a, b)).toBe(true);
  });

  it('ne se chevauchent plus après le choc', () => {
    // SANS LA SÉPARATION, ils resteraient imbriqués et se repousseraient à
    // chaque image, en vibrant sur place.
    const a = die({ x: 0, vx: 400 });
    const b = die({ x: 40 });

    collideBodies(a, b);

    expect(gap(a, b)).toBeGreaterThanOrEqual(a.radius + b.radius - 0.001);
  });

  it('transmet le mouvement au dé heurté', () => {
    // Un dé lancé sur un dé immobile doit le pousser : c'est tout l'intérêt.
    const a = die({ x: 0, vx: 400 });
    const b = die({ x: 40 });

    collideBodies(a, b);

    expect(b.vx).toBeGreaterThan(0);
    expect(a.vx).toBeLessThan(400);
  });

  it('conserve l\'élan total', () => {
    // LA PROPRIÉTÉ QUI COMPTE. Un choc qui créerait de l'énergie enverrait
    // les dés à travers le plateau ; un choc qui en perdrait trop les
    // collerait. La somme des vitesses ne change pas.
    const a = die({ x: 0, vx: 400, vz: 120 });
    const b = die({ x: 40, vx: -100, vz: 30 });

    const before = momentum(a, b);
    collideBodies(a, b);
    const after = momentum(a, b);

    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.z).toBeCloseTo(before.z, 6);
  });

  it('ne recolle pas deux dés qui s\'éloignent déjà', () => {
    // Ils se chevauchent encore mais se séparent : les freiner reviendrait à
    // les aimanter l'un à l'autre.
    const a = die({ x: 0, vx: -200 });
    const b = die({ x: 40, vx: 200 });

    collideBodies(a, b);

    expect(a.vx).toBeLessThan(0);
    expect(b.vx).toBeGreaterThan(0);
  });

  it('ne divise pas par zéro quand ils sont superposés', () => {
    // Deux corps exactement au même point n'ont pas de direction de choc.
    // Sans garde, la normale devient NaN et les dés partent à l'infini.
    const a = die({ x: 100, z: 100 });
    const b = die({ x: 100, z: 100 });

    collideBodies(a, b);

    for (const value of [a.x, a.z, b.x, b.z, a.vx, b.vx]) {
      expect(Number.isFinite(value)).toBe(true);
    }

    expect(gap(a, b)).toBeGreaterThan(0);
  });

  it('laisse filer deux dés qui se frôlent', () => {
    // Le choc ne doit annuler QUE le rapprochement : deux dés qui se croisent
    // de biais continuent leur route, ils ne s'arrêtent pas net.
    const a = die({ x: 0, z: 0, vx: 0, vz: 300 });
    const b = die({ x: 40, z: 0, vx: 0, vz: 300 });

    collideBodies(a, b);

    // Leur mouvement commun, perpendiculaire au choc, est intact.
    expect(a.vz).toBeCloseTo(300, 6);
    expect(b.vz).toBeCloseTo(300, 6);
  });
});

describe('3D-67 — les pions font obstacle', () => {
  const pawn: FixedBody = { x: 100, z: 0, radius: 26, top: 74 };

  it('renvoie le dé qui le heurte', () => {
    const d = die({ x: 60, vx: 400 });

    expect(collideWithFixed(d, pawn)).toBe(true);
    expect(d.vx).toBeLessThan(0);
  });

  it('NE BOUGE PAS, quoi qu\'il arrive', () => {
    // La position d'un pion est celle d'un JOUEUR sur le parcours, donc une
    // donnée de règle. La déplacer depuis le rendu reviendrait à faire
    // avancer un joueur parce qu'un dé l'a heurté.
    const d = die({ x: 60, vx: 4000 });

    collideWithFixed(d, pawn);

    expect(pawn.x).toBe(100);
    expect(pawn.z).toBe(0);
  });

  it('dégage le dé hors du pion', () => {
    const d = die({ x: 90, vx: 400 });

    collideWithFixed(d, pawn);

    expect(gap(d, pawn)).toBeGreaterThanOrEqual(d.radius + pawn.radius - 0.001);
  });

  it('laisse passer un dé qui vole au-dessus', () => {
    // Un dé en l'air SURVOLE le pion. Sans cette condition, un dé lobé serait
    // dévié par des pions qu'il ne touche visiblement pas — un choc invisible
    // est pire qu'un choc absent.
    const flying = die({ x: 100, height: 200, vx: 400 });

    expect(collideWithFixed(flying, pawn)).toBe(false);
    expect(flying.vx).toBe(400);
  });

  it('heurte un dé qui roule au ras du plateau', () => {
    const rolling = die({ x: 100, height: 0, vx: 400 });

    expect(collideWithFixed(rolling, pawn)).toBe(true);
  });

  it('amortit le rebond plutôt que de le renvoyer intact', () => {
    // Un pion encaisse : le dé repart moins vite qu'il n'est arrivé. Un
    // rebond parfait ferait traverser le plateau au dé à chaque pion touché.
    const d = die({ x: 60, vx: 400 });

    collideWithFixed(d, pawn);

    expect(Math.abs(d.vx)).toBeLessThan(400);
  });

  it('ne retient pas un dé qui s\'éloigne déjà', () => {
    const leaving = die({ x: 90, vx: -300 });

    collideWithFixed(leaving, pawn);

    expect(leaving.vx).toBeLessThan(0);
  });
});

/**
 * 3D-67 — les chocs tiennent EN SITUATION, et pas seulement en isolation.
 *
 * Les tests précédents vérifient un choc isolé. Celui-ci fait rouler un vrai
 * dé, avec la vraie physique, sur un plateau qui porte de vrais pions — c'est
 * la seule façon de savoir si la correction tient image après image, alors
 * que la physique repart de l'état corrigé à chaque pas.
 *
 * LE RISQUE qu'il couvre : un dé rapide peut TRAVERSER un obstacle en une
 * seule image s'il avance de plus que la largeur de l'obstacle. La correction
 * n'aurait alors rien à corriger, puisqu'à aucun moment les corps ne se
 * chevauchent.
 */

import { DicePhysics } from '@/features/dice/DicePhysics';
import { WORLD_DICE_CONFIG, DIE_EDGE } from '@/features/board/scene3d/dice-world-config';

/** Le rayon d'un dé, vu d'au-dessus : la demi-diagonale de sa face. */
const DIE_RADIUS = (DIE_EDGE * Math.SQRT2) / 2;

describe('3D-67 — un dé lancé ne traverse pas les pions', () => {
  it('ne se retrouve jamais À L\'INTÉRIEUR d\'un pion', () => {
    const pawns: FixedBody[] = [
      { x: 700, z: 337, radius: 30, top: 74 },
      { x: 760, z: 337, radius: 30, top: 74 },
    ];

    let overlaps = 0;
    const THROWS = 120;

    for (let trial = 0; trial < THROWS; trial++) {
      const physics = new DicePhysics(
        WORLD_DICE_CONFIG,
        { x: 500, y: 337 },
        { width: 1215, height: 675 }
      );

      physics.setTableBounds(
        { minX: 0, maxX: 1215, minY: 0, maxY: 675 },
        { top: true, right: true, bottom: true, left: true }
      );

      // Droit sur les pions, à pleine vitesse : le cas le plus défavorable.
      physics.throwWithVelocity({ x: 900, y: 0 }, 250, { x: 0, y: 0 });

      let guard = 0;
      while (physics.getState().isRolling && guard++ < 800) {
        const state = physics.update(16);

        const body: MovingBody = {
          x: state.position.x,
          z: state.position.y,
          height: state.height,
          vx: state.velocity.x,
          vz: state.velocity.y,
          radius: DIE_RADIUS,
        };

        let touched = false;
        for (const pawn of pawns) {
          if (collideWithFixed(body, pawn)) touched = true;
        }

        if (touched) {
          state.position.x = body.x;
          state.position.y = body.z;
          state.velocity.x = body.vx;
          state.velocity.y = body.vz;
        }

        // Après correction, plus aucun chevauchement ne doit subsister au sol.
        for (const pawn of pawns) {
          const distance = Math.hypot(state.position.x - pawn.x, state.position.y - pawn.z);

          if (state.height <= pawn.top && distance < DIE_RADIUS + pawn.radius - 1) {
            overlaps++;
          }
        }
      }
    }

    expect(overlaps).toBe(0);
  });

  it('heurte bien les pions placés sur sa route', () => {
    // L'autre bord : une correction qui ne corrigerait JAMAIS rien passerait
    // le test précédent sans effort.
    const pawn: FixedBody = { x: 700, z: 337, radius: 30, top: 74 };

    const physics = new DicePhysics(
      WORLD_DICE_CONFIG,
      { x: 500, y: 337 },
      { width: 1215, height: 675 }
    );

    physics.setTableBounds(
      { minX: 0, maxX: 1215, minY: 0, maxY: 675 },
      { top: true, right: true, bottom: true, left: true }
    );

    physics.throwWithVelocity({ x: 900, y: 0 }, 250, { x: 0, y: 0 });

    let touched = false;
    let guard = 0;

    while (physics.getState().isRolling && guard++ < 800) {
      const state = physics.update(16);

      const body: MovingBody = {
        x: state.position.x,
        z: state.position.y,
        height: state.height,
        vx: state.velocity.x,
        vz: state.velocity.y,
        radius: DIE_RADIUS,
      };

      if (collideWithFixed(body, pawn)) touched = true;
    }

    expect(touched).toBe(true);
  });
});
