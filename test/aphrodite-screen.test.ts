import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  showAphroditeScreen,
  type AphroditeTarget,
} from '@/features/board/scene3d/aphrodite-screen';

/**
 * L'écran d'Aphrodite : qui part, avec quel dé, dans quel sens.
 *
 * SEULE MODALE QUI DEMANDE UN CHOIX. Quentin avait tranché que les
 * interactions s'énoncent et se jouent à la table ; il a fait une exception
 * pour Aphrodite, qui déplace deux pions — un déplacement ne se joue pas à
 * la table, il faut bien que l'application bouge les pions.
 *
 * Ce qui se vérifie ici est le COMPORTEMENT : ce que l'écran laisse faire,
 * ce qu'il refuse, et ce qu'il rend. L'apparence — les colonnes, les dés
 * barrés — se juge à l'œil, jsdom ne calculant aucun style.
 */

function targets(count: number): AphroditeTarget[] {
  return Array.from({ length: count }, (_, rank) => ({
    index: rank + 1,
    name: `Joueur ${rank + 1}`,
    color: '#e2483d',
    position: 5 + rank,
  }));
}

/** Les dés d'une colonne donnée, dans l'ordre du jet. */
function dice(row: number, direction: 'forward' | 'backward'): HTMLButtonElement[] {
  return [
    ...document.querySelectorAll<HTMLButtonElement>(
      `.aphrodite-die[data-row="${row}"][data-direction="${direction}"]`
    ),
  ];
}

