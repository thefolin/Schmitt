import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameLogic } from '@/features/game/game.logic';

const players = [
  { name: 'Alice', color: '#f00' },
  { name: 'Bob', color: '#0f0' },
  { name: 'Carol', color: '#00f' },
];

describe('GameLogic.startGame', () => {
  it('crée un joueur par config, en conservant ordre, index et état initial', () => {
    const game = new GameLogic();
    game.startGame(players);

    const list = game.getPlayers();
    expect(list).toHaveLength(3);
    list.forEach((p, i) => {
      expect(p.index).toBe(i);
      expect(p.position).toBe(0);
      expect(p.drinks).toBe(0);
      expect(p.hasSchmittPower).toBe(false);
      expect(p.hasAthenaShield).toBe(false);
      expect(p.canReplay).toBe(false);
      expect(p.isReturning).toBe(false);
    });
    expect(list.map(p => p.name)).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('démarre au joueur 0 et marque la partie comme lancée', () => {
    const game = new GameLogic();
    game.startGame(players);

    expect(game.getCurrentPlayerIndex()).toBe(0);
    expect(game.isGameStarted()).toBe(true);
    expect(game.getCurrentPlayer()?.name).toBe('Alice');
  });

  it('réinitialise l\'historique à chaque nouvelle partie', () => {
    const game = new GameLogic();
    game.startGame(players);
    game.rollDice();
    expect(game.getHistory().length).toBeGreaterThan(1);

    game.startGame(players);
    expect(game.getHistory()).toEqual([`🎮 Partie démarrée avec 3 joueurs`]);
  });
});

describe('GameLogic.rollDice', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retourne toujours une valeur entre 1 et 6', () => {
    const game = new GameLogic();
    game.startGame(players);

    for (let i = 0; i < 200; i++) {
      const roll = game.rollDice();
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(6);
      expect(Number.isInteger(roll)).toBe(true);
    }
  });

  it('mémorise le dernier lancer', () => {
    const game = new GameLogic();
    game.startGame(players);
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);

    const roll = game.rollDice();
    expect(roll).toBe(6);
    expect(game.getLastDiceRoll()).toBe(6);
  });
});

describe('GameLogic.movePlayer', () => {
  it('avance un joueur du nombre de pas donné', () => {
    const game = new GameLogic();
    game.startGame(players);

    const newPos = game.movePlayer(0, 5);
    expect(newPos).toBe(5);
    expect(game.getPlayerByIndex(0)?.position).toBe(5);
  });

  it('plafonne la position à 23 (case FINISH), même en cas de très gros saut', () => {
    const game = new GameLogic();
    game.startGame(players);

    game.movePlayer(0, 100);
    expect(game.getPlayerByIndex(0)?.position).toBe(23);
  });

  it('ne fait rien et retourne 0 pour un index de joueur invalide', () => {
    const game = new GameLogic();
    game.startGame(players);

    const result = game.movePlayer(99, 5);
    expect(result).toBe(0);
  });

  it('cumule les déplacements successifs', () => {
    const game = new GameLogic();
    game.startGame(players);

    game.movePlayer(1, 3);
    game.movePlayer(1, 4);
    expect(game.getPlayerByIndex(1)?.position).toBe(7);
  });
});

describe('GameLogic.addDrinks', () => {
  it('additionne les gorgées sur plusieurs appels', () => {
    const game = new GameLogic();
    game.startGame(players);

    game.addDrinks(0, 2);
    game.addDrinks(0, 3);
    expect(game.getPlayerByIndex(0)?.drinks).toBe(5);
  });

  it('ignore silencieusement un index de joueur invalide', () => {
    const game = new GameLogic();
    game.startGame(players);
    expect(() => game.addDrinks(42, 3)).not.toThrow();
  });
});

describe('GameLogic.setSchmittPower', () => {
  it('active puis désactive le pouvoir Schmitt', () => {
    const game = new GameLogic();
    game.startGame(players);

    game.setSchmittPower(0, true);
    expect(game.getPlayerByIndex(0)?.hasSchmittPower).toBe(true);

    game.setSchmittPower(0, false);
    expect(game.getPlayerByIndex(0)?.hasSchmittPower).toBe(false);
  });
});

