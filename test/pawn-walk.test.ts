import { describe, it, expect } from 'vitest';
import { walkFrame, WALK_MS_PER_TILE, walkDuration } from '@/features/board/scene3d/pawn-walk';

/**
 * 3D-54 — la marche du pion, dans le temps.
 *
 * Quentin : « animation fluide, chemin sur le parcours, vitesse constante ».
 *
 * Le découpage du temps est séparé du rendu : cette fonction dit, pour un
 * instant donné, entre quelles cases le pion se trouve et où il en est de son
 * pas. Elle ne connaît ni Three.js ni le DOM, et se vérifie donc sans rien
 * afficher — la même raison qui a rendu le cadrage mesurable.
 *
 * VITESSE CONSTANTE, et c'est une exigence explicite : chaque case prend le
 * même temps. Un déplacement de 6 dure six fois un pas, pas le même temps
 * qu'un déplacement de 1 — sinon le joueur ne pourrait plus compter les cases
 * en regardant, ce qu'il fait forcément dans un jeu où le dé décide de ce
 * qu'il boit.
 */

const PATH = [4, 5, 6];

describe('3D-54 — le pion avance à vitesse constante', () => {
  it('démarre sur la case de départ', () => {
    const frame = walkFrame(PATH, 3, 0);

    expect(frame.from).toBe(3);
    expect(frame.to).toBe(4);
    expect(frame.progress).toBe(0);
  });

  it('donne le même temps à chaque case', () => {
    // Le pas 1 et le pas 3 doivent durer autant : c'est ce qui rend les
    // cases comptables à l'œil.
    const first = walkFrame(PATH, 3, WALK_MS_PER_TILE * 0.5);
    const third = walkFrame(PATH, 3, WALK_MS_PER_TILE * 2.5);

    expect(first.progress).toBeCloseTo(0.5, 5);
    expect(third.progress).toBeCloseTo(0.5, 5);
  });

  it('enchaîne les cases dans l\'ordre du chemin', () => {
    expect(walkFrame(PATH, 3, WALK_MS_PER_TILE * 0.5).to).toBe(4);
    expect(walkFrame(PATH, 3, WALK_MS_PER_TILE * 1.5).to).toBe(5);
    expect(walkFrame(PATH, 3, WALK_MS_PER_TILE * 2.5).to).toBe(6);
  });

  it('dure proportionnellement au nombre de cases', () => {
    expect(walkDuration(1)).toBe(WALK_MS_PER_TILE);
    expect(walkDuration(6)).toBe(WALK_MS_PER_TILE * 6);
  });
});

describe('3D-54 — la fin du déplacement', () => {
  it('se termine sur la dernière case du chemin', () => {
    const frame = walkFrame(PATH, 3, walkDuration(PATH.length));

    expect(frame.to).toBe(6);
    expect(frame.done).toBe(true);
  });

  it('reste sur la dernière case si on demande plus tard', () => {
    // Une image qui arrive en retard ne doit pas faire repartir le pion.
    const frame = walkFrame(PATH, 3, walkDuration(PATH.length) * 3);

    expect(frame.to).toBe(6);
    expect(frame.progress).toBe(1);
    expect(frame.done).toBe(true);
  });

  it('n\'est pas fini avant la dernière case', () => {
    const frame = walkFrame(PATH, 3, walkDuration(PATH.length) - 1);

    expect(frame.done).toBe(false);
  });
});

describe('3D-54 — le rebond se voit', () => {
  it('rejoue le retour case par case', () => {
    // Le chemin d'un 5 depuis la case 20 : on monte à 22, on redescend à 19.
    // L'animation doit montrer les cinq pas, pas un raccourci de 20 à 19.
    const rebound = [21, 22, 21, 20, 19];

    expect(walkFrame(rebound, 20, WALK_MS_PER_TILE * 1.5).to).toBe(22);
    expect(walkFrame(rebound, 20, WALK_MS_PER_TILE * 2.5).from).toBe(22);
    expect(walkFrame(rebound, 20, WALK_MS_PER_TILE * 2.5).to).toBe(21);
  });

  it('dure cinq pas pour un dé de 5, rebond compris', () => {
    const rebound = [21, 22, 21, 20, 19];

    expect(walkDuration(rebound.length)).toBe(WALK_MS_PER_TILE * 5);
  });
});

describe('3D-54 — les cas où il n\'y a rien à animer', () => {
  it('se termine immédiatement sur un chemin vide', () => {
    // Une flèche bloquée au bord ne déplace rien : l'animation ne doit pas
    // inventer un mouvement.
    const frame = walkFrame([], 7, 0);

    expect(frame.done).toBe(true);
    expect(frame.from).toBe(7);
    expect(frame.to).toBe(7);
  });

  it('ne recule pas dans le temps', () => {
    // Un `performance.now()` qui repart en arrière — cela arrive sur
    // certains appareils — ne doit pas faire remonter le pion.
    const frame = walkFrame(PATH, 3, -500);

    expect(frame.from).toBe(3);
    expect(frame.to).toBe(4);
    expect(frame.progress).toBe(0);
  });
});
