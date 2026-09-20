import { describe, it, expect, beforeEach } from 'vitest';
import { askForPlayers } from '@/features/board/scene3d/setup-screen';
import { PLAYER_DRAFTS_KEY, MAX_PLAYERS } from '@/features/game/player-drafts';

/**
 * L'écran qui demande qui joue.
 *
 * Ce qui se vérifie ici est le COMPORTEMENT, pas l'apparence : jsdom ne
 * calcule aucun style, et `setup-screen.css` se juge à l'œil. Ce qui casse,
 * en revanche, se teste — la partie qui démarre sans attendre la réponse,
 * des joueurs qui se perdent entre l'écran et les règles, un écran qui
 * reste affiché par-dessus le plateau.
 */

beforeEach(() => {
  document.body.innerHTML = '';
  window.localStorage.clear();
});

/** Le premier champ de nom, celui du premier joueur. */
function nameFields(): HTMLInputElement[] {
  return [...document.querySelectorAll<HTMLInputElement>('.player-input-item input[type="text"]')];
}

function click(selector: string): void {
  document.querySelector<HTMLButtonElement>(selector)!.click();
}

describe('setup — la partie attend la réponse', () => {
  it('affiche l\'écran et ne rend pas la main tout de suite', async () => {
    let started = false;
    void askForPlayers().then(() => {
      started = true;
    });

    // Laisse tourner la file de micro-tâches : si la promesse se tenait
    // toute seule, elle serait déjà résolue ici.
    await Promise.resolve();

    expect(document.querySelector('.setup-screen')).not.toBeNull();
    expect(started).toBe(false);
  });

  it('rend la main au clic sur Jouer', async () => {
    const answer = askForPlayers();

    click('#setup-start');

    const players = await answer;
    expect(players.length).toBeGreaterThanOrEqual(2);
  });

  it('retire l\'écran une fois la partie lancée', async () => {
    // SANS CELA, l'écran resterait par-dessus le plateau : il est en
    // `position: fixed` sur toute la surface, donc le jeu serait injouable
    // tout en tournant derrière.
    const answer = askForPlayers();
    click('#setup-start');
    await answer;

    expect(document.querySelector('.setup-screen')).toBeNull();
  });
});

describe('setup — le joueur compose sa tablée', () => {
  it('propose deux joueurs au départ', async () => {
    const answer = askForPlayers();

    expect(nameFields()).toHaveLength(2);

    click('#setup-start');
    await answer;
  });

  it('ajoute un joueur', async () => {
    const answer = askForPlayers();

    click('#setup-add');

    expect(nameFields()).toHaveLength(3);

    click('#setup-start');
    expect(await answer).toHaveLength(3);
  });

  it('en retire un', async () => {
    const answer = askForPlayers();

    click('#setup-add');
    click('#setup-add');
    document.querySelectorAll<HTMLButtonElement>('.remove-player-btn')[1].click();

    expect(nameFields()).toHaveLength(3);

    click('#setup-start');
    await answer;
  });

  it('interdit de descendre sous deux joueurs', async () => {
    // Le jeu fait boire les AUTRES : à un joueur, il n'a plus de sens.
    const answer = askForPlayers();

    const removers = [...document.querySelectorAll<HTMLButtonElement>('.remove-player-btn')];
    expect(removers.every(button => button.disabled)).toBe(true);

    click('#setup-start');
    await answer;
  });

  it('cesse de proposer d\'ajouter au maximum', async () => {
    const answer = askForPlayers();

    for (let i = 0; i < MAX_PLAYERS; i += 1) {
      document.querySelector<HTMLButtonElement>('#setup-add')!.click();
    }

    expect(nameFields()).toHaveLength(MAX_PLAYERS);
    expect(document.querySelector<HTMLButtonElement>('#setup-add')!.disabled).toBe(true);

    click('#setup-start');
    await answer;
  });
});

describe('setup — ce que le joueur saisit arrive dans la partie', () => {
  it('transmet les noms saisis', async () => {
    const answer = askForPlayers();

    const fields = nameFields();
    fields[0].value = 'Quentin';
    fields[0].dispatchEvent(new Event('input'));
    fields[1].value = 'Bastien';
    fields[1].dispatchEvent(new Event('input'));

    click('#setup-start');

    expect((await answer).map(p => p.name)).toEqual(['Quentin', 'Bastien']);
  });

  it('remplace un nom laissé vide', async () => {
    // Le nom sert à désigner qui boit : « distribue 3 🍺 » sans nom ne dit
    // rien à personne.
    const answer = askForPlayers();

    const fields = nameFields();
    fields[0].value = '   ';
    fields[0].dispatchEvent(new Event('input'));

    click('#setup-start');

    expect((await answer)[0].name.trim()).toBeTruthy();
  });

  it('transmet les couleurs choisies', async () => {
    const answer = askForPlayers();

    const swatch = document.querySelector<HTMLInputElement>('.color-picker')!;
    swatch.value = '#123456';
    swatch.dispatchEvent(new Event('input'));

    click('#setup-start');

    expect((await answer)[0].color).toBe('#123456');
  });
});

describe('setup — les noms survivent à la partie', () => {
  it('range ce qui a été saisi', async () => {
    const answer = askForPlayers();

    const fields = nameFields();
    fields[0].value = 'Quentin';
    fields[0].dispatchEvent(new Event('input'));

    click('#setup-start');
    await answer;

    expect(window.localStorage.getItem(PLAYER_DRAFTS_KEY)).toContain('Quentin');
  });

  it('les repropose à la partie suivante', async () => {
    // C'EST LA DEMANDE : « mémoriser d'une partie à l'autre ». On ne se
    // renomme pas à chaque manche, surtout à six autour d'une table.
    const first = askForPlayers();
    const fields = nameFields();
    fields[0].value = 'Quentin';
    fields[0].dispatchEvent(new Event('input'));
    click('#setup-start');
    await first;

    const second = askForPlayers();

    expect(nameFields()[0].value).toBe('Quentin');

    click('#setup-start');
    await second;
  });
});
