import { describe, it, expect, beforeEach } from 'vitest';
import { GameLogic } from '@/features/game/game.logic';
import { TurnRunner } from '@/features/board/scene3d/turn-runner';

/**
 * 3D-46 — jouer un tour complet : lancer, avancer, joueur suivant.
 *
 * C'est la jonction entre les 2 346 lignes de règles et le nouveau rendu.
 * Elle est vérifiée SEULE, avant qu'on y empile le HUD, les overlays ou les
 * faveurs : si la chaîne face du dé → déplacement tient de bout en bout dans
 * la scène unique, la refonte a prouvé ce qu'elle devait prouver.
 *
 * Les quatre défauts successifs du dé en CSS étaient tous des variantes de
 * « la face vue ne correspond pas au déplacement ». D'où l'insistance sur le
 * premier groupe de tests.
 *
 * LE SENS DE LA DÉPENDANCE : c'est la scène qui s'adapte aux règles, jamais
 * l'inverse. `TurnRunner` ne contient aucune règle de jeu — il appelle
 * `GameLogic`, qui reste seul juge. Si une règle devait changer pour que le
 * rendu fonctionne, ce serait le signe qu'on a débordé.
 */

let logic: GameLogic;
let runner: TurnRunner;

/** Un plateau de 23 cases, comme le plateau officiel. */
const LAST = 22;

beforeEach(() => {
  logic = new GameLogic();
  logic.setBoardSize(LAST + 1);
  logic.startGame([
    { name: 'Alice', color: '#e2483d' },
    { name: 'Bastien', color: '#3d7fc4' },
    { name: 'Chloé', color: '#2f8f4e' },
  ]);
  runner = new TurnRunner(logic);
});

describe('3D-46 — le pion avance de ce que montre le dé', () => {
  it('avance exactement du nombre de cases affiché', () => {
    // Le cœur du chantier. La valeur vient de la PHYSIQUE du dé, pas d'un
    // tirage séparé : c'est toute la différence avec le rendu précédent, où
    // la face vue et le déplacement pouvaient diverger.
    //
    // Chaque tour donne la main au joueur suivant : on repositionne CELUI
    // qui va jouer, et non toujours le premier.
    for (let face = 1; face <= 6; face++) {
      const playing = logic.getCurrentPlayerIndex();
      logic.setPlayerPosition(playing, 0);

      const outcome = runner.playTurn(face);

      expect(outcome.player).toBe(playing);
      expect(outcome.from).toBe(0);
      expect(outcome.to).toBe(face);
      expect(outcome.steps).toBe(face);
    }
  });

  it('avance depuis la position courante, pas depuis le départ', () => {
    logic.setPlayerPosition(0, 7);

    const outcome = runner.playTurn(4);

    expect(outcome.to).toBe(11);
  });

  it('rend la valeur du dé telle quelle', () => {
    // Un `TurnRunner` qui retirerait ou ajouterait un pas romprait la
    // correspondance que le joueur vérifie de ses yeux.
    const outcome = runner.playTurn(5);

    expect(outcome.dice).toBe(5);
  });
});

describe('3D-46 — l\'arrivée se fait à la valeur exacte', () => {
  it('recule du surplus quand le jet est trop grand', () => {
    // Facile à oublier, et c'est toute la tension de fin de parcours : un
    // jet trop grand fait rebondir le pion de la différence.
    logic.setPlayerPosition(0, LAST - 2);

    const outcome = runner.playTurn(5);

    // 20 + 5 = 25, soit 3 de trop : on rebondit à 22 - 3 = 19.
    expect(outcome.to).toBe(LAST - 3);
  });

  it('atteint la dernière case sur une valeur juste', () => {
    logic.setPlayerPosition(0, LAST - 3);

    const outcome = runner.playTurn(3);

    expect(outcome.to).toBe(LAST);
  });

  it('ne sort jamais du plateau', () => {
    for (let start = LAST - 5; start <= LAST; start++) {
      for (let face = 1; face <= 6; face++) {
        logic.setPlayerPosition(0, start);

        const outcome = runner.playTurn(face);

        expect(outcome.to).toBeGreaterThanOrEqual(0);
        expect(outcome.to).toBeLessThanOrEqual(LAST);
      }
    }
  });
});

