import { describe, it, expect } from 'vitest';
import { DicePhysics } from '@/features/dice/DicePhysics';
import { WORLD_DICE_CONFIG, DIE_EDGE } from '@/features/board/scene3d/dice-world-config';
import { diceArena } from '@/features/board/scene3d/dice-arena';

/**
 * 3D-49 — le dé reste SUR le plateau.
 *
 * Quentin, en majuscules dans les specs : « le dé reste sur le plateau. Pas
 * d'infini, pas de je jette le dé dans le vide. »
 *
 * Ce n'est pas de la physique nouvelle : `DicePhysics` gère déjà les rebonds
 * de bord et la chute hors table, avec des bordures configurables côté par
 * côté. Ce qui manquait, c'est de lui DIRE où est le plateau — elle tournait
 * jusqu'ici dans une aire carrée inventée, sans rapport avec les cases posées.
 *
 * L'aire est donc calculée depuis les positions réelles des cases, ce qui la
 * rend indépendante de la forme du parcours : un plateau en U ou en cercle
 * donne la sienne par le même calcul.
 */

const TILE = 120;

/** Le plateau officiel : deux rangées de dix. */
function officialTiles(): { x: number; z: number }[] {
  const tiles = [];
  for (let col = 0; col < 10; col++) tiles.push({ x: col * 135, z: 0 });
  for (let col = 0; col < 10; col++) tiles.push({ x: col * 135, z: 675 });
  return tiles;
}

describe('3D-49 — l\'aire de jeu épouse le plateau', () => {
  it('couvre toutes les cases posées', () => {
    const arena = diceArena(officialTiles(), TILE);

    expect(arena.minX).toBeLessThanOrEqual(0 - TILE / 2);
    expect(arena.maxX).toBeGreaterThanOrEqual(9 * 135 + TILE / 2);
    expect(arena.minZ).toBeLessThanOrEqual(0 - TILE / 2);
    expect(arena.maxZ).toBeGreaterThanOrEqual(675 + TILE / 2);
  });

  it('ne suppose rien de la forme du parcours', () => {
    // Un plateau en U, comme l'éditeur permet d'en composer.
    const u = [
      ...Array.from({ length: 6 }, (_, i) => ({ x: 0, z: i * 135 })),
      ...Array.from({ length: 5 }, (_, i) => ({ x: (i + 1) * 135, z: 5 * 135 })),
    ];

    const arena = diceArena(u, TILE);

    expect(arena.maxX - arena.minX).toBeGreaterThan(0);
    expect(arena.maxZ - arena.minZ).toBeGreaterThan(0);
  });

  it('reste utilisable sur un parcours vide', () => {
    // Avant que les données soient chargées : l'aire doit exister, sinon le
    // dé n'a nulle part où rouler.
    const arena = diceArena([], TILE);

    expect(arena.maxX - arena.minX).toBeGreaterThan(0);
    expect(arena.maxZ - arena.minZ).toBeGreaterThan(0);
  });

  it('laisse la place au dé de rouler près du bord', () => {
    // Une aire calée au ras des cases coincerait le dé dès qu'il s'en
    // approche : il lui faut de quoi tenir ENTIER au-delà de la dernière
    // case. On mesure donc la marge elle-même, et non l'étendue totale —
    // celle-ci contient déjà les demi-cases et resterait satisfaite sans
    // aucune marge.
    const arena = diceArena(officialTiles(), TILE);

    const marginLeft = 0 - TILE / 2 - arena.minX;
    const marginRight = arena.maxX - (9 * 135 + TILE / 2);

    expect(marginLeft).toBeGreaterThanOrEqual(DIE_EDGE);
    expect(marginRight).toBeGreaterThanOrEqual(DIE_EDGE);
  });
});

