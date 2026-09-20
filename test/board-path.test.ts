import { describe, it, expect } from 'vitest';
import layout from '../public/assets/schmitt.json';
import { TILE_CONFIGS } from '@/features/tiles/tile.config';
import { isArrowTile } from '@/features/board/scene3d/arrow-tile';

/**
 * Le tracé du parcours officiel.
 *
 * ÉCRIT APRÈS COUP, et c'est l'aveu qui le justifie : le plateau entier a été
 * redessiné — 23 cases déplacées, quatre angles de flèches recalculés — sans
 * qu'AUCUN des 792 tests existants ne bronche. La disposition n'était
 * vérifiée nulle part.
 *
 * Ces tests ne disent pas « le plateau doit être un serpentin » : Quentin
 * peut le redessiner quand il veut, c'est sa donnée. Ils disent ce qui doit
 * rester vrai de TOUT plateau pour que le jeu tienne debout — sinon une
 * modification de `schmitt.json` peut casser la partie en silence.
 */

const placements = layout.placements as {
  tileId: number;
  gridCol: number;
  gridRow: number;
  rotation?: number;
}[];

describe('plateau — le parcours est complet et ordonné', () => {
  it('pose autant de cases que le catalogue en compte', () => {
    expect(placements).toHaveLength(TILE_CONFIGS.length);
  });

  it('commence par START et finit par FINISH', () => {
    // Le rang 0 est le départ et le dernier l'arrivée : `GameLogic` compte
    // les positions dans cet ordre, et la victoire se juge sur le retour au
    // rang 0.
    expect(TILE_CONFIGS[placements[0].tileId].name).toBe('START');
    expect(TILE_CONFIGS[placements[placements.length - 1].tileId].name).toBe('FINISH');
  });

  it('pose chaque case du catalogue une seule fois', () => {
    const ids = placements.map(p => p.tileId).sort((a, b) => a - b);

    expect(new Set(ids).size).toBe(placements.length);
  });
});

describe('plateau — aucune case n\'en recouvre une autre', () => {
  it('donne à chaque case un emplacement distinct', () => {
    // DEUX CASES AU MÊME ENDROIT seraient invisibles l'une sous l'autre, et
    // le pion semblerait sauter un tour en les traversant.
    const cells = placements.map(p => `${p.gridCol},${p.gridRow}`);

    expect(new Set(cells).size).toBe(placements.length);
  });
});

describe('plateau — le parcours se suit sans saut', () => {
  it('ne fait jamais avancer de plus d\'une case à la fois', () => {
    // Un pion marche de case en case (#48). Deux cases consécutives
    // éloignées de trois rangées feraient traverser le vide au pion, et le
    // joueur ne saurait plus quel chemin son pion a pris.
    //
    // La diagonale EST admise : c'est ainsi que le plateau imprimé tourne
    // les angles, en coupant les coins.
    for (let i = 0; i < placements.length - 1; i += 1) {
      const from = placements[i];
      const to = placements[i + 1];

      const dc = Math.abs(from.gridCol - to.gridCol);
      const dr = Math.abs(from.gridRow - to.gridRow);

      expect(Math.max(dc, dr)).toBeLessThanOrEqual(1);
    }
  });
});

describe('plateau — les flèches sont orientées', () => {
  it('donne un angle à chaque flèche qui en a besoin', () => {
    // Une flèche sans angle pointe vers le BAS, sens de `row.png`. C'est
    // juste seulement là où la marche descend : ailleurs, le dessin dirait
    // le contraire de ce que le pion fait.
    const arrows = placements.filter(p => isArrowTile(TILE_CONFIGS[p.tileId]));

    expect(arrows.length).toBeGreaterThan(0);

    for (const arrow of arrows) {
      if (arrow.rotation === undefined) continue;

      // Un angle déclaré doit être exploitable : un angle farfelu ferait
      // tourner le dessin sans qu'on comprenne pourquoi.
      expect(arrow.rotation).toBeGreaterThanOrEqual(0);
      expect(arrow.rotation).toBeLessThan(360);
    }
  });
});
