import { describe, it, expect, beforeEach, vi } from 'vitest';
import { showHermesScreen, type HermesTarget } from '@/features/board/scene3d/hermes-screen';

/**
 * L'écran d'HERMÈS, tel que le croquis de Quentin le montre : le dieu, la
 * règle, deux boutons de sens, puis la liste des adversaires.
 *
 * IL DEMANDE UN CHOIX, comme Aphrodite : la faveur DÉPLACE un pion, et un
 * déplacement ne se joue pas à la table. Poséidon, qui ne fait que servir
 * des gorgées, reste un rappel.
 */

const TARGETS: HermesTarget[] = [
  { index: 1, name: 'Bastien', position: 8 },
  { index: 2, name: 'Chloé', position: 14 },
];

/** Ouvre l'écran pour le joueur 0, case 3. */
function open(onDone: (move: unknown) => void = () => {}): void {
  showHermesScreen(0, 3, TARGETS, onDone as never);
}

const button = (id: string): HTMLButtonElement =>
  document.querySelector<HTMLButtonElement>(`#${id}`)!;

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('Hermès — l\'écran dit la règle', () => {
  it('s\'affiche', () => {
    open();

    expect(document.querySelector('.hermes-screen')).not.toBeNull();
  });

  it('porte le nom du dieu', () => {
    open();

    expect(document.querySelector('.hermes-panel h2')!.textContent).toContain('HERMÈS');
  });

  it('énonce la règle en une ligne', () => {
    // Le texte de référence dit le choix ET l'effet de la case ; les deux
    // boutons montrent déjà le choix. Le répéter en entier fait lire deux
    // fois la même chose — défaut SCH-11 relevé par Bastien.
    open();

    const line = document.querySelector('.hermes-panel .action-modal-line')!;

    expect(line.textContent!.length).toBeLessThan(90);
  });

  it('dit que c\'est le pion DÉPLACÉ qui applique la case', () => {
    // DÉCISION DE QUENTIN : « ça applique l'effet de la case, pour le joueur
    // qui se déplace ». Les deux pions finissent sur la même case, mais un
    // seul rejoue — c'est la seule chose que le croquis ne montre pas.
    open();

    const line = document.querySelector('.hermes-panel .action-modal-line')!.textContent!;

    expect(line).toMatch(/déplacé/i);
    expect(line).toMatch(/case/i);
  });
});

describe('Hermès — les deux sens du croquis', () => {
  it('propose « Me déplacer » et « Ramener »', () => {
    open();

    const labels = [...document.querySelectorAll('.hermes-direction')].map(b => b.textContent);

    expect(labels).toEqual(['Me déplacer', 'Ramener']);
  });

  it('n\'en a AUCUN de choisi à l\'ouverture', () => {
    // Le joueur doit trancher : pré-cocher un sens ferait valider un choix
    // qu'il n'a pas fait, et Hermès déplace un pion pour de bon.
    open();

    const chosen = document.querySelectorAll('.hermes-direction.is-chosen');

    expect(chosen).toHaveLength(0);
  });

  it('marque celui qu\'on a pris', () => {
    open();

    button('hermes-bring').click();

    expect(button('hermes-bring').classList.contains('is-chosen')).toBe(true);
    expect(button('hermes-move').classList.contains('is-chosen')).toBe(false);
  });

  it('change d\'avis sans rouvrir l\'écran', () => {
    open();

    button('hermes-move').click();
    button('hermes-bring').click();

    expect(button('hermes-move').classList.contains('is-chosen')).toBe(false);
    expect(button('hermes-bring').classList.contains('is-chosen')).toBe(true);
  });

  it('reprend le sens si on reclique dessus', () => {
    open();

    button('hermes-move').click();
    button('hermes-move').click();

    expect(button('hermes-move').classList.contains('is-chosen')).toBe(false);
    expect(button('hermes-validate').disabled).toBe(true);
  });
});

describe('Hermès — la liste ne s\'ouvre qu\'avec un sens', () => {
  it('reste VRAIMENT escamotée à l\'ouverture', () => {
    // `hidden` seul ne suffit pas : ce défaut a été vu DEUX FOIS sur l'APK.
    // Une liste visible sans sens choisi demanderait « qui » sans dire
    // « pour quoi faire ».
    open();

    const box = document.querySelector<HTMLElement>('.hermes-pick')!;

    expect(box.hidden && box.style.display === 'none').toBe(true);
  });

  it('apparaît une fois le sens pris', () => {
    open();

    button('hermes-move').click();

    const box = document.querySelector<HTMLElement>('.hermes-pick')!;

    expect(box.hidden).toBe(false);
    expect(box.style.display).not.toBe('none');
  });

  it('dit ce qu\'elle demande, selon le sens', () => {
    // « Sur la case de qui » et « ramener qui sur la mienne » ne sont pas la
    // même question : la consigne suit le bouton.
    open();

    button('hermes-move').click();
    const moving = document.querySelector('.hermes-prompt')!.textContent;

    button('hermes-bring').click();
    const bringing = document.querySelector('.hermes-prompt')!.textContent;

    expect(moving).not.toBe(bringing);
  });

  it('liste tous les adversaires, avec leur case', () => {
    open();

    button('hermes-move').click();

    const options = [...document.querySelectorAll('#hermes-who option')];

    expect(options).toHaveLength(2);
    expect(options[0].textContent).toContain('Bastien');
    expect(options[0].textContent).toContain('9');
  });
});

