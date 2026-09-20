import { describe, it, expect, beforeEach } from 'vitest';
import { GameLogic } from '@/features/game/game.logic';
import { TurnRunner } from '@/features/board/scene3d/turn-runner';
import type { TileConfig } from '@/core/models/Tile';
import { TILE_CONFIGS } from '@/features/tiles/tile.config';

/**
 * 3D-58 — tomber sur le temple appelle les deux dés, et retient la main.
 *
 * Quentin : « FAVEUR DES DIEUX — les 2 dés n'apparaissent pas quand on tombe
 * dessus. À corriger. »
 *
 * LE DÉFAUT tenait en une omission : la case du temple n'était traitée nulle
 * part dans `TurnRunner`. Elle tombait dans le cas « aucun effet » de
 * `applyDrinking`, le tour passait au joueur suivant, et la faveur n'avait
 * jamais lieu. La couleur mauve de la case était tout ce qu'il en restait.
 *
 * LA MAIN DOIT RESTER au joueur pendant le tirage. C'est la leçon du panneau
 * de distribution, qui reparaissait à chaque image parce que la décision
 * était lue dans un `TurnOutcome` figé : l'attente vit dans le runner, et
 * quelque chose doit pouvoir l'effacer.
 */

let logic: GameLogic;
let runner: TurnRunner;

const LAST = 22;
/** La position où l'on pose le temple pour les besoins du test. */
const TEMPLE = 3;