describe('GameLogic.nextPlayer / previousPlayer', () => {
  it('passe au joueur suivant en bouclant sur le dernier', () => {
    const game = new GameLogic();
    game.startGame(players);

    expect(game.getCurrentPlayerIndex()).toBe(0);
    game.nextPlayer();
    expect(game.getCurrentPlayerIndex()).toBe(1);
    game.nextPlayer();
    expect(game.getCurrentPlayerIndex()).toBe(2);
    game.nextPlayer();
    expect(game.getCurrentPlayerIndex()).toBe(0); // boucle
  });

  it('ne change pas de joueur si canReplay est actif, et le consomme (case "rejouer")', () => {
    const game = new GameLogic();
    game.startGame(players);

    const current = game.getCurrentPlayer()!;
    current.canReplay = true;

    game.nextPlayer();
    expect(game.getCurrentPlayerIndex()).toBe(0); // toujours le même joueur
    expect(game.getCurrentPlayer()?.canReplay).toBe(false); // consommé

    // Un deuxième appel avance bien normalement
    game.nextPlayer();
    expect(game.getCurrentPlayerIndex()).toBe(1);
  });

  it('previousPlayer boucle en arrière (utilisé par Apollon)', () => {
    const game = new GameLogic();
    game.startGame(players);

    game.previousPlayer();
    expect(game.getCurrentPlayerIndex()).toBe(2); // boucle vers le dernier
  });

  it('nextPlayer puis previousPlayer revient au point de départ', () => {
    const game = new GameLogic();
    game.startGame(players);

    game.nextPlayer();
    game.previousPlayer();
    expect(game.getCurrentPlayerIndex()).toBe(0);
  });
});

describe('GameLogic.setPlayerPosition (pouvoir Hermès)', () => {
  it('définit directement une position (échange de position)', () => {
    const game = new GameLogic();
    game.startGame(players);

    game.setPlayerPosition(0, 10);
    expect(game.getPlayerByIndex(0)?.position).toBe(10);
  });

  it('clamp la position entre 0 et 23', () => {
    const game = new GameLogic();
    game.startGame(players);

    game.setPlayerPosition(0, -5);
    expect(game.getPlayerByIndex(0)?.position).toBe(0);

    game.setPlayerPosition(0, 999);
    expect(game.getPlayerByIndex(0)?.position).toBe(23);
  });
});

describe('GameLogic.checkVictory', () => {
  it('ne détecte pas de gagnant tant que personne n\'a atteint la case 23', () => {
    const game = new GameLogic();
    game.startGame(players);
    game.movePlayer(0, 22);

    expect(game.checkVictory()).toBeNull();
  });

  it('détecte le premier joueur ayant atteint ou dépassé la case 23', () => {
    const game = new GameLogic();
    game.startGame(players);
    game.movePlayer(1, 23);

    const winner = game.checkVictory();
    expect(winner?.name).toBe('Bob');
  });
});

describe('GameLogic.reset', () => {
  it('remet le jeu à zéro complètement', () => {
    const game = new GameLogic();
    game.startGame(players);
    game.movePlayer(0, 5);
    game.rollDice();

    game.reset();

    expect(game.getPlayers()).toEqual([]);
    expect(game.isGameStarted()).toBe(false);
    expect(game.getHistory()).toEqual([]);
    expect(game.getLastDiceRoll()).toBe(0);
    expect(game.getCurrentPlayerIndex()).toBe(0);
  });
});

describe('GameLogic.getHistory', () => {
  it('limite l\'historique à 50 messages (garde les plus récents)', () => {
    const game = new GameLogic();
    game.startGame(players);

    for (let i = 0; i < 60; i++) {
      game.rollDice();
    }

    const history = game.getHistory();
    expect(history.length).toBeLessThanOrEqual(50);
  });

  it('getPlayers/getHistory retournent des copies (pas de mutation externe possible)', () => {
    const game = new GameLogic();
    game.startGame(players);

    const list = game.getPlayers();
    list[0].position = 999;
    expect(game.getPlayerByIndex(0)?.position).toBe(0);

    const history = game.getHistory();
    history.push('injecté');
    expect(game.getHistory()).not.toContain('injecté');
  });
});