describe('Hermès — le bouton hors d\'atteinte se VOIT', () => {
  it('range « Valider » parmi les boutons que la feuille grise', () => {
    // VU EN IMAGE, et invisible au DOM : « Valider » s'affichait en or plein
    // alors qu'il était `disabled`. Le joueur appuyait, rien ne se passait.
    // La règle qui le grise vise `.aphrodite-panel` et `.hermes-panel` —
    // l'écran doit donc porter CETTE classe, et son bouton `.btn-primary`.
    open();

    const validate = button('hermes-validate');

    expect(validate.closest('.hermes-panel')).not.toBeNull();
    expect(validate.classList.contains('btn-primary')).toBe(true);
    expect(validate.disabled).toBe(true);
  });
});

describe('Hermès — ce qu\'il rend', () => {
  it('ne rend RIEN tant qu\'aucun sens n\'est pris', () => {
    const done = vi.fn();
    open(done);

    expect(button('hermes-validate').disabled).toBe(true);

    button('hermes-validate').click();

    expect(done).not.toHaveBeenCalled();
  });

  it('« Me déplacer » envoie MON pion sur SA case', () => {
    const done = vi.fn();
    open(done);

    button('hermes-move').click();
    button('hermes-validate').click();

    expect(done).toHaveBeenCalledWith({ player: 0, from: 3, to: 8 });
  });

  it('« Ramener » tire SON pion sur MA case', () => {
    const done = vi.fn();
    open(done);

    button('hermes-bring').click();
    button('hermes-validate').click();

    expect(done).toHaveBeenCalledWith({ player: 1, from: 8, to: 3 });
  });

  it('suit l\'adversaire choisi dans la liste', () => {
    const done = vi.fn();
    open(done);

    button('hermes-move').click();

    const who = document.querySelector<HTMLSelectElement>('#hermes-who')!;
    who.value = '2';
    who.dispatchEvent(new Event('change'));

    button('hermes-validate').click();

    expect(done).toHaveBeenCalledWith({ player: 0, from: 3, to: 14 });
  });

  it('se retire une fois validé', () => {
    // SANS CELA il resterait par-dessus le plateau : il est en
    // `position: fixed` sur toute la surface.
    open();

    button('hermes-move').click();
    button('hermes-validate').click();

    expect(document.querySelector('.hermes-screen')).toBeNull();
    expect(document.querySelector('#hermes-recall')).toBeNull();
  });

  it('ne valide pas deux fois', () => {
    const done = vi.fn();
    open(done);

    button('hermes-move').click();
    const validate = button('hermes-validate');
    validate.click();
    validate.click();

    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe('Hermès — on peut aller voir le plateau', () => {
  it('escamote VRAIMENT, et pas seulement dans le DOM', () => {
    const done = vi.fn();
    open(done);

    button('hermes-peek').click();

    const screen = document.querySelector<HTMLElement>('.hermes-screen')!;

    expect(screen.hidden && screen.style.display === 'none').toBe(true);
    expect(done).not.toHaveBeenCalled();
  });

  it('laisse un rappel, et ramène l\'écran', () => {
    open();

    button('hermes-peek').click();

    const recall = document.querySelector<HTMLElement>('#hermes-recall')!;
    expect(recall.hidden).toBe(false);

    recall.click();

    expect(document.querySelector<HTMLElement>('.hermes-screen')!.hidden).toBe(false);
  });

  it('garde le choix en cours pendant le coup d\'œil', () => {
    // Aller voir le plateau ne doit RIEN annuler : c'est précisément pour
    // décider qu'on va regarder où sont les pions.
    const done = vi.fn();
    open(done);

    button('hermes-bring').click();
    button('hermes-peek').click();
    document.querySelector<HTMLElement>('#hermes-recall')!.click();

    expect(button('hermes-bring').classList.contains('is-chosen')).toBe(true);

    button('hermes-validate').click();

    expect(done).toHaveBeenCalledWith({ player: 1, from: 8, to: 3 });
  });
});