function validateButton(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>('#aphrodite-validate')!;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('Aphrodite — l\'écran propose les adversaires', () => {
  it('ouvre une ligne par pion à déplacer', () => {
    showAphroditeScreen([3, 5], targets(3), 22, () => {});

    expect(document.querySelectorAll('.aphrodite-row')).toHaveLength(2);
  });

  it('propose TOUS les adversaires dans chaque liste', () => {
    // Le joueur doit pouvoir désigner qui il veut, pas seulement les deux
    // premiers de la partie.
    showAphroditeScreen([3, 5], targets(4), 22, () => {});

    // `:first-of-type` désignerait le premier <select> de son PARENT, et
    // chaque liste est seule dans sa ligne : on prend donc la première
    // liste de l'écran.
    const first = document.querySelector('.aphrodite-who')!;

    expect(first.querySelectorAll('option')).toHaveLength(4);
  });

  it('dit où chacun se trouve, pour choisir en connaissance de cause', () => {
    showAphroditeScreen([3, 5], targets(2), 22, () => {});

    expect(document.querySelector('.aphrodite-who option')!.textContent).toContain('case');
  });

  it('n\'ouvre QU\'UNE ligne dans une partie à deux joueurs', () => {
    // LE CAS QUI BLOQUERAIT LA PARTIE : la faveur demande deux adversaires,
    // il n'y en a qu'un. Quentin a tranché — il reçoit les deux dés.
    // Sans cette borne, « Valider » resterait refusé à jamais.
    showAphroditeScreen([3, 5], targets(1), 22, () => {});

    expect(document.querySelectorAll('.aphrodite-row')).toHaveLength(1);
  });
});

describe('Aphrodite — un dé ne sert qu\'une fois', () => {
  it('barre le dé déjà pris sur l\'autre ligne', () => {
    // C'est ce que le croquis de Quentin montre : le dé pris d'un côté se
    // barre de l'autre. La contrainte se VOIT au lieu d'être un refus après
    // coup.
    showAphroditeScreen([3, 5], targets(3), 22, () => {});

    dice(0, 'forward')[0].click();

    expect(dice(1, 'backward')[0].disabled).toBe(true);
    expect(dice(1, 'backward')[1].disabled).toBe(false);
  });

  it('libère le dé quand on revient sur son choix', () => {
    // Un joueur qui s'est trompé de colonne doit pouvoir se reprendre sans
    // rouvrir l'écran.
    showAphroditeScreen([3, 5], targets(3), 22, () => {});

    dice(0, 'forward')[0].click();
    dice(0, 'forward')[0].click();

    expect(dice(1, 'backward')[0].disabled).toBe(false);
  });
});

describe('Aphrodite — un part en avant, l\'autre en arrière', () => {
  it('ferme la colonne déjà prise par l\'autre ligne', () => {
    // RÈGLE TRANCHÉE PAR QUENTIN : ce sont les colonnes « + » et « − » qui
    // portent la direction, et chacune reçoit un dé.
    showAphroditeScreen([3, 5], targets(3), 22, () => {});

    dice(0, 'forward')[0].click();

    expect(dice(1, 'forward')[1].disabled).toBe(true);
    expect(dice(1, 'backward')[1].disabled).toBe(false);
  });

  it('laisse les DEUX sens ouverts quand un seul pion part', () => {
    // À deux joueurs, lui imposer deux directions à la fois n'aurait aucun
    // sens.
    showAphroditeScreen([3, 5], targets(1), 22, () => {});

    expect(dice(0, 'forward')[0].disabled).toBe(false);
    expect(dice(0, 'backward')[0].disabled).toBe(false);
  });
});

describe('Aphrodite — « Valider » attend des choix qui tiennent debout', () => {
  it('reste hors d\'atteinte au départ', () => {
    showAphroditeScreen([3, 5], targets(3), 22, () => {});

    expect(validateButton().disabled).toBe(true);
  });

  it('reste hors d\'atteinte avec un seul choix fait', () => {
    showAphroditeScreen([3, 5], targets(3), 22, () => {});

    dice(0, 'forward')[0].click();

    expect(validateButton().disabled).toBe(true);
  });

  it('s\'ouvre quand tout est décidé', () => {
    showAphroditeScreen([3, 5], targets(3), 22, () => {});

    dice(0, 'forward')[0].click();
    dice(1, 'backward')[1].click();

    expect(validateButton().disabled).toBe(false);
  });

  it('refuse DEUX FOIS LE MÊME adversaire', () => {
    // Les listes déroulantes le permettent : rien n'empêche de désigner
    // Joueur 1 sur les deux lignes. Déplacer deux fois le même pion avec
    // deux dés n'est pas la règle — « associez 1 dé à chacun ».
    showAphroditeScreen([3, 5], targets(3), 22, () => {});

    const lists = document.querySelectorAll<HTMLSelectElement>('.aphrodite-who');
    lists[1].value = lists[0].value;
    lists[1].dispatchEvent(new Event('change'));

    dice(0, 'forward')[0].click();
    dice(1, 'backward')[1].click();

    expect(validateButton().disabled).toBe(true);
  });
});

describe('Aphrodite — ce qui part dans la partie', () => {
  it('rend les déplacements, bornes du plateau comprises', () => {
    const done = vi.fn();
    // Joueur 1 en case 5, Joueur 2 en case 6.
    showAphroditeScreen([3, 5], targets(3), 22, done);

    dice(0, 'forward')[0].click(); // Joueur 1 : +3 → case 8
    dice(1, 'backward')[1].click(); // Joueur 2 : −5 → case 1

    validateButton().click();

    expect(done).toHaveBeenCalledWith([
      { player: 1, from: 5, to: 8, dice: 3, direction: 'forward' },
      { player: 2, from: 6, to: 1, dice: 5, direction: 'backward' },
    ]);
  });

  it('suit l\'adversaire choisi dans la liste, et non le rang de la ligne', () => {
    // SANS CELA on déplacerait le mauvais pion : c'est la position du joueur
    // DÉSIGNÉ qui compte, pas celle du premier de la liste.
    const done = vi.fn();
    showAphroditeScreen([2, 4], targets(3), 22, done);

    const lists = document.querySelectorAll<HTMLSelectElement>('.aphrodite-who');
    lists[0].value = '3'; // Joueur 3, en case 7
    lists[0].dispatchEvent(new Event('change'));

    dice(0, 'forward')[0].click();
    dice(1, 'backward')[1].click();

    validateButton().click();

    expect(done.mock.calls[0][0][0]).toMatchObject({ player: 3, from: 7, to: 9 });
  });

  it('ne rend la main qu\'à la validation', () => {
    const done = vi.fn();
    showAphroditeScreen([3, 5], targets(3), 22, done);

    dice(0, 'forward')[0].click();
    dice(1, 'backward')[1].click();

    expect(done).not.toHaveBeenCalled();
  });

  it('ne valide pas deux fois', () => {
    // Un double tap ne doit pas déplacer les pions deux fois.
    const done = vi.fn();
    showAphroditeScreen([3, 5], targets(3), 22, done);

    dice(0, 'forward')[0].click();
    dice(1, 'backward')[1].click();

    const button = validateButton();
    button.click();
    button.click();

    expect(done).toHaveBeenCalledTimes(1);
  });

  it('retire l\'écran une fois validé', () => {
    // SANS CELA il resterait par-dessus le plateau : il est en
    // `position: fixed` sur toute la surface.
    showAphroditeScreen([3, 5], targets(3), 22, () => {});

    dice(0, 'forward')[0].click();
    dice(1, 'backward')[1].click();
    validateButton().click();

    expect(document.querySelector('.aphrodite-screen')).toBeNull();
  });
});

describe('Aphrodite — on peut aller voir le plateau', () => {
  it('escamote sans rien décider', () => {
    const done = vi.fn();
    showAphroditeScreen([3, 5], targets(3), 22, done);

    document.querySelector<HTMLButtonElement>('#aphrodite-peek')!.click();

    const screen = document.querySelector<HTMLElement>('.aphrodite-screen')!;

    // `hidden` seul ne suffit pas : `.setup-screen` pose `display: flex`,
    // qui l'emporte. C'est le défaut vu sur l'APK, qui se reproduirait ici.
    expect(screen.hidden && screen.style.display === 'none').toBe(true);
    expect(done).not.toHaveBeenCalled();
  });

  it('laisse un rappel, et ramène l\'écran', () => {
    showAphroditeScreen([3, 5], targets(3), 22, () => {});

    document.querySelector<HTMLButtonElement>('#aphrodite-peek')!.click();
    document.querySelector<HTMLButtonElement>('#aphrodite-recall')!.click();

    const screen = document.querySelector<HTMLElement>('.aphrodite-screen')!;
    expect(screen.hidden).toBe(false);
  });

  it('garde les choix déjà faits', () => {
    // Aller voir le plateau sert justement à décider : revenir en ayant tout
    // perdu rendrait le bouton inutile.
    showAphroditeScreen([3, 5], targets(3), 22, () => {});

    dice(0, 'forward')[0].click();

    document.querySelector<HTMLButtonElement>('#aphrodite-peek')!.click();
    document.querySelector<HTMLButtonElement>('#aphrodite-recall')!.click();

    expect(dice(0, 'forward')[0].getAttribute('aria-pressed')).toBe('true');
  });
});