/** Un plateau où seule la case 3 est un temple. */
function boardWithTemple(): TileConfig[] {
  return Array.from({ length: LAST + 1 }, (_, index) => ({
    type: index === TEMPLE ? 'power' : 'empty',
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
  runner.setBoard(boardWithTemple());
});

describe('3D-58 — le temple réclame les deux dés', () => {
  it('signale la faveur quand le pion s\'y pose', () => {
    // Alice part de 0 : un 3 la pose sur le temple.
    const outcome = runner.playTurn(TEMPLE);

    expect(outcome.to).toBe(TEMPLE);
    expect(outcome.godFavor).toBe(true);
  });

  it('ne la signale pas sur une case ordinaire', () => {
    const outcome = runner.playTurn(2);

    expect(outcome.godFavor).toBe(false);
  });

  it('retient la main du joueur pendant le tirage', () => {
    // SANS CELA, la faveur serait tirée par Alice mais résolue pendant le
    // tour de Bastien : l'état et la décision vivraient de deux côtés.
    runner.playTurn(TEMPLE);

    expect(runner.getAwaitingGodFavor()).toEqual({ player: 0 });
    expect(runner.currentPlayerName()).toBe('Alice');
  });

  it('passe la main quand la case n\'est pas un temple', () => {
    runner.playTurn(2);

    expect(runner.getAwaitingGodFavor()).toBeNull();
    expect(runner.currentPlayerName()).toBe('Bastien');
  });
});

describe('3D-58 — le tirage rend la main', () => {
  it('efface l\'attente une fois les dés tombés', () => {
    // L'ATTENTE DOIT POUVOIR S'EFFACER. Le panneau de distribution
    // reparaissait sans fin faute de quoi.
    runner.playTurn(TEMPLE);
    runner.resolveGodFavor(2, 5);

    expect(runner.getAwaitingGodFavor()).toBeNull();
  });

  it('rend la main au joueur suivant', () => {
    runner.playTurn(TEMPLE);
    expect(runner.currentPlayerName()).toBe('Alice');

    runner.resolveGodFavor(2, 5);

    expect(runner.currentPlayerName()).toBe('Bastien');
  });

  it('annonce la faveur de la somme', () => {
    runner.playTurn(TEMPLE);
    const roll = runner.resolveGodFavor(5, 6);

    expect(roll.sum).toBe(11);
    expect(roll.favor?.name).toBe('POSÉIDON');
  });
});

describe('3D-58 — la colère des dieux est la seule faveur comptée', () => {
  it('sert le cul sec du double', () => {
    // La colère ne demande AUCUN choix : elle peut être comptée. Elle passe
    // par `addDrinks`, seul endroit où le bouclier d'Athéna intercepte.
    runner.playTurn(TEMPLE);
    const before = logic.getPlayers()[0].drinks;

    runner.resolveGodFavor(4, 4);

    expect(logic.getPlayers()[0].drinks).toBe(before + 1);
  });

  it('ne sert rien pour une faveur qui demande un choix', () => {
    // POSÉIDON cible un joueur et ses voisins : l'application ne choisit pas
    // à leur place, elle énonce et les joueurs appliquent — comme Quentin l'a
    // tranché pour les cases qui se jouent à la table.
    runner.playTurn(TEMPLE);
    const before = logic.getPlayers().map(p => p.drinks);

    runner.resolveGodFavor(5, 6);

    expect(logic.getPlayers().map(p => p.drinks)).toEqual(before);
  });

  it('ne sert le cul sec qu\'au joueur du temple', () => {
    runner.playTurn(TEMPLE);
    const other = logic.getPlayers()[1].drinks;

    runner.resolveGodFavor(3, 3);

    expect(logic.getPlayers()[1].drinks).toBe(other);
  });
});

describe('3D-58 — sur le PLATEAU OFFICIEL, pas seulement sur un plateau de test', () => {
  it('trouve bien la case FAVEUR DES DIEUX', () => {
    // Un plateau de test prouverait seulement que le code marche sur un
    // plateau de test. Le défaut vivait sur le vrai plateau.
    const powers = TILE_CONFIGS
      .map((tile, index) => ({ tile, index }))
      .filter(({ tile }) => tile.type === 'power');

    expect(powers.length).toBeGreaterThan(0);
    expect(powers[0].tile.name).toBe('FAVEUR DES DIEUX');
  });

  it('déclenche les deux dés quand on tombe dessus', () => {
    const board = TILE_CONFIGS as TileConfig[];
    const power = board.findIndex(tile => tile.type === 'power');

    const g = new GameLogic();
    g.setBoardSize(board.length);
    g.startGame([
      { name: 'Alice', color: '#e2483d' },
      { name: 'Bastien', color: '#3d7fc4' },
    ]);

    const r = new TurnRunner(g);
    r.setBoard(board);

    const outcome = r.playTurn(power);

    expect(outcome.to).toBe(power);
    expect(outcome.godFavor).toBe(true);
    // Et SURTOUT : elle ne doit plus être annoncée comme une case qui se
    // joue à la table. C'est ce qu'elle disait avant, au lieu des dés.
    expect(outcome.tableRule).toBe(false);
    expect(r.getAwaitingGodFavor()).toEqual({ player: 0 });
  });
});

describe('3D-60 — le plateau officiel porte DEUX cases faveur', () => {
  it('les trouve toutes les deux', () => {
    // Elles sont à 14 cases d'écart. Avec plusieurs joueurs, deux tirages
    // peuvent donc s'enchaîner à quelques secondes — c'est ce qui rend le
    // minuteur d'effacement des dés dangereux s'il n'est pas annulé.
    const favors = TILE_CONFIGS
      .map((tile, index) => ({ tile, index }))
      .filter(({ tile }) => tile.type === 'power');

    expect(favors).toHaveLength(2);
    for (const { tile } of favors) expect(tile.name).toBe('FAVEUR DES DIEUX');
  });

  it('déclenche le tirage sur CHACUNE', () => {
    // Pas seulement sur la première : une case oubliée resterait muette, ce
    // qui est exactement le défaut de départ.
    const board = TILE_CONFIGS as TileConfig[];

    for (const [rank, tile] of board.entries()) {
      if (tile.type !== 'power') continue;

      const g = new GameLogic();
      g.setBoardSize(board.length);
      g.startGame([
        { name: 'Alice', color: '#e2483d' },
        { name: 'Bastien', color: '#3d7fc4' },
      ]);

      const r = new TurnRunner(g);
      r.setBoard(board);

      const outcome = r.playTurn(rank);

      expect(outcome.godFavor).toBe(true);
      expect(r.getAwaitingGodFavor()).not.toBeNull();
    }
  });
});

/**
 * SCH-33 — ATHÉNA laisse un bouclier derrière elle.
 *
 * Les faveurs se jouent À LA TABLE : l'application les énonce, les joueurs
 * les appliquent. Athéna fait exception pour une raison précise — elle ne
 * demande AUCUN choix au moment où elle tombe (« choisissez un objet
 * bouclier » ne désigne personne), et elle laisse un ÉTAT DURABLE qui décide
 * de la victoire : tant qu'on porte le bouclier, on ne peut pas gagner.
 *
 * LE DÉFAUT : la scène 3D savait UTILISER le bouclier (`resolveShield`) mais
 * ne l'accordait jamais. Le rendu CSS le fait depuis toujours
 * (`main-camera.ts`). Côté 3D, rien ne mettait l'état à vrai : `resolveShield`
 * était donc du code mort, et le badge du bouclier ne pouvait jamais
 * s'afficher.
 */
describe('SCH-33 — le bouclier d\'Athéna est réellement donné', () => {
  /** Amène Alice sur le temple, prête à tirer. */
  function reachTemple(): void {
    runner.playTurn(TEMPLE);
  }

  it('donne le bouclier sur une somme de 3', () => {
    reachTemple();
    runner.resolveGodFavor(1, 2);

    expect(logic.getPlayers()[0].hasAthenaShield).toBe(true);
  });

  it('ne le donne à personne d\'autre', () => {
    reachTemple();
    runner.resolveGodFavor(1, 2);

    expect(logic.getPlayers()[1].hasAthenaShield).toBe(false);
  });

  it('ne le donne pas sur une autre faveur', () => {
    reachTemple();
    runner.resolveGodFavor(5, 6);

    expect(logic.getPlayers()[0].hasAthenaShield).toBe(false);
  });

  it('ne le donne pas sur la colère des dieux', () => {
    // NE TESTE PAS le garde-fou sur le double, et ne le peut pas : un double
    // ne fait que des sommes PAIRES (2, 4, 6, 8, 10, 12), jamais 3. Ce cas
    // échoue donc déjà sur la somme, et `!roll.double` reste une précaution
    // qu'aucun tirage ne peut mettre en défaut — vérifié, et conservé dans le
    // code au cas où `ATHENA_SUM` changerait.
    //
    // Ce que le test vérifie vraiment : un double 4 — somme 8, normalement
    // ARÈS — ne donne pas le bouclier. C'est un vrai tirage de partie.
    reachTemple();
    runner.resolveGodFavor(4, 4);

    expect(logic.getPlayers()[0].hasAthenaShield).toBe(false);
  });

  it('rend `resolveShield` utilisable, ce qui était le but', () => {
    // C'EST LA LIVRAISON. Le renvoi existait déjà et ne pouvait pas servir :
    // aucun chemin 3D ne mettait jamais le bouclier à vrai. La boucle est
    // maintenant complète — on obtient le bouclier, une sanction arrive, on
    // la renvoie.
    reachTemple();
    runner.resolveGodFavor(1, 2);

    expect(logic.getPlayers()[0].hasAthenaShield).toBe(true);

    // Une sanction tombe sur la porteuse : le bouclier la RETIENT.
    logic.addDrinks(0, 2);
    const pending = logic.getPendingShield();
    expect(pending).not.toBeNull();

    // Elle la renvoie sur Bastien, et se défait du bouclier.
    runner.resolveShield(1);
    expect(logic.getPlayers()[0].hasAthenaShield).toBe(false);
  });
});
