import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Link } from '@/features/link/link';
import { pairedInMemory } from '@/features/link/transport';
import { MasterRemote, showRemote, type RemoteSummary } from '@/features/link/remote';
import { showActionModal } from '@/features/board/scene3d/action-modal';
import { showHermesScreen } from '@/features/board/scene3d/hermes-screen';

/**
 * LE TÉLÉPHONE COMMANDE, LE PLATEAU JOUE (épique 8, SCH-32 / SCH-33).
 *
 * Les deux côtés sont branchés par la paire en mémoire : c'est la vraie
 * liaison, sans le réseau.
 */

const SUMMARY: Omit<RemoteSummary, 'prompt'> = {
  turn: 'Bastien',
  players: [
    { name: 'Quentin', position: 0, color: '#ff0000' },
    { name: 'Bastien', position: 4, color: '#0000ff' },
  ],
  log: [],
  awaitingFavor: false,
};

let wire: ReturnType<typeof pairedInMemory>;
let master: MasterRemote;
let rolls: number;
let summary: Omit<RemoteSummary, 'prompt'>;
let close: () => void;

const el = (id: string) => document.getElementById(id)!;
const press = () => (el('remote-roll') as HTMLButtonElement).click();

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
  wire = pairedInMemory();
  rolls = 0;
  summary = structuredClone(SUMMARY);

  master = new MasterRemote(() => summary);
  master.roll = () => rolls++;
  master.attach(new Link('master', wire.a));
  close = showRemote(new Link('slave', wire.b));
  wire.restore();
});

afterEach(() => {
  close();
  vi.useRealTimers();
});

describe('Le bouton du téléphone lance le dé du plateau', () => {
  it('appuie sur le même bouton que le plateau', () => {
    press();

    expect(rolls).toBe(1);
  });

  it('affiche la face TIRÉE PAR LE PLATEAU, jamais une à lui', () => {
    press();
    expect(el('remote-face').textContent).toBe('…');

    master.rolled(5);

    expect(el('remote-face').textContent).toBe('5');
  });

  it('se grise le temps du lancer, puis se rend', () => {
    // Deux appuis rapides feraient deux demandes pour un seul tour.
    press();
    expect((el('remote-roll') as HTMLButtonElement).disabled).toBe(true);

    master.rolled(2);

    expect((el('remote-roll') as HTMLButtonElement).disabled).toBe(false);
  });

  it('se rend même si le plateau refuse en silence', () => {
    // Une fenêtre attend un choix sur le plateau : le lancer est ignoré.
    master.roll = () => {};
    press();

    vi.advanceTimersByTime(8000);

    expect((el('remote-roll') as HTMLButtonElement).disabled).toBe(false);
    expect(el('remote-face').textContent).toBe('–');
  });

  it('dit que la liaison est perdue au lieu de partir dans le vide', () => {
    wire.cut();
    press();

    expect(rolls).toBe(0);
    expect(el('remote-status').dataset.state).toBe('lost');
    expect((el('remote-roll') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('Le téléphone voit la partie', () => {
  it('reçoit le tour et les pions dès la liaison', () => {
    expect(el('remote-turn').textContent).toBe('Au tour de Bastien');
    expect(el('remote-players').textContent).toContain('Bastien — case 5');
  });

  it('suit chaque changement publié par le plateau', () => {
    summary.turn = 'Quentin';
    master.publish();

    expect(el('remote-turn').textContent).toBe('Au tour de Quentin');
  });

  it('propose les deux dés quand la faveur les attend', () => {
    summary.awaitingFavor = true;
    master.publish();

    expect(el('remote-roll').textContent).toBe('Lancer les 2 dés');
  });

  it('affiche les deux faces de la faveur', () => {
    master.favorRolled(3, 4);

    expect(el('remote-face').textContent).toBe('3 + 4');
  });
});

describe('Les messages arrivent aussi sur le téléphone', () => {
  // Quentin (27/10/2026) : « notifications partout : plateau ET esclave ».
  it('affiche le plus récent en premier', () => {
    master.notice('Quentin boit 2 gorgées');
    master.notice('Zeus frappe !');

    const items = [...el('remote-log').querySelectorAll('li')].map((li) => li.textContent);
    expect(items).toEqual(['Zeus frappe !', 'Quentin boit 2 gorgées']);
  });

  it('n\'en garde que six', () => {
    for (let n = 1; n <= 9; n++) master.notice(`message ${n}`);

    expect(el('remote-log').querySelectorAll('li')).toHaveLength(6);
  });
});

describe('Sans téléphone, le plateau joue comme avant', () => {
  it('n\'échoue sur aucun appel avant toute liaison', () => {
    const alone = new MasterRemote(() => SUMMARY);

    expect(() => {
      alone.publish();
      alone.rolled(4);
      alone.favorRolled(1, 2);
      alone.notice('rien');
    }).not.toThrow();
  });
});

describe('Le téléphone valide les fenêtres du plateau', () => {
  // Quentin (27/10/2026) : « valider / confirmer les notifications, pas
  // juste les recevoir ». Les fenêtres sont les vraies fenêtres du jeu.
  const STEP = { title: 'Case Poulet', tile: null, lines: ['Tu deviens le Petit Poulet.'] };
  const settle = () => vi.advanceTimersByTimeAsync(0);
  const shown = (id: string) => el(id).style.display !== 'none';

  beforeEach(() => master.watch(document.body));

  it('affiche la fenêtre ouverte sur le plateau', async () => {
    showActionModal(STEP, () => {});
    await settle();

    expect(shown('remote-prompt')).toBe(true);
    expect(el('remote-prompt-title').textContent).toBe('Case Poulet');
    expect(el('remote-validate').textContent).toBe('Valider');
  });

  it('la valide sur le plateau d\'un appui sur le téléphone', async () => {
    const onValidate = vi.fn();
    showActionModal(STEP, onValidate);
    await settle();

    el('remote-validate').click();
    await settle();

    expect(onValidate).toHaveBeenCalledOnce();
    expect(document.getElementById('action-modal')).toBeNull();
    expect(shown('remote-prompt')).toBe(false);
  });

  it('grise « Lancer » tant qu\'une fenêtre attend, puis le rend', async () => {
    // Le plateau refuse de lancer pendant une fenêtre : un appui sans
    // réponse laisserait croire à une panne.
    showActionModal(STEP, () => {});
    await settle();
    expect((el('remote-roll') as HTMLButtonElement).disabled).toBe(true);

    el('remote-validate').click();
    await settle();

    expect((el('remote-roll') as HTMLButtonElement).disabled).toBe(false);
  });

  it('montre un choix d\'Hermès sans bouton : il se fait sur le plateau', async () => {
    showHermesScreen(0, 3, [{ index: 1, name: 'Quentin', position: 8 }], () => {});
    await settle();

    expect(shown('remote-prompt')).toBe(true);
    expect(shown('remote-validate')).toBe(false);
    expect(shown('remote-prompt-note')).toBe(true);
  });
});
