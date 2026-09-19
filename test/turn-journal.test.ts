import { describe, it, expect, beforeEach } from 'vitest';
import { GameLogic } from '@/features/game/game.logic';
import { TurnRunner } from '@/features/board/scene3d/turn-runner';
import { describeTurn, JOURNAL_MAX } from '@/features/board/scene3d/turn-journal';

/**
 * 3D-50 — le journal de partie et le tour courant.
 *
 * Première étape du HUD, et la plus sûre : purement de l'affichage, aucune
 * règle nouvelle. `GameLogic` tient DÉJÀ un historique — `logEvent`,
 * `getHistory` — qui n'était simplement branché nulle part dans la scène.
 *
 * On n'écrit donc pas un second journal à côté du premier. Deux historiques
 * de la même partie finiraient par diverger, et c'est exactement la
 * duplication que toute la refonte supprime.
 *
 * `describeTurn` traduit un tour en une phrase lisible. C'est une fonction
 * PURE, vérifiable sans rien afficher.
 */

const LAST = 22;

let logic: GameLogic;
let runner: TurnRunner;

beforeEach(() => {
  logic = new GameLogic();
  logic.setBoardSize(LAST + 1);
  logic.startGame([
    { name: 'Alice', color: '#e2483d' },
    { name: 'Bastien', color: '#3d7fc4' },
  ]);
  runner = new TurnRunner(logic);
});

describe('3D-50 — chaque tour se raconte', () => {
  it('dit qui a joué, ce qu\'il a fait et où il arrive', () => {
    logic.setPlayerPosition(0, 3);

    const line = describeTurn(runner.playTurn(4));

    expect(line).toContain('Alice');
    expect(line).toContain('4');
    expect(line).toContain('7');
  });

  it('signale le rebond plutôt que de le taire', () => {
    // Un 5 qui finit deux cases en arrière paraît être une erreur si on ne
    // dit pas pourquoi. Le joueur compte ses cases : il faut lui expliquer.
    logic.setPlayerPosition(0, LAST - 2);

    const line = describeTurn(runner.playTurn(5));

    expect(line.toLowerCase()).toContain('rebond');
  });

  it('annonce le pouvoir du Schmitt', () => {
    logic.setPlayerPosition(0, LAST - 3);

    const line = describeTurn(runner.playTurn(3));

    expect(line.toLowerCase()).toContain('schmitt');
  });

  it('annonce la victoire', () => {
    logic.setPlayerPosition(0, 8);
    logic.claimSchmittPower(1);
    runner.playTurn(5);
    logic.nextPlayer();

    const line = describeTurn(runner.playTurn(3));

    expect(line).toContain('Alice');
    expect(line.toLowerCase()).toContain('gagne');
  });

  it('signale la flèche quand elle déplace le pion', () => {
    const line = describeTurn({
      player: 0,
      playerName: 'Alice',
      dice: 2,
      steps: 2,
      from: 1,
      to: 3,
      returning: false,
      effect: { type: 'forward_2', from: 3, to: 5 },
      schmittPower: false,
      winner: null,
    });

    expect(line.toLowerCase()).toContain('flèche');
    expect(line).toContain('5');
  });
});

describe('3D-50 — le journal vient de GameLogic', () => {
  it('reprend l\'historique de la partie, sans en tenir un second', () => {
    // GameLogic enregistre déjà les lancers. Tenir un journal parallèle
    // ferait deux récits de la même partie, qui finiraient par diverger.
    logic.rollDice();

    expect(logic.getHistory().length).toBeGreaterThan(0);
  });

  it('garde les événements les plus récents en dernier', () => {
    // L'ordre de lecture : on veut voir ce qui vient de se passer.
    logic.logEvent('premier');
    logic.logEvent('dernier');

    const history = logic.getHistory();

    expect(history[history.length - 1]).toBe('dernier');
  });

  it('borne le journal affiché', () => {
    // Un journal sans fin pousse le reste du HUD hors de l'écran, et sur un
    // téléphone en paysage la place est comptée.
    for (let i = 0; i < 80; i++) logic.logEvent(`événement ${i}`);

    const shown = logic.getHistory().slice(-JOURNAL_MAX);

    // La borne doit être CELLE DE L'AFFICHAGE, et pas celle de GameLogic qui
    // garde déjà 50 entrées. Comparer à 50 laisserait passer un journal non
    // borné : il tiendrait la limite sans rien montrer de plus court, et
    // pousserait le reste du HUD hors de l'écran.
    expect(JOURNAL_MAX).toBeLessThan(20);
    expect(shown).toHaveLength(JOURNAL_MAX);
    expect(shown[shown.length - 1]).toBe('événement 79');
  });
});

describe('3D-50 — à qui le tour', () => {
  it('nomme le joueur qui doit jouer', () => {
    expect(runner.currentPlayerName()).toBe('Alice');

    runner.playTurn(2);

    expect(runner.currentPlayerName()).toBe('Bastien');
  });

  it('distingue celui qui vient de jouer de celui qui suit', () => {
    // L'erreur facile : annoncer « au tour de X » en parlant de celui qui
    // vient d'agir. Le joueur suivant ne saurait pas que c'est à lui.
    const outcome = runner.playTurn(2);

    expect(outcome.playerName).toBe('Alice');
    expect(runner.currentPlayerName()).toBe('Bastien');
  });
});
