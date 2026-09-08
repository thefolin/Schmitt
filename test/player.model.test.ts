import { describe, it, expect } from 'vitest';
import { PlayerModel } from '@/core/models/Player';

describe('PlayerModel construction', () => {
  it('initialise un joueur avec un état neutre', () => {
    const player = new PlayerModel('Alice', '#ff0000', 0);

    expect(player.name).toBe('Alice');
    expect(player.color).toBe('#ff0000');
    expect(player.index).toBe(0);
    expect(player.position).toBe(0);
    expect(player.hasSchmittPower).toBe(false);
    expect(player.isReturning).toBe(false);
    expect(player.drinks).toBe(0);
    expect(player.hasAthenaShield).toBe(false);
    expect(player.canReplay).toBe(false);
  });
});

describe('PlayerModel.addDrinks', () => {
  it('cumule les gorgées', () => {
    const player = new PlayerModel('Alice', '#f00', 0);
    player.addDrinks(2);
    player.addDrinks(3);
    expect(player.drinks).toBe(5);
  });
});

describe('PlayerModel.move (avance normale)', () => {
  it('avance normalement sans dépasser maxPosition', () => {
    const player = new PlayerModel('Alice', '#f00', 0);
    player.move(5, 23);
    expect(player.position).toBe(5);
  });

  it('rebondit en arrière si on dépasse maxPosition (comportement "retour")', () => {
    const player = new PlayerModel('Alice', '#f00', 0);
    player.position = 22;
    player.move(3, 23); // dépasse de 2 -> rebond
    expect(player.position).toBe(21); // 23 - overflow(2)
  });

  it('atterrit exactement sur maxPosition sans rebond si pile dessus', () => {
    const player = new PlayerModel('Alice', '#f00', 0);
    player.position = 20;
    player.move(3, 23);
    expect(player.position).toBe(23);
  });
});

describe('PlayerModel.move (mode retour / isReturning)', () => {
  it('recule quand isReturning est actif', () => {
    const player = new PlayerModel('Alice', '#f00', 0);
    player.position = 10;
    player.isReturning = true;
    player.move(3, 23);
    expect(player.position).toBe(7);
  });

  it('rebondit en positif si le recul dépasse 0', () => {
    const player = new PlayerModel('Alice', '#f00', 0);
    player.position = 2;
    player.isReturning = true;
    player.move(5, 23); // 2 - 5 = -3 -> abs = 3
    expect(player.position).toBe(3);
  });
});

describe('PlayerModel.reset', () => {
  it('remet tout l\'état à zéro y compris les pouvoirs actifs', () => {
    const player = new PlayerModel('Alice', '#f00', 0);
    player.position = 15;
    player.hasSchmittPower = true;
    player.isReturning = true;
    player.drinks = 4;
    player.hasAthenaShield = true;
    player.canReplay = true;

    player.reset();

    expect(player.position).toBe(0);
    expect(player.hasSchmittPower).toBe(false);
    expect(player.isReturning).toBe(false);
    expect(player.drinks).toBe(0);
    expect(player.hasAthenaShield).toBe(false);
    expect(player.canReplay).toBe(false);
  });
});
