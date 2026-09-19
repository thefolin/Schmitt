/**
 * Où en est le joueur dans le parcours.
 *
 * Cadrer une fenêtre autour du pion (#45) règle la lisibilité, mais retire la
 * vue d'ensemble qui disait implicitement où l'on en était. Sans rien en
 * retour, on échangerait un problème de lisibilité contre un problème
 * d'orientation.
 *
 * Le calcul est PUR : il ne sait ni dessiner ni mesurer un écran, et se
 * vérifie donc sans rien afficher.
 */

export interface JourneyProgress {
  /** Avancement entre 0 et 1, pour une barre ou une jauge. */
  ratio: number;
  /** Ce qu'on affiche au joueur, compté comme il compte. */
  label: string;
}

/**
 * Situe une case dans le parcours.
 *
 * Renvoie `null` quand il n'y a rien à situer : mieux vaut ne rien afficher
 * qu'une barre trompeuse.
 */
export function buildJourneyProgress(
  position: number,
  total: number
): JourneyProgress | null {
  if (!Number.isFinite(total) || total < 2) return null;

  const last = total - 1;
  const clamped = Math.max(0, Math.min(Math.round(position), last));

  return {
    ratio: clamped / last,
    // Le joueur compte à partir de un : lui annoncer « case 4 » quand il en
    // voit la cinquième lui demanderait de faire la conversion lui-même.
    label: `Case ${clamped + 1} / ${total}`,
  };
}
