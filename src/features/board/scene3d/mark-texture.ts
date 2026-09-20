import { CanvasTexture, SRGBColorSpace, type Texture } from 'three';

/**
 * Peindre un glyphe de statut dans une texture.
 *
 * Les marques d'un pion sont des emoji — 🐔, 🛡️, 🏆 — et non des fichiers
 * d'image : c'est déjà le cas du rendu CSS, où ils sont posés tels quels dans
 * le HTML. Les reprendre ici évite d'inventer quatre illustrations pour des
 * statuts que Quentin n'a jamais demandé à dessiner, et garde les deux rendus
 * visuellement identiques.
 *
 * Un emoji ne se pose pas directement dans une scène 3D : il faut le peindre
 * d'abord. C'est tout ce que fait ce module.
 */

/**
 * Côté de la texture, en pixels.
 *
 * 128 plutôt que 64 : la marque est vue de près quand le joueur zoome sur son
 * pion, et un glyphe pixelisé se lirait mal — or c'est précisément sa
 * lisibilité qui justifie son existence.
 */
export const MARK_TEXTURE_PX = 128;

/**
 * Peint un glyphe centré sur un fond transparent.
 *
 * Renvoie `null` quand le canvas n'est pas disponible : sous jsdom il n'y a
 * pas de contexte 2D, et la scène doit continuer à se construire sans
 * marques plutôt que de casser. Les tests qui comptent portent de toute façon
 * sur la DÉCISION (`pawn-marks.ts`), pas sur la peinture.
 */
export function paintMark(icon: string): Texture | null {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = MARK_TEXTURE_PX;
  canvas.height = MARK_TEXTURE_PX;

  const context = canvas.getContext('2d');
  if (!context) return null;

  // Un cercle clair DERRIÈRE le glyphe. Sans lui, un emoji sombre posé sur
  // une case sombre disparaît — et la marque ne vaut que si elle se voit
  // quelle que soit l'illustration de la case en dessous.
  context.fillStyle = 'rgba(255, 255, 255, 0.92)';
  context.beginPath();
  context.arc(
    MARK_TEXTURE_PX / 2,
    MARK_TEXTURE_PX / 2,
    MARK_TEXTURE_PX / 2 - 4,
    0,
    Math.PI * 2
  );
  context.fill();

  context.font = `${Math.round(MARK_TEXTURE_PX * 0.62)}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(icon, MARK_TEXTURE_PX / 2, MARK_TEXTURE_PX * 0.54);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;

  return texture;
}
