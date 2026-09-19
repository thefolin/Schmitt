import { describe, it, expect } from 'vitest';
import { buildJourneyProgress } from '@/features/board/scene3d/journey-progress';

/**
 * 3D-45 — savoir où l'on est dans le parcours.
 *
 * PO : « le joueur doit toujours pouvoir SE SITUER dans le parcours. Sinon on
 * échange un problème de lisibilité contre un problème d'orientation. »
 *
 * La remarque est juste : cadrer une fenêtre de sept cases règle la
 * lisibilité mais retire la vue d'ensemble qui, elle, disait implicitement où
 * l'on en était. Il faut rendre cette information autrement.
 *
 * Le calcul est PUR : il ne sait ni dessiner ni mesurer un écran. C'est ce
 * qui permet de vérifier ce qu'il annonce sans rien afficher.
 */

describe('3D-45 — la progression dans le parcours', () => {
  it('situe le départ au début', () => {
    const progress = buildJourneyProgress(0, 23);

    expect(progress.ratio).toBe(0);
  });

  it('situe l\'arrivée à la fin', () => {
    const progress = buildJourneyProgress(22, 23);

    expect(progress.ratio).toBe(1);
  });

  it('situe le milieu au milieu', () => {
    const progress = buildJourneyProgress(11, 23);

    expect(progress.ratio).toBeCloseTo(0.5, 1);
  });

  it('compte les cases dans la langue du joueur', () => {
    // « Case 5 sur 23 » se lit sans effort ; un indice depuis zéro ferait
    // annoncer « case 4 » à quelqu'un qui en voit la cinquième.
    const progress = buildJourneyProgress(4, 23);

    expect(progress.label).toBe('Case 5 / 23');
  });

  it('reste dans les bornes si la position dépasse', () => {
    // Un pion à l'arrivée, ou un parcours rétréci après coup : l'indicateur
    // ne doit ni sortir de sa barre ni annoncer une case qui n'existe pas.
    expect(buildJourneyProgress(99, 23).ratio).toBe(1);
    expect(buildJourneyProgress(-5, 23).ratio).toBe(0);
  });

  it('se tait sur un parcours vide', () => {
    // Rien à situer : mieux vaut ne rien afficher qu'une barre trompeuse.
    expect(buildJourneyProgress(0, 0)).toBeNull();
    expect(buildJourneyProgress(0, 1)).toBeNull();
  });
});
