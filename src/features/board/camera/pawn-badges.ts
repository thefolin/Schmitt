import type { Player } from '@/core/models/Player';

/**
 * Les marques portées par un pion pour dire son statut durable.
 *
 * Un statut qui dure plusieurs tours et qui change les règles pour son porteur
 * doit être lisible sur le plateau, pas seulement annoncé au moment où il est
 * obtenu. C'est le sens du retour de Bastien, formulé deux fois (SCH-17) :
 * « ajouter un logo permanent à côté du joueur 🐔 ».
 */

/** Le badge du pouvoir du Schmitt. */
export const SCHMITT_POWER_BADGE = {
  icon: '\u{1F3C6}', // 🏆
  label: 'Pouvoir du Schmitt',
} as const;

/**
 * Le pouvoir du Schmitt ne porte plus l'éclair (SCH-19).
 *
 * ⚡ est l'attribut de Zeus, et `AssetManager` l'attribuait aux deux : Bastien
 * a vu l'éclair sur un pion et en a conclu que le joueur détenait le pouvoir
 * de Zeus, puis a signalé comme un bug l'absence de l'effet correspondant.
 *
 * L'éclair reste donc à Zeus. Le pouvoir du Schmitt, qui se gagne au bout du
 * parcours et déclenche le retour, prend le trophée.
 */
export const ZEUS_POWER_BADGE = {
  icon: '\u{26A1}', // ⚡
  label: 'Pouvoir de Zeus',
} as const;

/** Les deux rangs de Poulet, visuellement distincts. */
export const CHICKEN_BADGES = {
  1: { icon: '\u{1F424}', label: 'Petit Poulet' }, // 🐤
  2: { icon: '\u{1F414}', label: 'Gros Poulet' },  // 🐔
} as const;

export interface PawnBadge {
  icon: string;
  label: string;
}

/**
 * Les badges à afficher pour un joueur, dans l'ordre d'affichage.
 *
 * Un pion peut en porter plusieurs : rien n'empêche le Poulet de prendre le
 * pouvoir du Schmitt.
 */
export function getPawnBadges(player: Player): PawnBadge[] {
  const badges: PawnBadge[] = [];

  if (player.hasSchmittPower) badges.push(SCHMITT_POWER_BADGE);

  const chicken = CHICKEN_BADGES[player.chickenRank as 1 | 2];
  if (chicken) badges.push(chicken);

  return badges;
}

/**
 * Les statuts d'un joueur, écrits en toutes lettres pour la liste des joueurs.
 *
 * Un badge seul se prête à l'interprétation : c'est ce qui a fait lire « Zeus »
 * sur le pion qui portait le pouvoir du Schmitt (SCH-19). Le badge marque le
 * pion sur le plateau, ce libellé dit lequel c'est.
 */
export function describePlayerStatuses(player: Player): string[] {
  return getPawnBadges(player).map(b => `${b.icon} ${b.label}`);
}

/**
 * Le HTML des badges d'un pion, ou une chaîne vide s'il n'en porte aucun.
 *
 * Le `title` porte le nom du statut : le badge seul se prête à
 * l'interprétation — c'est précisément ce qui a induit Bastien en erreur avec
 * l'éclair — et le survol donne la réponse sans encombrer le plateau.
 */
export function renderPawnBadges(player: Player): string {
  const badges = getPawnBadges(player);
  if (badges.length === 0) return '';

  const items = badges
    .map(
      b =>
        `<span class="pawn-badge" title="${b.label}" aria-label="${b.label}">${b.icon}</span>`
    )
    .join('');

  return `<div class="pawn-badges">${items}</div>`;
}
