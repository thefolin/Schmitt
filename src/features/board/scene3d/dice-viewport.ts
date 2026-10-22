/**
 * LE SECOND VIEWPORT — le dé vu de près, DANS la même scène.
 *
 * Quentin a tranché le 22/10/2026 entre trois options : « solution (C),
 * même scène, viewport découpé via setScissor, un seul contexte WebGL ».
 *
 * POURQUOI PAS UN SECOND RENDU. `dice-3d-scene.ts` le dit dans son en-tête :
 * le dé partage la scène et la caméra du plateau, et c'est « le juge de paix
 * de la refonte ». Les quatre défauts successifs du dé en CSS venaient tous
 * de représentations dupliquées — une inclinaison écrite à trois endroits
 * qu'il fallait garder d'accord à la main. Un second renderer, avec sa
 * propre scène, rouvrirait exactement cette porte : la face VUE pourrait
 * redevenir différente de la face JOUÉE, et dans un jeu à boire, ce défaut-là
 * se conteste à table.
 *
 * Ici, le dé reste le MÊME objet de la MÊME scène. On le regarde seulement
 * d'une seconde caméra, dessinée dans un rectangle découpé du canvas par
 * `setScissor`. Il n'y a rien à tenir d'accord : ce qui est dessiné dans le
 * panneau EST ce qui est dessiné sur le plateau.
 *
 * Un seul contexte WebGL, donc : c'était l'autre raison du choix, la cible
 * étant Android (`minSdk 28` depuis le 22/10/2026).
 *
 * Ce module ne dessine RIEN. Il calcule le rectangle et la position de la
 * caméra ; c'est `BoardScene` qui rend, parce que c'est elle qui tient le
 * renderer.
 */

/** Un rectangle du canvas, en pixels CSS, origine en haut à gauche. */
export interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Le rectangle que le panneau occupe, mesuré sur la page.
 *
 * `null` quand il n'y a rien à dessiner : panneau fermé, élément absent, ou
 * rectangle dégénéré. L'appelant saute alors le second rendu — dessiner dans
 * un rectangle de largeur nulle fait une division par zéro dans le calcul du
 * rapport d'image.
 */
export function panelViewport(
  panel: { getBoundingClientRect(): DOMRect } | null,
  canvas: { getBoundingClientRect(): DOMRect } | null
): ViewportRect | null {
  if (!panel || !canvas) return null;

  const box = panel.getBoundingClientRect();
  const frame = canvas.getBoundingClientRect();

  if (box.width <= 0 || box.height <= 0) return null;

  // LES COORDONNÉES SONT RELATIVES AU CANVAS, et non à la page : `setScissor`
  // découpe dans le tampon de rendu, dont l'origine est le coin du canvas.
  // Oublier ce décalage dessinerait le dé à côté du panneau dès que le canvas
  // ne commence pas en (0, 0).
  return {
    x: box.left - frame.left,
    y: box.top - frame.top,
    width: box.width,
    height: box.height,
  };
}

/**
 * Convertit en coordonnées WebGL, dont l'origine est EN BAS à gauche.
 *
 * C'est le piège classique de `setScissor` : le DOM compte vers le bas,
 * WebGL vers le haut. Se tromper dessine le dé en miroir vertical de
 * l'endroit voulu — visible seulement quand le panneau n'est pas centré.
 */
export function toGlRect(
  rect: ViewportRect,
  canvasHeight: number
): ViewportRect {
  return {
    x: rect.x,
    y: canvasHeight - rect.y - rect.height,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * À quelle distance reculer pour que le dé tienne dans le rectangle.
 *
 * `margin` laisse de l'air autour : un dé qui touche les bords du panneau
 * paraît à l'étroit, et le moindre rebond le ferait sortir du cadre.
 */
export function diceCameraDistance(
  dieSize: number,
  fovDeg: number,
  aspect: number,
  margin = 2.6
): number {
  const span = dieSize * margin;

  // La hauteur du champ est donnée par le FOV ; la largeur s'en déduit par le
  // rapport d'image. On recule assez pour contenir la plus contraignante des
  // deux — sinon le dé déborde dans un panneau étroit.
  const halfFov = (fovDeg * Math.PI) / 180 / 2;
  const forHeight = span / 2 / Math.tan(halfFov);
  const forWidth = forHeight / Math.max(aspect, 0.0001);

  return Math.max(forHeight, forWidth, dieSize);
}
