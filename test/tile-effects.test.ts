import { describe, it, expect, beforeEach } from 'vitest';
import { GameLogic } from '@/features/game/game.logic';
import { TurnRunner } from '@/features/board/scene3d/turn-runner';
import type { TileConfig } from '@/core/models/Tile';

/**
 * 3D-47 — les effets de case qui DÉPLACENT le pion.
 *
 * Traités avant ceux qui font boire, parce qu'ils touchent la chaîne que #46
 * vient de valider : ce sont les seuls qui peuvent rouvrir le défaut
 * « la face vue ne correspond pas au déplacement ».
 *
 * Trois effets, et rien d'autre :
 *   - les cases flèche, dans le sens propre à la case (#10)
 *   - la dernière case, qui donne le pouvoir du Schmitt et fait faire demi-tour
 *   - le retour sur START, qui gagne la partie
 *
 * Le garde-fou de #46 ne bouge pas : la scène demande à `GameLogic` ce qui
 * arrive au pion, elle ne recalcule rien. Aucune règle n'est écrite ici.
 */

const LAST = 22;

let logic: GameLogic;
let runner: TurnRunner;

/** Un plateau où l'on choisit quelles cases portent quel effet. */
function boardWith(overrides: Record<number, Partial<TileConfig>>): TileConfig[] {
  return Array.from({ length: LAST + 1 }, (_, index) => ({
    type: 'drink_2',
    ...(overrides[index] ?? {}),
  })) as TileConfig[];
}

beforeEach(() => {
  logic = new GameLogic();
  logic.setBoardSize(LAST + 1);
  logic.startGame([
    { name: 'Alice', color: '#e2483d' },
    { name: 'Bastien', color: '#3d7fc4' },
  ]);
  runner = new TurnRunner(logic);
});

describe('3D-47 — les cases flèche (#10)', () => {
  it('pousse vers l\'avant quand la case le dit', () => {
    runner.setBoard(boardWith({ 3: { type: 'forward_2', direction: 'forward' } }));
    logic.setPlayerPosition(0, 1);

    const outcome = runner.playTurn(2);

    // 1 + 2 = 3, la case flèche pousse ensuite de 2 : on finit à 5.
    expect(outcome.to).toBe(3);
    expect(outcome.effect?.to).toBe(5);
  });

  it('pousse vers l\'avant AUSSI en phase de retour', () => {
    // Le cas de Bastien, et le seul défaut de flèche qu'on ait connu. La
    // flèche est DESSINÉE sur le plateau : elle envoie toujours du même côté,
    // quel que soit le sens de marche du joueur. Passer par `movePlayer`
    // inversait son effet au retour.
    runner.setBoard(boardWith({ 8: { type: 'forward_2', direction: 'forward' } }));
    logic.claimSchmittPower(1);
    logic.setPlayerPosition(0, 10);

    const outcome = runner.playTurn(2);

    expect(outcome.to).toBe(8);
    // Au retour on recule, mais la flèche pousse quand même vers l'avant.
    expect(outcome.effect?.to).toBe(10);
  });

  it('envoie vers START quand la flèche recule', () => {
    runner.setBoard(boardWith({ 6: { type: 'forward_2', direction: 'backward' } }));
    logic.setPlayerPosition(0, 4);

    const outcome = runner.playTurn(2);

    expect(outcome.effect?.to).toBe(4);
  });

  it('ne fait pas rebondir sur la dernière case', () => {
    // Une flèche pousse jusqu'au bord et s'arrête : elle ne rebondit pas
    // comme un jet de dé trop grand.
    runner.setBoard(boardWith({ [LAST - 1]: { type: 'forward_2', direction: 'forward' } }));
    logic.setPlayerPosition(0, LAST - 3);

    const outcome = runner.playTurn(2);

    expect(outcome.effect?.to).toBe(LAST);
  });

  it('ne déclenche rien sur une case ordinaire', () => {
    runner.setBoard(boardWith({}));
    logic.setPlayerPosition(0, 4);

    const outcome = runner.playTurn(2);

    expect(outcome.effect).toBeNull();
    expect(outcome.to).toBe(6);
  });

  it('ne s\'enchaîne pas indéfiniment', () => {
    // Deux flèches qui se pointent l'une l'autre boucleraient sans fin. La
    // scène doit s'arrêter — même si la règle du nombre d'enchaînements
    // reste à trancher par Quentin, une boucle infinie n'est jamais la
    // bonne réponse.
    runner.setBoard(
      boardWith({
        4: { type: 'forward_2', direction: 'forward' },
        6: { type: 'forward_2', direction: 'backward' },
      })
    );
    logic.setPlayerPosition(0, 2);

    expect(() => runner.playTurn(2)).not.toThrow();
  });
});

