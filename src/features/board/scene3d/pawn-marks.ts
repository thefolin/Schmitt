import type { Player } from '@/core/models/Player';
import { getPawnBadges } from '@/features/board/camera/pawn-badges';

/**
 * Les marques portées par un pion, EN 3D.
 *
 * Bastien l'a demandé deux fois (SCH-17) : « ajouter un logo permanent à côté
 * du joueur 🐔 ». Un statut qui dure plusieurs tours et qui change les règles
 * pour son porteur doit se lire sur le plateau, et pas seulement défiler dans
 * le journal au tour où il est obtenu — trois tours plus tard, plus personne
 * ne sait qui porte le bouclier.
 *
 * LA LISTE DES STATUTS N'EST PAS REDÉFINIE ICI. `getPawnBadges` la tient déjà
 * pour le rendu CSS de `main`, avec ses vingt tests et ses deux corrections
 * durement acquises — l'éclair rendu à Zeus (SCH-19), le trophée donné au
 * pouvoir du Schmitt. Deux listes finiraient par diverger, et c'est
 * exactement la duplication que la refonte supprime : un badge qu'on ajoute
 * doit apparaître des deux côtés sans qu'on y pense.
 *
 * Ce module ne fait donc qu'une chose que le CSS ne sait pas faire : dire OÙ
 * la marque se pose au-dessus d'un volume.
 */

/**
 * Hauteur de la marque au-dessus du sommet du pion.
 *
 * Posée un peu AU-DESSUS, pas dessus : une marque collée au pion se confond
 * avec lui quand la caméra s'incline, et l'inclinaison est maintenant un
 * geste du joueur (#74) — la vue ne peut plus être supposée.
 */
export const MARK_LIFT = 26;

/** Côté de la marque, en unités du monde. */
export const MARK_SIZE = 34;

/**
 * Écart vertical entre deux marques d'un même pion.
 *
 * Un pion peut en porter plusieurs : rien n'empêche le Poulet de prendre le
 * pouvoir du Schmitt. Elles s'empilent vers le haut plutôt que de se
 * chevaucher, dans l'ordre que `getPawnBadges` a fixé.
 */
export const MARK_STACK = MARK_SIZE * 0.92;

export interface PawnMark {
  /** Le glyphe à dessiner. */
  icon: string;
  /** Le nom du statut, pour qui doit l'annoncer. */
  label: string;
  /** Hauteur au-dessus du sommet du pion. */
  lift: number;
}

/**
 * Les marques d'un joueur et leur hauteur, de bas en haut.
 *
 * Fonction PURE : ni Three.js ni DOM. Elle se vérifie sans rien afficher, ce
 * qui compte ici parce que le reste — la texture, le sprite — ne se teste pas
 * sous jsdom, faute de WebGL.
 */
export function pawnMarks(player: Player): PawnMark[] {
  return getPawnBadges(player).map((badge, rank) => ({
    icon: badge.icon,
    label: badge.label,
    lift: MARK_LIFT + rank * MARK_STACK,
  }));
}

/**
 * Un joueur porte-t-il une marque ?
 *
 * Sert à ne construire ni texture ni sprite pour l'immense majorité des
 * pions, qui n'en portent aucune.
 */
export function hasMarks(player: Player): boolean {
  return getPawnBadges(player).length > 0;
}
