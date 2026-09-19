import { describe, it, expect } from 'vitest';
import {
  computeFraming,
  measureExtent,
  measureCenter,
} from '@/features/board/scene3d/framing';

/**
 * 3D-01 / 3D-07 — le cadrage, calculé avant tout rendu.
 *
 * C'est le cadrage en portrait qui a fait échouer la tentative précédente de
 * vue en diagonale (TODO.md §2) : 8 cases visibles sur 23. Le calcul est donc
 * une fonction pure, mesurable sans rien afficher, plutôt qu'un effet de bord
 * du rendu qu'on découvre à l'écran.
 */

/** Le plateau officiel, mesuré : large et plat. */
const OFFICIAL = { width: 1335, depth: 795 };

/** Un écran de téléphone en portrait, HUD déduit. */
const PORTRAIT = { width: 390, height: 634 };

describe('3D-07 — l\'orientation retenue est celle qui montre le plus', () => {
  it('tourne le plateau officiel d\'un quart de tour en portrait', () => {
    // Large et plat dans un écran haut et étroit : les deux formes sont
    // orthogonales, d'où un plateau minuscule. Le quart de tour lui fait
    // épouser l'écran.
    expect(computeFraming(OFFICIAL, PORTRAIT).yawDeg).toBe(90);
  });

  it('gagne réellement de la place : mesuré à plus de 50 %', () => {
    const turned = computeFraming(OFFICIAL, PORTRAIT);

    // L'échelle qu'on aurait SANS tourner : on la recalcule à la main, car
    // computeFraming renvoie toujours la meilleure des deux.
    const margin = 0.96;
    const straightScale = Math.min(
      (PORTRAIT.width * margin) / OFFICIAL.width,
      (PORTRAIT.height * margin) / OFFICIAL.depth
    );

    // Le gain mesuré à la main était de +68 % sur le plateau officiel.
    expect(turned.scale / straightScale).toBeGreaterThan(1.5);
  });

  it('NE tourne PAS un parcours en colonne, que ça ruinerait', () => {
    // Le point qui interdit de coder la rotation en dur : un plateau haut et
    // étroit est déjà dans le bon sens. Le tourner diviserait sa taille.
    const column = { width: 400, depth: 1600 };

    expect(computeFraming(column, PORTRAIT).yawDeg).toBe(0);
  });

  it('laisse un plateau carré dans son sens naturel', () => {
    // À gain égal, tourner désorienterait le joueur qui a composé son plateau
    // dans l'éditeur, sans rien apporter.
    expect(computeFraming({ width: 900, depth: 900 }, PORTRAIT).yawDeg).toBe(0);
  });

  it('tourne dans l\'autre sens en paysage, où l\'écran est large', () => {
    const landscape = { width: 844, height: 260 };

    // Le plateau officiel est déjà large : en paysage il n'a pas à tourner.
    expect(computeFraming(OFFICIAL, landscape).yawDeg).toBe(0);
    // Un parcours en colonne, si.
    expect(computeFraming({ width: 400, depth: 1600 }, landscape).yawDeg).toBe(90);
  });
});

