import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  showPoseidonScreen,
  poseidonDice,
  POSEIDON_SUM,
} from '@/features/board/scene3d/poseidon-screen';
import { GOD_FAVORS } from '@/features/game/god-favors';

/**
 * L'écran de POSÉIDON : un RAPPEL, pas un arbitrage.
 *
 * Quentin : « pas besoin de sélectionner les joueurs, c'est un rappel ».
 * L'écran énonce la règle et montre les dés ; la table désigne la cible et
 * compte les gorgées. C'est la ligne du 19/09, dont Aphrodite était
 * l'exception parce qu'elle DÉPLACE des pions.
 *
 * Ce qui se vérifie ici est donc surtout ce que l'écran NE FAIT PAS.
 */

/** Les dés affichés, avec leur rôle. */
function dice(): { face: string; role: string }[] {
  return [...document.querySelectorAll<HTMLElement>('.poseidon-die')].map(die => ({
    face: die.textContent ?? '',
    role: die.dataset.role ?? '',
  }));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('Poséidon — le fort et le faible', () => {
  it('range les deux faces', () => {
    expect(poseidonDice(2, 5)).toEqual({ high: 5, low: 2 });
    expect(poseidonDice(5, 2)).toEqual({ high: 5, low: 2 });
  });

  it('désigne bien POSÉIDON sur la table du plateau', () => {
    expect(GOD_FAVORS[POSEIDON_SUM].name).toBe('POSÉIDON');
  });
});

describe('Poséidon — l\'écran dit la règle', () => {
  it('s\'affiche', () => {
    showPoseidonScreen([2, 5], () => {});

    expect(document.querySelector('.poseidon-screen')).not.toBeNull();
  });

  it('porte le nom du dieu', () => {
    showPoseidonScreen([2, 5], () => {});

    expect(document.querySelector('.poseidon-panel h2')!.textContent).toContain('POSÉIDON');
  });

  it('énonce la règle, et pas un résumé maison', () => {
    // Le texte vient de `god-favors`, PARTAGÉ avec le rendu de `main` : deux
    // rédactions de la même faveur finiraient par diverger.
    showPoseidonScreen([2, 5], () => {});

    const line = document.querySelector('.poseidon-panel .action-modal-line')!;

    expect(line.textContent).toContain('le plus élevé');
    expect(line.textContent).toContain('voisins');
  });

  it('écrit les gorgées avec le symbole (SCH-12)', () => {
    showPoseidonScreen([2, 5], () => {});

    const line = document.querySelector('.poseidon-panel .action-modal-line')!;

    expect(line.textContent).toContain('\u{1F37A}');
    expect(line.textContent).not.toMatch(/gorgées?/i);
  });
});

describe('Poséidon — le trident montre qui prend quoi', () => {
  it('pose le dé FORT au sommet, pour la cible', () => {
    // C'EST LE SENS DE LA RÈGLE : « il reçoit autant de gorgées que le dé le
    // plus élevé ». Inverser les deux montrerait la règle à l'envers.
    showPoseidonScreen([2, 5], () => {});

    const target = dice().filter(die => die.role === 'target');

    expect(target).toHaveLength(1);
    expect(target[0].face).toBe('5');
  });

  it('pose le dé FAIBLE sur les deux branches, pour les voisins', () => {
    showPoseidonScreen([2, 5], () => {});

    const neighbors = dice().filter(die => die.role === 'neighbor');

    expect(neighbors).toHaveLength(2);
    expect(neighbors.every(die => die.face === '2')).toBe(true);
  });

  it('montre le même dé faible des deux côtés', () => {
    // Les deux voisins reçoivent CHACUN le score du dé le plus faible : ce
    // n'est pas un partage, c'est la même valeur deux fois.
    showPoseidonScreen([1, 6], () => {});

    const neighbors = dice().filter(die => die.role === 'neighbor');

    expect(neighbors.map(die => die.face)).toEqual(['1', '1']);
  });

  it('dit qui est qui, en toutes lettres', () => {
    // L'illustration seule ne dit pas lequel est le voisin de gauche.
    showPoseidonScreen([2, 5], () => {});

    const labels = [...document.querySelectorAll('.poseidon-who')].map(e => e.textContent);

    expect(labels).toEqual(['La cible', 'Voisin de gauche', 'Voisin de droite']);
  });

  it('tient bon quand les deux faces sont égales', () => {
    // Un double est la Colère des dieux et n'amène jamais Poséidon, mais
    // l'écran ne doit pas produire d'absurdité si on le force.
    showPoseidonScreen([4, 4], () => {});

    expect(dice().map(die => die.face)).toEqual(['4', '4', '4']);
  });
});

describe('Poséidon — il n\'arbitre RIEN', () => {
  it('ne propose AUCUNE sélection de joueur', () => {
    // Quentin : « pas besoin de sélectionner les joueurs, c'est un rappel ».
    // Ce test garde cette décision — il échouera si on ajoute un jour une
    // liste déroulante ou des boutons de joueur.
    showPoseidonScreen([2, 5], () => {});

    expect(document.querySelectorAll('.poseidon-screen select')).toHaveLength(0);

    const buttons = [...document.querySelectorAll('.poseidon-screen button')];

    expect(buttons.map(b => b.textContent)).toEqual(['Voir le plateau', 'Valider']);
  });
});

describe('Poséidon — le jeu attend la table', () => {
  it('ne rend la main QU\'AU clic sur Valider', () => {
    const done = vi.fn();
    showPoseidonScreen([2, 5], done);

    expect(done).not.toHaveBeenCalled();

    document.querySelector<HTMLButtonElement>('#poseidon-validate')!.click();

    expect(done).toHaveBeenCalledTimes(1);
  });

  it('se retire une fois validé', () => {
    // SANS CELA il resterait par-dessus le plateau : il est en
    // `position: fixed` sur toute la surface.
    showPoseidonScreen([2, 5], () => {});

    document.querySelector<HTMLButtonElement>('#poseidon-validate')!.click();

    expect(document.querySelector('.poseidon-screen')).toBeNull();
    expect(document.querySelector('#poseidon-recall')).toBeNull();
  });

  it('ne valide pas deux fois', () => {
    const done = vi.fn();
    showPoseidonScreen([2, 5], done);

    const button = document.querySelector<HTMLButtonElement>('#poseidon-validate')!;
    button.click();
    button.click();

    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe('Poséidon — on peut aller voir le plateau', () => {
  it('escamote VRAIMENT, et pas seulement dans le DOM', () => {
    // `hidden` seul ne suffit pas : `.setup-screen` pose `display: flex`,
    // qui l'emporte. Ce défaut a été vu DEUX FOIS sur l'APK — la modale
    // d'action, puis le bandeau de diagnostic.
    const done = vi.fn();
    showPoseidonScreen([2, 5], done);

    document.querySelector<HTMLButtonElement>('#poseidon-peek')!.click();

    const screen = document.querySelector<HTMLElement>('.poseidon-screen')!;

    expect(screen.hidden && screen.style.display === 'none').toBe(true);
    expect(done).not.toHaveBeenCalled();
  });

  it('laisse un rappel, et ramène l\'écran', () => {
    showPoseidonScreen([2, 5], () => {});

    document.querySelector<HTMLButtonElement>('#poseidon-peek')!.click();

    const recall = document.querySelector<HTMLElement>('#poseidon-recall')!;
    expect(recall.hidden).toBe(false);

    recall.click();

    expect(document.querySelector<HTMLElement>('.poseidon-screen')!.hidden).toBe(false);
  });
});
