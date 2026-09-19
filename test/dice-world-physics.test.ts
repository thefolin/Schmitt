import { describe, it, expect } from 'vitest';
import { DicePhysics } from '@/features/dice/DicePhysics';
import { DEFAULT_DICE_CONFIG } from '@/features/dice/DiceConfig';
import {
  WORLD_DICE_CONFIG,
  rollingSpinRate,
  DIE_EDGE,
} from '@/features/board/scene3d/dice-world-config';
import { readTopFace } from '@/features/dice/dice-faces';

/**
 * 3D-44 — un dé qui se lance SUR le plateau.
 *
 * Quentin : « je vois le dé mais je ne le vois pas se déplacer sur le plateau
 * avec la physique comme sur un plateau ».
 *
 * Le défaut n'était PAS une physique absente. `DicePhysics` simule déjà le
 * contact au sol, le rebond, la friction et les collisions — vérifié ligne à
 * ligne. C'était une affaire d'UNITÉS : ses réglages ont été calibrés pour un
 * dé de 52 px dans une boîte d'écran, et je les avais branchés tels quels dans
 * un monde où une case fait 120 unités. Mesuré, le dé parcourait 45 unités en
 * tout — moins de la moitié d'une case. Lâché sur place, arrêté sur place.
 *
 * Une case fait 120 unités ; le plateau officiel 1215 × 675.
 */

const TILE = 120;

/** Côté de l'aire de simulation. Le dé part de son CENTRE. */
const ARENA = 4000;

/**
 * Déroule un lancer complet et mesure ce qu'il a parcouru.
 *
 * Le dé part du CENTRE de l'aire, et c'est essentiel : les bornes de
 * `DicePhysics` vont de 0 à `width`, si bien qu'un lancer démarré en (0, 0)
 * se fait dans un coin. Le dé y rebondit aussitôt sur deux murs, et la
 * distance mesurée décrit alors des rebonds de paroi plutôt qu'un lancer.
 * Mes premières mesures ont été faussées exactement comme ça.
 */
function runThrow(config: typeof DEFAULT_DICE_CONFIG, seed = 0): {
  distance: number;
  frames: number;
  value: number;
  touchedGround: boolean;
} {
  const physics = new DicePhysics(
    config,
    { x: ARENA / 2, y: ARENA / 2 },
    { width: ARENA, height: ARENA }
  );
  physics.throw();

  const start = { ...physics.getState().position };
  let frames = 0;
  let touchedGround = false;

  while (physics.getState().isRolling && frames < 2000) {
    const state = physics.update(16);
    if (state.height === 0) touchedGround = true;
    frames++;
  }

  const end = physics.getState().position;

  return {
    distance: Math.hypot(end.x - start.x, end.y - start.y),
    frames,
    value: physics.getState().currentValue,
    touchedGround,
  };
}

describe('3D-44 — le dé traverse vraiment le plateau', () => {
  it('parcourt plus d\'une case, et non une fraction de case', () => {
    // La mesure qui décrit ce que Quentin voyait : avec les réglages
    // d'écran, le dé ne franchissait même pas une case.
    let total = 0;

    for (let trial = 0; trial < 60; trial++) {
      total += runThrow(WORLD_DICE_CONFIG, trial).distance;
    }

    // Mesuré : médiane à 2,2 cases sur 200 lancers.
    expect(total / 60).toBeGreaterThan(1.5 * TILE);
  });

  it('reste dans la fenêtre suivie de #45', () => {
    // La contrainte que pose la vue suivie : elle cadre sept cases de côté,
    // donc trois et demie depuis le centre. Un dé qui la quitte pendant son
    // roulement disparaît sous les yeux du joueur. Mesuré : à 700-1400, ça
    // arrivait 80 fois sur 200 — d'où le choix de 500-900.
    const halfWindow = 3.5 * TILE;

    for (let trial = 0; trial < 120; trial++) {
      expect(runThrow(WORLD_DICE_CONFIG, trial).distance).toBeLessThan(halfWindow);
    }
  });

  it('part du centre, et non d\'un coin', () => {
    // LE défaut que Quentin voyait, et il n'était pas dans la physique. Les
    // bornes de `DicePhysics` vont de 0 à `width` : un lancer démarré en
    // (0, 0) se fait dans un coin, le dé rebondit aussitôt sur deux murs et
    // revient sur ses pas. C'est ce qui donnait « je ne le vois pas se
    // déplacer sur le plateau ».
    //
    // Mesuré : 45 unités parcourues depuis un coin, 262 depuis le centre —
    // avec exactement la même physique.
    /** Distance réellement parcourue depuis le point de départ. */
    const travelled = (start: { x: number; y: number }): number => {
      const physics = new DicePhysics(WORLD_DICE_CONFIG, start, {
        width: ARENA,
        height: ARENA,
      });
      physics.throw();

      let guard = 0;
      while (physics.getState().isRolling && guard++ < 6000) physics.update(16);

      const end = physics.getState().position;
      return Math.hypot(end.x - start.x, end.y - start.y);
    };

    // Moyenné : `throw()` tire une direction au hasard, et un lancer isolé
    // ne dit rien. Depuis un coin, seules les directions qui s'éloignent des
    // deux murs laissent le dé courir.
    let fromCorner = 0;
    let fromCentre = 0;

    for (let trial = 0; trial < 80; trial++) {
      fromCorner += travelled({ x: 0, y: 0 });
      fromCentre += travelled({ x: ARENA / 2, y: ARENA / 2 });
    }

    expect(fromCentre / 80).toBeGreaterThan(fromCorner / 80);
  });

  it('touche le sol et s\'immobilise', () => {
    // Le contact existe déjà dans DicePhysics : on vérifie qu'il survit au
    // changement d'échelle, une gravité mal mise pouvant faire flotter le dé.
    for (let trial = 0; trial < 20; trial++) {
      const run = runThrow(WORLD_DICE_CONFIG, trial);

      expect(run.touchedGround).toBe(true);
      expect(run.frames).toBeLessThan(2000);
    }
  });

  it('s\'arrête en un temps jouable', () => {
    // Un lancer qui dure cinq secondes rallonge chaque tour de jeu.
    for (let trial = 0; trial < 20; trial++) {
      const seconds = (runThrow(WORLD_DICE_CONFIG, trial).frames * 16) / 1000;

      expect(seconds).toBeLessThan(4);
    }
  });
});