describe('3D-49 — le dé ne quitte jamais le plateau', () => {
  it('reste dans les bornes, quel que soit le lancer', () => {
    const arena = diceArena(officialTiles(), TILE);
    const half = DIE_EDGE / 2;

    for (let trial = 0; trial < 300; trial++) {
      const physics = new DicePhysics(
        WORLD_DICE_CONFIG,
        { x: (arena.minX + arena.maxX) / 2, y: (arena.minZ + arena.maxZ) / 2 },
        { width: arena.maxX - arena.minX, height: arena.maxZ - arena.minZ }
      );

      // Les quatre côtés bordés : le dé rebondit au lieu de tomber.
      physics.setTableBounds(
        { minX: arena.minX, maxX: arena.maxX, minY: arena.minZ, maxY: arena.maxZ },
        { top: true, right: true, bottom: true, left: true }
      );

      physics.throw();

      let guard = 0;
      while (physics.getState().isRolling && guard++ < 6000) {
        const state = physics.update(16);

        // À aucun instant, pas seulement à l'arrivée : un dé qui sort puis
        // revient aurait été vu hors du plateau.
        expect(state.position.x).toBeGreaterThanOrEqual(arena.minX - half - 1);
        expect(state.position.x).toBeLessThanOrEqual(arena.maxX + half + 1);
        expect(state.position.y).toBeGreaterThanOrEqual(arena.minZ - half - 1);
        expect(state.position.y).toBeLessThanOrEqual(arena.maxZ + half + 1);
      }
    }
  });

  it('ne tombe jamais quand les quatre bords sont fermés', () => {
    // « Pas de je jette le dé dans le vide » : avec les quatre bordures, la
    // chute ne doit pas pouvoir se produire.
    const arena = diceArena(officialTiles(), TILE);
    let fell = 0;

    for (let trial = 0; trial < 200; trial++) {
      const physics = new DicePhysics(
        WORLD_DICE_CONFIG,
        { x: (arena.minX + arena.maxX) / 2, y: (arena.minZ + arena.maxZ) / 2 },
        { width: arena.maxX - arena.minX, height: arena.maxZ - arena.minZ }
      );
      physics.setTableBounds(
        { minX: arena.minX, maxX: arena.maxX, minY: arena.minZ, maxY: arena.maxZ },
        { top: true, right: true, bottom: true, left: true }
      );
      physics.throw();

      let guard = 0;
      while (physics.getState().isRolling && guard++ < 6000) physics.update(16);

      if (physics.getState().hasFallen) fell++;
    }

    expect(fell).toBe(0);
  });

  it('donne toujours une valeur lisible', () => {
    // Les rebonds de bord ne doivent pas laisser le dé sur une arête.
    const arena = diceArena(officialTiles(), TILE);
    const seen = new Set<number>();

    for (let trial = 0; trial < 200; trial++) {
      const physics = new DicePhysics(
        WORLD_DICE_CONFIG,
        { x: (arena.minX + arena.maxX) / 2, y: (arena.minZ + arena.maxZ) / 2 },
        { width: arena.maxX - arena.minX, height: arena.maxZ - arena.minZ }
      );
      physics.setTableBounds(
        { minX: arena.minX, maxX: arena.maxX, minY: arena.minZ, maxY: arena.maxZ },
        { top: true, right: true, bottom: true, left: true }
      );
      physics.throw();

      let guard = 0;
      while (physics.getState().isRolling && guard++ < 6000) physics.update(16);

      const value = physics.getState().currentValue;
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
      seen.add(value);
    }

    expect(seen.size).toBe(6);
  });
});

describe('3D-49 — les bords retiennent vraiment le dé', () => {
  it('garde le CORPS du dé dans l\'aire, pas seulement son centre', () => {
    // Une aire volontairement étroite, pour que le dé atteigne les bords à
    // presque tous les lancers. Sur le vrai plateau il ne les touche jamais
    // — l'aire fait 1507 × 967 pour un lancer de 2,2 cases — donc le rebond
    // n'y est jamais exercé. Sans ce test, la garantie « le dé reste sur le
    // plateau » reposerait sur la brièveté du lancer et non sur les bords.
    const arena = { minX: 0, maxX: 400, minZ: 0, maxZ: 400 };
    const half = DIE_EDGE / 2;
    let reachedEdge = 0;

    // `setTableBounds` parle en minY/maxY — l'axe de profondeur s'appelle Y
    // dans la physique, Z dans la scène. Lui passer un objet en minZ/maxZ
    // laisse ces bornes à `undefined` SANS erreur : seuls les murs X
    // agissent, et le dé sort par la profondeur. C'est ce qui a fait échouer
    // ce test la première fois, et la conversion est faite explicitement ici
    // pour que la confusion se voie.
    const physicsBounds = {
      minX: arena.minX,
      maxX: arena.maxX,
      minY: arena.minZ,
      maxY: arena.maxZ,
    };

    for (let trial = 0; trial < 120; trial++) {
      const physics = new DicePhysics(
        WORLD_DICE_CONFIG,
        { x: 200, y: 200 },
        { width: 400, height: 400 }
      );
      physics.setTableBounds(physicsBounds, {
        top: true,
        right: true,
        bottom: true,
        left: true,
      });
      physics.throw();

      let guard = 0;
      while (physics.getState().isRolling && guard++ < 6000) {
        const state = physics.update(16);

        // Le cube ENTIER doit tenir : c'est son corps qu'on voit dépasser,
        // pas son centre.
        expect(state.position.x - half).toBeGreaterThanOrEqual(arena.minX);
        expect(state.position.x + half).toBeLessThanOrEqual(arena.maxX);
        expect(state.position.y - half).toBeGreaterThanOrEqual(arena.minZ);
        expect(state.position.y + half).toBeLessThanOrEqual(arena.maxZ);

        if (state.position.x <= arena.minX + half + 2) reachedEdge++;
      }
    }

    // Le test ne vaut que si les bords sont effectivement atteints.
    expect(reachedEdge).toBeGreaterThan(0);
  });
});
