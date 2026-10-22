import { describe, it, expect } from 'vitest';
import {
  panelViewport,
  toGlRect,
  diceCameraDistance,
} from '@/features/board/scene3d/dice-viewport';

/**
 * LE SECOND VIEWPORT — le dé vu de près, dans la MÊME scène.
 *
 * Choix (C) de Quentin, 22/10/2026 : « même scène, viewport découpé via
 * setScissor, un seul contexte WebGL ». Ce qui se vérifie ici est la
 * GÉOMÉTRIE — le rectangle et la distance — parce que c'est elle qui décide
 * si le dé tombe au bon endroit, et que le rendu lui-même ne se teste pas
 * sans WebGL.
 */

/** Un faux élément, qui rapporte le rectangle qu'on lui donne. */
function boxed(x: number, y: number, width: number, height: number) {
  return {
    getBoundingClientRect: () =>
      ({
        left: x,
        top: y,
        right: x + width,
        bottom: y + height,
        width,
        height,
        x,
        y,
        toJSON: () => ({}),
      }) as DOMRect,
  };
}

describe('Viewport des dés — où découper', () => {
  it('rend le rectangle du panneau, relatif au canvas', () => {
    // LES COORDONNÉES SONT RELATIVES AU CANVAS : `setScissor` découpe dans
    // le tampon de rendu, dont l'origine est le coin du canvas.
    const rect = panelViewport(boxed(290, 0, 210, 915), boxed(0, 0, 500, 915));

    expect(rect).toEqual({ x: 290, y: 0, width: 210, height: 915 });
  });

  it('retranche l\'origine du canvas quand il ne commence pas en haut à gauche', () => {
    // SANS CE DÉCALAGE le dé se dessinerait à côté du panneau dès que le
    // canvas est décalé dans la page.
    const rect = panelViewport(boxed(300, 60, 200, 400), boxed(20, 40, 480, 800));

    expect(rect).toEqual({ x: 280, y: 20, width: 200, height: 400 });
  });

  it('ne rend RIEN quand le panneau est fermé', () => {
    // Un panneau escamoté mesure zéro : dessiner dedans diviserait par zéro
    // au calcul du rapport d'image.
    expect(panelViewport(boxed(500, 0, 0, 915), boxed(0, 0, 500, 915))).toBeNull();
  });

  it('ne rend rien quand il n\'y a ni panneau ni canvas', () => {
    // La page du rendu CSS n'en porte aucun : le module ne doit pas lever.
    expect(panelViewport(null, boxed(0, 0, 500, 915))).toBeNull();
    expect(panelViewport(boxed(0, 0, 10, 10), null)).toBeNull();
  });
});

describe('Viewport des dés — le haut et le bas', () => {
  it('retourne l\'axe vertical, que WebGL compte à l\'envers', () => {
    // LE PIÈGE CLASSIQUE DE `setScissor` : le DOM compte vers le BAS, WebGL
    // vers le HAUT. Se tromper dessine le dé en miroir vertical — invisible
    // quand le panneau occupe toute la hauteur, flagrant sinon.
    const gl = toGlRect({ x: 290, y: 100, width: 210, height: 300 }, 915);

    expect(gl).toEqual({ x: 290, y: 515, width: 210, height: 300 });
  });

  it('pose un panneau pleine hauteur à l\'origine', () => {
    const gl = toGlRect({ x: 290, y: 0, width: 210, height: 915 }, 915);

    expect(gl.y).toBe(0);
  });
});

describe('Viewport des dés — à quelle distance reculer', () => {
  it('recule assez pour que le dé tienne dans la hauteur', () => {
    // Un dé qui déborde du panneau serait coupé par le découpage.
    const distance = diceCameraDistance(100, 50, 1);

    // Vérification indépendante : la demi-hauteur visible à cette distance
    // doit couvrir la moitié de l'empattement voulu.
    const halfVisible = distance * Math.tan((50 * Math.PI) / 180 / 2);

    expect(halfVisible).toBeGreaterThanOrEqual((100 * 2.6) / 2 - 0.001);
  });

  it('RECULE DAVANTAGE dans un panneau étroit', () => {
    // C'est le cas réel : le panneau est haut et étroit. Ne tenir compte
    // que de la hauteur ferait déborder le dé sur les côtés.
    const large = diceCameraDistance(100, 50, 1);
    const narrow = diceCameraDistance(100, 50, 0.3);

    expect(narrow).toBeGreaterThan(large);
  });

  it('contient le dé en largeur, pas seulement en hauteur', () => {
    const aspect = 0.3;
    const distance = diceCameraDistance(100, 50, aspect);

    const halfHeight = distance * Math.tan((50 * Math.PI) / 180 / 2);
    const halfWidth = halfHeight * aspect;

    expect(halfWidth).toBeGreaterThanOrEqual((100 * 2.6) / 2 - 0.001);
  });

  it('ne colle jamais la caméra au dé', () => {
    // Une distance nulle ou négative mettrait la caméra DANS le dé, et le
    // panneau n'afficherait qu'une face pleine écran.
    expect(diceCameraDistance(100, 50, 10)).toBeGreaterThanOrEqual(100);
  });

  it('ne divise pas par zéro sur un rapport d\'image nul', () => {
    // Un panneau de largeur nulle est déjà écarté en amont, mais la fonction
    // ne doit pas rendre l'infini si on l'appelle quand même.
    expect(Number.isFinite(diceCameraDistance(100, 50, 0))).toBe(true);
  });
});
