import { describe, it, expect } from 'vitest';
import {
  getPawnBadges,
  renderPawnBadges,
  describePlayerStatuses,
  SCHMITT_POWER_BADGE,
  ZEUS_POWER_BADGE,
  CHICKEN_BADGES,
} from '@/features/board/camera/pawn-badges';
import { GameLogic } from '@/features/game/game.logic';
import type { Player } from '@/core/models/Player';

/**
 * SCH-17 — le Poulet doit se voir sur le plateau.
 * SCH-19 — le pouvoir du Schmitt ne doit pas se confondre avec celui de Zeus.
 *
 * « Ajouter un symbole a côté du pion qui est le petit/gros poulet 🐔 »
 * (14:21:24), puis « ajouter un logo permanent à côté du joueur 🐔 »
 * (14:39:43) — demandé deux fois par Bastien dans la même session.
 */

const player = (over: Partial<Player> = {}): Player => ({
  name: 'JOUEUR 1',
  color: '#f00',
  position: 0,
  hasSchmittPower: false,
  isReturning: false,
  hasLeftStartOnReturn: false,
  drinks: 0,
  hasAthenaShield: false,
  canReplay: false,
  chickenRank: 0,
  index: 0,
  ...over,
});

describe('SCH-17 — badges de Poulet', () => {
  it('un joueur sans statut ne porte aucun badge', () => {
    expect(getPawnBadges(player())).toEqual([]);
    expect(renderPawnBadges(player())).toBe('');
  });

  it('le Petit Poulet porte 🐤', () => {
    const badges = getPawnBadges(player({ chickenRank: 1 }));
    expect(badges).toHaveLength(1);
    expect(badges[0].icon).toBe('🐤');
  });

  it('le Gros Poulet porte 🐔', () => {
    const badges = getPawnBadges(player({ chickenRank: 2 }));
    expect(badges[0].icon).toBe('🐔');
  });

  it('les deux rangs sont visuellement distincts', () => {
    // Sans cela, la promotion resterait invisible — exactement ce que
    // Bastien a pris pour un bug de règle.
    expect(CHICKEN_BADGES[1].icon).not.toBe(CHICKEN_BADGES[2].icon);
  });

  it('le badge porte le nom du statut, pour lever toute ambiguïté', () => {
    const html = renderPawnBadges(player({ chickenRank: 2 }));
    expect(html).toContain('title="Gros Poulet"');
    expect(html).toContain('aria-label="Gros Poulet"');
  });
});

describe('SCH-19 — le Schmitt et Zeus ne portent pas le même symbole', () => {
  it('l\'éclair reste à Zeus', () => {
    expect(ZEUS_POWER_BADGE.icon).toBe('⚡');
  });

  it('le pouvoir du Schmitt porte un autre symbole', () => {
    // C'est la cause directe de la confusion de Bastien : il a vu ⚡ sur un
    // pion, a lu « Zeus », et a signalé l'absence de l'effet de Zeus.
    expect(SCHMITT_POWER_BADGE.icon).not.toBe(ZEUS_POWER_BADGE.icon);
  });

  it('le porteur du pouvoir du Schmitt est badgé', () => {
    const badges = getPawnBadges(player({ hasSchmittPower: true }));
    expect(badges).toHaveLength(1);
    expect(badges[0].icon).toBe(SCHMITT_POWER_BADGE.icon);
  });

  it('le statut est écrit en toutes lettres dans la liste des joueurs', () => {
    // Un badge muet se prête à l'interprétation ; le libellé tranche.
    expect(describePlayerStatuses(player({ hasSchmittPower: true }))).toEqual([
      `${SCHMITT_POWER_BADGE.icon} Pouvoir du Schmitt`,
    ]);
  });
});

describe('badges cumulés', () => {
  it('un Poulet qui détient le pouvoir porte les deux badges', () => {
    const badges = getPawnBadges(player({ hasSchmittPower: true, chickenRank: 1 }));

    expect(badges.map(b => b.icon)).toEqual([SCHMITT_POWER_BADGE.icon, '🐤']);
  });

  it('les deux badges tiennent dans un seul conteneur', () => {
    const html = renderPawnBadges(player({ hasSchmittPower: true, chickenRank: 2 }));

    expect(html.match(/pawn-badges/g)).toHaveLength(1);
    expect(html.match(/pawn-badge"/g)).toHaveLength(2);
  });
});

describe('SCH-17 — le badge est bien posé sur le pion, et il y reste', () => {
  it('apparaît sur le pion et survit à une mise à jour du plateau', async () => {
    const { BoardCameraRenderer } = await import(
      '@/features/board/camera/board.renderer.camera'
    );
    const { TILE_CONFIGS } = await import('@/features/tiles/tile.config');

    document.body.innerHTML = '<div id="boardCamera"></div>';
    const renderer = new BoardCameraRenderer('boardCamera');
    // @ts-expect-error — injection directe du layout, comme dans custom-board
    renderer.boardLayout = {
      gridRows: 1,
      gridCols: 2,
      tileSize: 120,
      tileGap: 15,
      placements: [0, 1].map((tileId, i) => ({
        tileId,
        gridRow: 0,
        gridCol: i,
        size: 'full' as const,
      })),
    };

    const players = [
      player({ chickenRank: 2, index: 0 }),
      player({ name: 'JOUEUR 2', index: 1, position: 1, hasSchmittPower: true }),
    ];

    renderer.render(TILE_CONFIGS, players);
    // Le plateau est redessiné à chaque tour : le badge doit suivre le pion
    // sans se dupliquer.
    renderer.render(TILE_CONFIGS, players);

    const pawns = Array.from(document.querySelectorAll('.board-pawn'));
    expect(pawns).toHaveLength(2);

    expect(pawns[0].querySelectorAll('.pawn-badges')).toHaveLength(1);
    expect(pawns[0].querySelector('.pawn-badge')?.textContent).toBe('🐔');
    expect(pawns[1].querySelector('.pawn-badge')?.textContent).toBe(
      SCHMITT_POWER_BADGE.icon
    );
  });
});

describe('SCH-17 — le badge suit la règle du Poulet', () => {
  const players = [
    { name: 'Alice', color: '#f00' },
    { name: 'Bob', color: '#0f0' },
  ];

  it('marque le joueur qui devient Petit Poulet', () => {
    const g = new GameLogic();
    g.startGame(players);
    g.setChicken(0);

    expect(g.getPlayers()[0].chickenRank).toBe(1);
    expect(g.getPlayers()[1].chickenRank).toBe(0);
  });

  it('passe le badge à 🐔 lors de la promotion', () => {
    const g = new GameLogic();
    g.startGame(players);
    g.setChicken(0);
    g.setChicken(0);

    expect(g.getPlayers()[0].chickenRank).toBe(2);
    expect(getPawnBadges(g.getPlayers()[0])[0].icon).toBe('🐔');
  });

  it('un seul joueur porte le badge à la fois', () => {
    const g = new GameLogic();
    g.startGame(players);
    g.setChicken(0);
    g.setChicken(1); // Bob reprend la place

    expect(g.getPlayers()[0].chickenRank).toBe(0);
    expect(g.getPlayers()[1].chickenRank).toBe(1);
  });

  it('une nouvelle partie efface les badges', () => {
    const g = new GameLogic();
    g.startGame(players);
    g.setChicken(0);
    g.setChicken(0);

    g.startGame(players);

    expect(g.getPlayers().every(p => p.chickenRank === 0)).toBe(true);
  });
});