describe('3D-44 — la rotation vient du roulement', () => {
  it('lie la rotation à la vitesse, comme un dé qui roule', () => {
    // Le lien qui manquait, et celui que Quentin appelle « la physique ».
    // Un cube d'arête a qui avance de v sans glisser bascule à 2·v/a.
    expect(rollingSpinRate(800, 86)).toBeCloseTo((2 * 800) / 86, 6);
  });

  it('ne tourne pas quand le dé n\'avance plus', () => {
    // Un dé immobile qui continuerait de tourner trahirait immédiatement
    // l'absence de contact avec la table.
    expect(rollingSpinRate(0)).toBe(0);
  });

  it('tourne plus vite quand il va plus vite', () => {
    expect(rollingSpinRate(1200)).toBeGreaterThan(rollingSpinRate(400));
  });

  it('tourne plus vite si le dé est plus petit', () => {
    // À vitesse égale, un petit dé fait plus de tours pour parcourir la même
    // distance : c'est ce que dit le rapport 2·v/a.
    expect(rollingSpinRate(800, 40)).toBeGreaterThan(rollingSpinRate(800, 120));
  });

  it('reste défini sur une arête absurde', () => {
    expect(rollingSpinRate(800, 0)).toBe(0);
  });
});

describe('3D-44 — l\'exigence de justesse ne bouge pas', () => {
  it('lit toujours une valeur de dé valide', () => {
    // Le risque que PO surveille : une physique plus ample ne doit pas
    // rouvrir la porte au défaut qu'on vient de fermer. Elle ne le peut pas
    // par construction — la valeur est LUE sur l'orientation finale, elle
    // n'est pas décidée par la trajectoire — mais on le vérifie.
    const seen = new Set<number>();

    for (let trial = 0; trial < 200; trial++) {
      const run = runThrow(WORLD_DICE_CONFIG, trial);

      expect(run.value).toBeGreaterThanOrEqual(1);
      expect(run.value).toBeLessThanOrEqual(6);
      seen.add(run.value);
    }

    // Les six faces doivent sortir : un dé qui n'en montrerait que trois
    // serait juste mais truqué.
    expect(seen.size).toBe(6);
  });

  it('pose le dé à plat, sur une face lisible', () => {
    for (let trial = 0; trial < 100; trial++) {
      const physics = new DicePhysics(
        WORLD_DICE_CONFIG,
        { x: 0, y: 0 },
        { width: 4000, height: 4000 }
      );
      physics.throw();

      let guard = 0;
      while (physics.getState().isRolling && guard++ < 2000) physics.update(16);

      const state = physics.getState();

      // La valeur annoncée est bien celle que porte l'orientation finale.
      expect(readTopFace(state.orientation)).toBe(state.currentValue);
    }
  });
});

describe('3D-44 — l\'échelle est cohérente', () => {
  it('dimensionne le dé par rapport à une case', () => {
    // Un dé plus gros qu'une case paraîtrait posé par-dessus le plateau
    // plutôt que dessus.
    expect(DIE_EDGE).toBeLessThan(TILE);
    expect(DIE_EDGE).toBeGreaterThan(TILE / 2);
  });

  it('déclare la même arête que la physique', () => {
    // Deux tailles qui divergeraient donneraient un dé qui roule comme s'il
    // avait une autre taille que celle qu'on voit — exactement le genre de
    // duplication que la refonte supprime.
    expect(WORLD_DICE_CONFIG.size).toBe(DIE_EDGE);
  });
});