describe('3D-47 — la dernière case donne le pouvoir du Schmitt', () => {
  it('déclenche le demi-tour en arrivant sur la dernière case', () => {
    runner.setBoard(boardWith({}));
    logic.setPlayerPosition(0, LAST - 3);

    const outcome = runner.playTurn(3);

    expect(outcome.to).toBe(LAST);
    expect(outcome.schmittPower).toBe(true);
    expect(logic.getPlayers()[0].hasSchmittPower).toBe(true);
  });

  it('fait faire demi-tour à TOUT LE MONDE', () => {
    runner.setBoard(boardWith({}));
    logic.setPlayerPosition(0, LAST - 2);

    runner.playTurn(2);

    for (const player of logic.getPlayers()) {
      expect(player.isReturning).toBe(true);
    }
  });

  it('ne donne le pouvoir qu\'une seule fois', () => {
    // Son porteur est le seul de toute l'odyssée.
    runner.setBoard(boardWith({}));
    logic.setPlayerPosition(0, LAST - 1);
    runner.playTurn(1);

    logic.setPlayerPosition(1, LAST - 1);
    const second = runner.playTurn(1);

    expect(second.schmittPower).toBe(false);
  });

  it('ne déclenche rien avant la dernière case', () => {
    runner.setBoard(boardWith({}));
    logic.setPlayerPosition(0, LAST - 5);

    const outcome = runner.playTurn(2);

    expect(outcome.schmittPower).toBe(false);
  });
});

describe('3D-47 — revenir sur START gagne la partie', () => {
  it('déclare vainqueur celui qui revient exactement sur START', () => {
    runner.setBoard(boardWith({}));
    logic.setPlayerPosition(0, 8);
    logic.claimSchmittPower(1);

    // On revient en JOUANT, et non en posant la position : un joueur encore
    // sur START au moment du demi-tour gagnerait instantanément, d'où la
    // condition « avoir quitté START pendant le retour ». `setPlayerPosition`
    // est un poseur brut qui ne la renseigne pas — s'en servir pour amener le
    // pion produirait un test qui ne décrit aucune partie réelle.
    runner.playTurn(5); // 8 → 3
    logic.nextPlayer(); // on redonne la main à Alice

    const outcome = runner.playTurn(3);

    expect(outcome.to).toBe(0);
    expect(outcome.winner).toBe('Alice');
  });

  it('ne gagne pas en atteignant la dernière case', () => {
    // La dernière case ne donne que le pouvoir : la victoire s'obtient au
    // retour. C'est la règle qui structure toute la seconde moitié du jeu.
    runner.setBoard(boardWith({}));
    logic.setPlayerPosition(0, LAST - 2);

    const outcome = runner.playTurn(2);

    expect(outcome.winner).toBeNull();
  });

  it('ne gagne pas en passant sur START à l\'aller', () => {
    runner.setBoard(boardWith({}));
    logic.setPlayerPosition(0, 0);

    const outcome = runner.playTurn(2);

    expect(outcome.winner).toBeNull();
  });
});

describe('3D-47 — la scène n\'écrit aucune règle', () => {
  it('laisse GameLogic décider de la position finale', () => {
    runner.setBoard(boardWith({ 5: { type: 'forward_2', direction: 'forward' } }));
    logic.setPlayerPosition(0, 3);

    const outcome = runner.playTurn(2);

    // La position rapportée est celle que la partie porte réellement.
    expect(outcome.effect?.to).toBe(logic.getPlayers()[0].position);
  });

  it('fonctionne sans plateau déclaré', () => {
    // Sans catalogue, aucun effet ne se déclenche — mais le tour se joue.
    logic.setPlayerPosition(0, 4);

    const outcome = runner.playTurn(2);

    expect(outcome.to).toBe(6);
    expect(outcome.effect).toBeNull();
  });
});
