import { describe, it, expect } from 'vitest';
import {
  GULP,
  withGulpSymbol,
  buildActionText,
  buildSubtitle,
} from '@/features/game/action-text';
import type { TileConfig } from '@/core/models/Tile';

/**
 * SCH-11, SCH-12, SCH-13 — le langage des écrans d'action.
 *
 * Trois retours de Bastien du 18/09/2026 qui portent sur le même endroit :
 *  - « Le texte est répété 2 fois. » (14:20:05, captures 00000020 / 00000033)
 *  - « Remplacez de manière générale tous les mots [gorgées] par [🍺] » (14:30:13)
 *  - « Pour le texte en gros écrire : JOUEUR 2 Reçoit 1🍺 » (14:24:39)
 */

const tile = (over: Partial<TileConfig>): TileConfig => ({
  type: 'drink_2' as TileConfig['type'],
  icon: '🍺',
  name: 'BUVEZ 2 GORGÉES',
  description: 'Buvez 2 gorgées',
  ...over,
});

describe('SCH-12 — « gorgées » s\'écrit 🍺', () => {
  it('remplace le pluriel', () => {
    expect(withGulpSymbol('Buvez 2 gorgées')).toBe(`Buvez 2 ${GULP}`);
  });

  it('remplace le singulier', () => {
    expect(withGulpSymbol('Boit 1 gorgée')).toBe(`Boit 1 ${GULP}`);
  });

  it('remplace quelle que soit la casse', () => {
    expect(withGulpSymbol('BUVEZ 2 GORGÉES')).toBe(`BUVEZ 2 ${GULP}`);
  });

  it('conserve le nombre', () => {
    expect(withGulpSymbol('4 gorgées')).toBe(`4 ${GULP}`);
  });

  it('traite plusieurs occurrences dans la même phrase', () => {
    expect(withGulpSymbol('1 gorgée puis 2 gorgées')).toBe(`1 ${GULP} puis 2 ${GULP}`);
  });

  it('laisse le reste du texte intact', () => {
    expect(withGulpSymbol('Le dernier à crier SCHMITT boit')).toBe(
      'Le dernier à crier SCHMITT boit'
    );
  });
});

describe('SCH-13 — le texte principal nomme le joueur', () => {
  it('nomme celui qui subit sur une case « boire »', () => {
    expect(buildActionText(tile({}), 'JOUEUR 2')).toBe(`JOUEUR 2 reçoit 2 ${GULP}`);
  });

  it('lit le vrai multiplicateur, pas celui du type', () => {
    // Une case peut porter un `amount` différent de son type : c'est ce qui
    // permet à une seule illustration de servir pour x2, x3 et x4.
    const t = tile({ type: 'drink_2' as TileConfig['type'], amount: 4 });
    expect(buildActionText(t, 'JOUEUR 1')).toBe(`JOUEUR 1 reçoit 4 ${GULP}`);
  });

  it('dit « distribue » quand le joueur donne, pas « reçoit »', () => {
    // Le motif de Bastien vient du Petit Poulet, qui subit. L'appliquer
    // littéralement à une case « distribuez » dirait le contraire de la règle.
    const t = tile({
      type: 'distribute_2' as TileConfig['type'],
      name: 'DISTRIBUEZ 2 GORGÉES',
      amount: 2,
    });
    expect(buildActionText(t, 'JOUEUR 3')).toBe(`JOUEUR 3 distribue 2 ${GULP}`);
  });

  it('ne nomme personne sur une tournée générale', () => {
    const t = tile({
      type: 'everyone_drinks' as TileConfig['type'],
      name: 'TOURNÉE GÉNÉRALE',
      description: 'Tous les joueurs boivent 1 gorgée',
      amount: undefined,
    });
    expect(buildActionText(t, 'JOUEUR 1')).toBe(`Tout le monde reçoit 1 ${GULP}`);
  });

  it('laisse leur libellé aux cases qui ne sont pas des actions chiffrées', () => {
    const start = tile({ type: 'start' as TileConfig['type'], name: 'START', amount: undefined });
    expect(buildActionText(start, 'JOUEUR 1')).toBeNull();
  });
});

describe('SCH-11 — aucun texte affiché deux fois', () => {
  it('supprime le sous-titre qui recopie le titre', () => {
    // Capture 00000033 : « BUVEZ 4 GORGÉES » + « Buvez 4 gorgées ».
    const t = tile({ name: 'BUVEZ 4 GORGÉES', description: 'Buvez 4 gorgées', amount: 4 });
    const main = buildActionText(t, 'JOUEUR 2');

    expect(buildSubtitle(t, main)).toBe('');
  });

  it('supprime aussi le sous-titre qui recopie le texte principal', () => {
    const t = tile({ name: 'AUTRE TITRE', description: 'Joueur 2 reçoit 2 gorgées' });
    expect(buildSubtitle(t, `JOUEUR 2 reçoit 2 ${GULP}`)).toBe('');
  });

  it('garde un sous-titre qui apporte une information', () => {
    const t = tile({
      type: 'schmitt_call' as TileConfig['type'],
      name: 'SCHMITT !!!',
      description: 'Le dernier à crier SCHMITT boit',
      amount: undefined,
    });
    expect(buildSubtitle(t, null)).toBe('Le dernier à crier SCHMITT boit');
  });

  it('applique 🍺 au sous-titre conservé', () => {
    const t = tile({
      type: 'everyone_drinks' as TileConfig['type'],
      name: 'TOURNÉE GÉNÉRALE',
      description: 'Tous les joueurs boivent 1 gorgée',
      amount: undefined,
    });
    expect(buildSubtitle(t, null)).toBe(`Tous les joueurs boivent 1 ${GULP}`);
  });

  it('supprime une reformulation, pas seulement une copie littérale', () => {
    // Capture du plateau officiel : « Tout le monde reçoit 1 🍺 » suivi de
    // « Tous les joueurs boivent 1 🍺 ». Les mots diffèrent, la phrase non.
    const t = tile({
      type: 'everyone_drinks' as TileConfig['type'],
      name: 'TOURNÉE GÉNÉRALE',
      description: 'Tous les joueurs boivent 1 gorgée',
      amount: undefined,
    });
    const main = buildActionText(t, 'JOUEUR 1');

    expect(main).toBe(`Tout le monde reçoit 1 ${GULP}`);
    expect(buildSubtitle(t, main)).toBe('');
  });

  it('ignore casse, accents et ponctuation pour juger de la répétition', () => {
    const t = tile({ name: 'AVANCEZ DE 2 CASES', description: 'Avancez de 2 cases.' });
    expect(buildSubtitle(t, null)).toBe('');
  });

  it('tolère une case sans description', () => {
    const t = tile({ description: undefined });
    expect(buildSubtitle(t, null)).toBe('');
  });
});

describe('SCH-11 — sur le plateau officiel', () => {
  it('aucune case ne présente deux fois la même phrase', async () => {
    const board = await import('../public/data/board-tiles.json');
    const tiles = board.tiles as TileConfig[];

    const repeated = tiles.filter(t => {
      const main = buildActionText(t, 'JOUEUR 1');
      const subtitle = buildSubtitle(t, main);
      if (!subtitle) return false;
      const shown = [t.name, main, subtitle].filter(Boolean) as string[];
      return new Set(shown.map(s => s.toLowerCase())).size !== shown.length;
    });

    expect(repeated).toEqual([]);
  });
});