describe('3D-07 — l\'échelle fait tenir tout le parcours', () => {
  it('le parcours tient dans la surface disponible, marge comprise', () => {
    const framing = computeFraming(OFFICIAL, PORTRAIT);

    expect(framing.rotated.width * framing.scale).toBeLessThanOrEqual(PORTRAIT.width);
    expect(framing.rotated.depth * framing.scale).toBeLessThanOrEqual(PORTRAIT.height);
  });

  it('laisse une marge : le plateau ne touche pas les bords', () => {
    const framing = computeFraming(OFFICIAL, PORTRAIT);
    const used = Math.max(
      (framing.rotated.width * framing.scale) / PORTRAIT.width,
      (framing.rotated.depth * framing.scale) / PORTRAIT.height
    );

    expect(used).toBeGreaterThan(0.9);
    expect(used).toBeLessThan(1);
  });

  it('remplit la dimension qui contraint', () => {
    // Si aucune des deux ne touche la marge, on gaspille de la place.
    const framing = computeFraming(OFFICIAL, PORTRAIT);
    const byWidth = (framing.rotated.width * framing.scale) / PORTRAIT.width;
    const byDepth = (framing.rotated.depth * framing.scale) / PORTRAIT.height;

    expect(Math.max(byWidth, byDepth)).toBeCloseTo(0.96, 2);
  });

  it('agrandit le plateau quand l\'écran grandit', () => {
    const small = computeFraming(OFFICIAL, { width: 360, height: 430 });
    const large = computeFraming(OFFICIAL, { width: 1200, height: 900 });

    expect(large.scale).toBeGreaterThan(small.scale);
  });

  it('ne divise pas par zéro sur un parcours vide', () => {
    expect(computeFraming({ width: 0, depth: 0 }, PORTRAIT).scale).toBe(1);
  });
});

describe('3D-07 — sur des plateaux de forme quelconque', () => {
  // La contrainte du projet : l'éditeur permet des plateaux en U, en cercle,
  // en T. Aucun ne doit être mal cadré.
  const shapes = [
    { name: 'officiel, large et plat', extent: { width: 1335, depth: 795 }, expected: 90 },
    { name: 'colonne', extent: { width: 400, depth: 1600 }, expected: 0 },
    { name: 'bande horizontale', extent: { width: 2000, depth: 270 }, expected: 90 },
    { name: 'carré', extent: { width: 900, depth: 900 }, expected: 0 },
    { name: 'U', extent: { width: 1000, depth: 700 }, expected: 90 },
  ];

  shapes.forEach(({ name, extent, expected }) => {
    it(`cadre correctement un plateau ${name}`, () => {
      const framing = computeFraming(extent, PORTRAIT);

      expect(framing.yawDeg).toBe(expected);
      // Et dans tous les cas, tout le parcours est visible.
      expect(framing.rotated.width * framing.scale).toBeLessThanOrEqual(PORTRAIT.width);
      expect(framing.rotated.depth * framing.scale).toBeLessThanOrEqual(PORTRAIT.height);
    });
  });
});

describe('3D-07 — mesure de l\'encombrement', () => {
  it('englobe les cases, bords compris', () => {
    const extent = measureExtent(
      [
        { x: 0, z: 0 },
        { x: 240, z: 120 },
      ],
      120
    );

    // Du bord gauche de la première au bord droit de la seconde.
    expect(extent.width).toBe(360);
    expect(extent.depth).toBe(240);
  });

  it('ignore le vide d\'un parcours creux', () => {
    // Un plateau en U laisse un grand trou au milieu. Le cadrer sur la grille
    // déclarée reviendrait à rétrécir le plateau pour afficher du néant.
    const uShape = [
      { x: 0, z: 0 },
      { x: 0, z: 240 },
      { x: 240, z: 240 },
      { x: 480, z: 240 },
      { x: 480, z: 0 },
    ];

    const extent = measureExtent(uShape, 120);
    expect(extent.width).toBe(600);
    expect(extent.depth).toBe(360);
  });

  it('donne au moins la taille d\'une case sur un parcours vide', () => {
    expect(measureExtent([], 120)).toEqual({ width: 120, depth: 120 });
  });

  it('trouve le centre du parcours', () => {
    expect(
      measureCenter([
        { x: 0, z: 0 },
        { x: 400, z: 200 },
      ])
    ).toEqual({ x: 200, z: 100 });
  });

  it('centre sur les cases posées, pas sur l\'origine', () => {
    // Un parcours peut être posé loin de l'origine : la caméra doit le
    // suivre, sinon le plateau sort de l'écran.
    expect(
      measureCenter([
        { x: 1000, z: 500 },
        { x: 1200, z: 700 },
      ])
    ).toEqual({ x: 1100, z: 600 });
  });
});
