import { describe, it, expect, beforeEach } from 'vitest';
import { GameLogic } from '@/features/game/game.logic';
import { TurnRunner } from '@/features/board/scene3d/turn-runner';
import { tableAnnouncement } from '@/features/board/scene3d/table-announcements';
import { pawnMarks } from '@/features/board/scene3d/pawn-marks';
import type { TileConfig } from '@/core/models/Tile';

/**
 * SCH-17 — le POULET existe enfin sur le plateau 3D.
 *
 * LE DÉFAUT, jumeau de celui du bouclier d'Athéna (SCH-33) : la scène 3D
 * écartait explicitement la case Poulet, avec un commentaire qui renvoyait
 * l'affaire « à l'étape des badges ». Cette étape est faite — le badge du
 * Poulet est branché et testé — mais il ne pouvait JAMAIS s'afficher :
 * `setChicken` n'était appelé nulle part côté 3D, donc `chickenRank` restait
 * à zéro pour tout le monde.
 *
 * Et la moitié la plus visible manquait aussi : la SENTENCE. « À chaque 3 ou
 * 6 de n'importe quel joueur, le Poulet boit » — c'est la règle qui se
 * déclenche le plus souvent de toute la partie, et elle ne se déclenchait
 * jamais.
 */

let logic: GameLogic;
let runner: TurnRunner;

const LAST = 22;
/** La case Poulet, posée au rang 3 pour les besoins du test. */
const COOP = 3;

function boardWithChicken(): TileConfig[] {
  return Array.from({ length: LAST + 1 }, (_, index) => ({
    type: index === COOP ? 'chicken' : 'empty',
    icon: '',
    name: '',
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
  runner.setBoard(boardWithChicken());
});

/**
 * Rend la main à Alice, SANS que Bastien foule la case Poulet.
 *
 * `GameLogic` n'expose aucun moyen de désigner le joueur courant, et c'est
 * bien ainsi : le tour de rôle est une règle, pas un réglage. On joue donc
 * un vrai tour — mais avec une face choisie pour que Bastien ne s'arrête pas
 * sur la case, ce qui lui donnerait le statut et FERAIT RETOMBER le rang
 * d'Alice à zéro. Le piège est réel : la promotion exige qu'aucun autre
 * joueur ne soit passé entre-temps.
 */
function passTurnWithoutTouchingTheCoop(): void {
  const elsewhere = COOP + 1;
  runner.playTurn(elsewhere);
}

/** Alice tombe deux fois sur la case, sans interruption : elle est promue. */
function promoteAliceToBigChicken(): void {
  runner.playTurn(COOP);
  passTurnWithoutTouchingTheCoop();
  logic.setPlayerPosition(0, 0);
  runner.playTurn(COOP);
}

describe('SCH-17 — tomber sur la case fait de vous le Poulet', () => {
  it('pose le statut quand le pion s\'y arrête', () => {
    const outcome = runner.playTurn(COOP);

    expect(outcome.to).toBe(COOP);
    expect(outcome.chicken).toEqual({ rank: 1 });
  });

  it('reporte le rang sur le joueur, pour que le badge existe', () => {
    // C'EST CE QUI MANQUAIT. Le badge lit `chickenRank` ; sans cet appel il
    // valait zéro pour tout le monde, et le Poulet ne portait rien.
    runner.playTurn(COOP);

    expect(logic.getPlayers()[0].chickenRank).toBe(1);
    expect(pawnMarks(logic.getPlayers()[0])).toHaveLength(1);
  });

  it('ne pose rien sur une case ordinaire', () => {
    const outcome = runner.playTurn(2);

    expect(outcome.chicken).toBeNull();
    expect(pawnMarks(logic.getPlayers()[0])).toHaveLength(0);
  });
});

describe('SCH-17 — la sentence tombe sur les 3 et les 6', () => {
  /** Alice devient le Poulet, puis la main passe à Bastien. */
  function makeAliceTheChicken(): void {
    runner.playTurn(COOP);
  }

  it('fait boire le Poulet sur un 3, même joué par un autre', () => {
    makeAliceTheChicken();

    const before = logic.getPlayers()[0].drinks;
    // Bastien joue, et sort un 3 : c'est ALICE qui boit.
    const outcome = runner.playTurn(3);

    expect(outcome.player).toBe(1);
    expect(outcome.chickenPenalty?.name).toBe('Alice');
    expect(logic.getPlayers()[0].drinks).toBe(before + 1);
  });

  it('fait boire le Poulet sur un 6', () => {
    makeAliceTheChicken();

    const outcome = runner.playTurn(6);

    expect(outcome.chickenPenalty?.name).toBe('Alice');
  });

  it('ne déclenche rien sur les autres faces', () => {
    makeAliceTheChicken();

    for (const face of [1, 2, 4, 5]) {
      expect(runner.playTurn(face).chickenPenalty).toBeNull();
    }
  });

  it('ne déclenche rien tant que personne n\'est Poulet', () => {
    // Un 3 avant que la case soit foulée ne doit faire boire personne.
    const outcome = runner.playTurn(3);

    expect(outcome.chickenPenalty).toBeNull();
  });
});

describe('SCH-17 — le GROS POULET distribue au lieu de boire', () => {
  it('promeut celui qui retombe sur la case', () => {
    // Alice y tombe, puis y retombe sans qu'un autre joueur soit passé sur
    // la case entre-temps : c'est la promotion.
    runner.playTurn(COOP);
    passTurnWithoutTouchingTheCoop();
    logic.setPlayerPosition(0, 0);

    const outcome = runner.playTurn(COOP);

    expect(outcome.chicken).toEqual({ rank: 2 });
    expect(logic.getPlayers()[0].chickenRank).toBe(2);
  });

  it('renverse la sentence : il distribue', () => {
    // C'EST TOUT L'INTÉRÊT DE LA PROMOTION, et Bastien avait signalé qu'elle
    // passait inaperçue. Le Gros Poulet ne boit plus, il fait boire.
    promoteAliceToBigChicken();

    const before = logic.getPlayers()[0].drinks;
    const outcome = runner.playTurn(3);

    expect(outcome.chickenPenalty?.distributes).toBe(true);
    expect(logic.getPlayers()[0].drinks).toBe(before);
  });
});

describe('SCH-17 — la sentence est ANNONCÉE, sinon elle est oubliée', () => {
  it('annonce la sentence du Poulet à la table', () => {
    runner.playTurn(COOP);
    const outcome = runner.playTurn(3);

    const said = tableAnnouncement(outcome);

    expect(said).not.toBeNull();
    expect(said!.playerName).toBe('Alice');
    expect(said!.text).toContain('Poulet');
  });

  it('la fait passer avant l\'action du joueur courant', () => {
    // ELLE CONCERNE QUELQU'UN D'AUTRE que celui qui vient de jouer, et c'est
    // exactement pour ça qu'elle s'oublie : personne ne la guette. Le rendu
    // CSS a dû en faire une fenêtre à valider pour la même raison.
    runner.playTurn(COOP);
    const outcome = runner.playTurn(3);

    // Le tour porte aussi une distribution : la sentence passe devant.
    const said = tableAnnouncement({
      ...outcome,
      distribute: { amount: 3 },
    } as typeof outcome);

    expect(said!.playerName).toBe('Alice');
  });

  it('annonce la distribution du GROS POULET, pas une gorgée', () => {
    promoteAliceToBigChicken();

    const said = tableAnnouncement(runner.playTurn(6));

    expect(said!.text).toContain('distribue');
  });
});