describe('3D-46 — la phase retour', () => {
  it('recule vers le départ après le demi-tour', () => {
    // C'est la moitié du jeu, et historiquement là où les bugs se cachent :
    // le sens des cases flèche ne s'est révélé faux qu'en phase retour.
    // Le demi-tour se déclenche par la RÈGLE, et non en forçant le drapeau :
    // `getPlayers()` rend des copies, et écrire dedans ne changerait rien à
    // la partie. Passer par `claimSchmittPower` vérifie en prime que la
    // bascule de phase fonctionne vraiment.
    logic.claimSchmittPower(1);
    logic.setPlayerPosition(0, 10);

    const outcome = runner.playTurn(4);

    expect(outcome.returning).toBe(true);
    expect(outcome.to).toBe(6);
  });

  it('rebondit sur START à la valeur exacte', () => {
    logic.claimSchmittPower(1);
    logic.setPlayerPosition(0, 2);

    const outcome = runner.playTurn(5);

    // 2 - 5 = -3 : on repart de l'autre côté, à 3.
    expect(outcome.to).toBe(3);
  });

  it('dit dans quel sens le joueur marche', () => {
    expect(runner.playTurn(1).returning).toBe(false);

    logic.claimSchmittPower(0);
    const playing = logic.getCurrentPlayerIndex();
    logic.setPlayerPosition(playing, 10);

    expect(runner.playTurn(1).returning).toBe(true);
  });
});

describe('3D-46 — le tour passe au joueur suivant', () => {
  it('donne la main au joueur suivant', () => {
    expect(logic.getCurrentPlayerIndex()).toBe(0);

    runner.playTurn(3);
    expect(logic.getCurrentPlayerIndex()).toBe(1);

    runner.playTurn(3);
    expect(logic.getCurrentPlayerIndex()).toBe(2);
  });

  it('revient au premier joueur après le dernier', () => {
    runner.playTurn(1);
    runner.playTurn(1);
    runner.playTurn(1);

    expect(logic.getCurrentPlayerIndex()).toBe(0);
  });

  it('déplace le joueur dont c\'est le tour', () => {
    // Un décalage d'un joueur ferait avancer le mauvais pion — défaut
    // silencieux tant qu'on ne regarde pas qui bouge.
    runner.playTurn(3);

    expect(logic.getPlayers()[0].position).toBe(3);
    expect(logic.getPlayers()[1].position).toBe(0);

    runner.playTurn(2);

    expect(logic.getPlayers()[0].position).toBe(3);
    expect(logic.getPlayers()[1].position).toBe(2);
  });

  it('nomme le joueur qui vient de jouer', () => {
    const outcome = runner.playTurn(2);

    // Et non celui à qui la main vient de passer : l'affichage parle de
    // l'action qui vient d'avoir lieu.
    expect(outcome.player).toBe(0);
    expect(outcome.playerName).toBe('Alice');
  });
});

describe('3D-46 — la scène ne décide d\'aucune règle', () => {
  it('laisse GameLogic seul juge de la position', () => {
    // Si `TurnRunner` recalculait la position au lieu de la demander, les
    // deux pourraient diverger — et c'est exactement le genre de duplication
    // que toute la refonte supprime.
    logic.setPlayerPosition(0, LAST - 1);

    const outcome = runner.playTurn(6);

    expect(outcome.to).toBe(logic.getPlayers()[0].position);
  });

  it('suit le joueur courant pour le cadrage', () => {
    // La vue suivie de #45 doit suivre le JOUEUR COURANT, pas un pion fixe.
    runner.playTurn(3);

    expect(runner.tileToFollow()).toBe(logic.getPlayers()[1].position);
  });

  it('donne les pions à afficher, dans l\'ordre des joueurs', () => {
    runner.playTurn(3);

    const pawns = runner.pawns();

    expect(pawns).toHaveLength(3);
    expect(pawns[0].position).toBe(3);
    expect(pawns[0].color).toBe('#e2483d');
  });
});
