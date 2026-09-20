import { describe, it, expect } from 'vitest';
import {
  readDrafts,
  saveDrafts,
  defaultDrafts,
  toPlayers,
  addDraft,
  removeDraft,
  canAdd,
  canRemove,
  PLAYER_DRAFTS_KEY,
  PLAYER_COLORS,
  MIN_PLAYERS,
  MAX_PLAYERS,
  MAX_NAME_LENGTH,
  type PlayerDraft,
} from '@/features/game/player-drafts';

/**
 * Les joueurs d'une partie, retenus d'une soirée à l'autre.
 *
 * La scène 3D démarrait sur trois joueurs écrits en dur. Ce module est ce
 * qui la libère — et l'essentiel de ce qui se vérifie ici porte sur le
 * STOCKAGE, parce que c'est là que ça casse : il est partagé avec le reste
 * du site, il survit aux versions, et il peut refuser de répondre.
 */

function fakeStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));

  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

/** Un stockage qui refuse tout, comme en navigation privée. */
function hostileStorage(): Storage {
  return {
    getItem: () => {
      throw new Error('bloqué');
    },
    setItem: () => {
      throw new Error('bloqué');
    },
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

describe('joueurs — on démarre toujours avec de quoi jouer', () => {
  it('propose deux joueurs quand rien n\'a été rangé', () => {
    const drafts = readDrafts(fakeStorage());

    expect(drafts).toHaveLength(MIN_PLAYERS);
    expect(drafts[0].name).toBeTruthy();
    expect(drafts[0].color).toBeTruthy();
  });

  it('donne des couleurs DIFFÉRENTES aux joueurs par défaut', () => {
    // C'est à la couleur qu'on reconnaît son pion : deux pions identiques
    // rendraient la partie injouable dès le premier tour.
    const colors = defaultDrafts().map(draft => draft.color);

    expect(new Set(colors).size).toBe(colors.length);
  });
});

describe('joueurs — les noms survivent à la partie', () => {
  it('relit ce qui a été rangé', () => {
    const store = fakeStorage();
    const drafts: PlayerDraft[] = [
      { name: 'Quentin', color: '#e2483d' },
      { name: 'Bastien', color: '#3d7fc4' },
    ];

    saveDrafts(drafts, store);

    expect(readDrafts(store)).toEqual(drafts);
  });

  it('retient aussi une tablée de six', () => {
    const store = fakeStorage();
    const six = Array.from({ length: 6 }, (_, i) => ({
      name: `J${i}`,
      color: PLAYER_COLORS[i],
    }));

    saveDrafts(six, store);

    expect(readDrafts(store)).toHaveLength(6);
  });
});

describe('joueurs — ce qui sort du stockage est suspect', () => {
  it('ignore un contenu qui n\'est pas une liste', () => {
    // Le stockage est partagé avec le reste du site et survit aux versions :
    // une valeur écrite par un autre code ne doit pas empêcher de jouer.
    for (const junk of ['{}', '"texte"', '42', 'null', 'pas du json']) {
      expect(readDrafts(fakeStorage({ [PLAYER_DRAFTS_KEY]: junk }))).toHaveLength(
        MIN_PLAYERS
      );
    }
  });

  it('écarte les entrées mal formées', () => {
    const store = fakeStorage({
      [PLAYER_DRAFTS_KEY]: JSON.stringify([
        { name: 'Valide', color: '#e2483d' },
        { name: 42, color: '#3d7fc4' },
        { color: '#2f8f4e' },
        { name: 'Valide2', color: '#c9a227' },
      ]),
    });

    const drafts = readDrafts(store);

    expect(drafts.map(d => d.name)).toEqual(['Valide', 'Valide2']);
  });

  it('retombe sur le défaut s\'il ne reste pas assez de joueurs', () => {
    // Une seule entrée valide ne fait pas une partie.
    const store = fakeStorage({
      [PLAYER_DRAFTS_KEY]: JSON.stringify([{ name: 'Seul', color: '#e2483d' }]),
    });

    expect(readDrafts(store)).toHaveLength(MIN_PLAYERS);
  });

  it('tronque un nom démesuré', () => {
    // Un nom sans fin déborde du pion et du journal.
    const store = fakeStorage({
      [PLAYER_DRAFTS_KEY]: JSON.stringify([
        { name: 'x'.repeat(500), color: '#e2483d' },
        { name: 'Bob', color: '#3d7fc4' },
      ]),
    });

    expect(readDrafts(store)[0].name.length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
  });

  it('plafonne le nombre de joueurs', () => {
    const store = fakeStorage({
      [PLAYER_DRAFTS_KEY]: JSON.stringify(
        Array.from({ length: 50 }, (_, i) => ({ name: `J${i}`, color: '#e2483d' }))
      ),
    });

    expect(readDrafts(store).length).toBeLessThanOrEqual(MAX_PLAYERS);
  });
});

describe('joueurs — un stockage qui refuse ne casse pas le jeu', () => {
  it('démarre quand même en navigation privée', () => {
    expect(() => readDrafts(hostileStorage())).not.toThrow();
    expect(readDrafts(hostileStorage())).toHaveLength(MIN_PLAYERS);
  });

  it('laisse jouer même s\'il ne peut rien mémoriser', () => {
    // Le joueur perdra ses noms à la fermeture. C'est un désagrément, pas
    // une panne : refuser de jouer serait bien pire.
    expect(() => saveDrafts(defaultDrafts(), hostileStorage())).not.toThrow();
  });
});

describe('joueurs — ajouter et retirer', () => {
  it('ajoute une couleur encore LIBRE', () => {
    const drafts = addDraft(defaultDrafts());
    const colors = drafts.map(d => d.color);

    expect(drafts).toHaveLength(MIN_PLAYERS + 1);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('refuse d\'aller au-delà du maximum', () => {
    let drafts = defaultDrafts();
    for (let i = 0; i < 50; i += 1) drafts = addDraft(drafts);

    expect(drafts).toHaveLength(MAX_PLAYERS);
    expect(canAdd(drafts)).toBe(false);
  });

  it('refuse de descendre sous le minimum', () => {
    // À un joueur, le jeu n'a plus de sens : il fait boire les AUTRES.
    const drafts = removeDraft(defaultDrafts(), 0);

    expect(drafts).toHaveLength(MIN_PLAYERS);
    expect(canRemove(defaultDrafts())).toBe(false);
  });

  it('retire bien celui qu\'on désigne', () => {
    const three = addDraft(defaultDrafts());
    const left = removeDraft(three, 1);

    expect(left).toHaveLength(2);
    expect(left.map(d => d.name)).not.toContain(three[1].name);
  });
});

describe('joueurs — ce qui part dans la partie est corrigé', () => {
  it('remplace un nom vide plutôt que de le laisser passer', () => {
    // LE NOM SERT À DÉSIGNER QUI BOIT : « distribue 3 🍺 » sans nom ne dit
    // rien à personne, et c'est un jeu où l'on se sert mutuellement.
    const players = toPlayers([
      { name: '   ', color: '#e2483d' },
      { name: 'Bob', color: '#3d7fc4' },
    ]);

    expect(players[0].name).toBeTruthy();
    expect(players[0].name.trim()).toBe(players[0].name);
  });

  it('départage deux joueurs de la même couleur', () => {
    // C'EST LE POINT QUI CASSE UNE PARTIE : on reconnaît son pion à sa
    // couleur. Rien n'empêche deux joueurs de choisir la même dans le
    // formulaire — c'est ici que ça se rattrape.
    const players = toPlayers([
      { name: 'A', color: '#e2483d' },
      { name: 'B', color: '#e2483d' },
    ]);

    expect(players[0].color).not.toBe(players[1].color);
  });

  it('départage même une tablée entière de la même couleur', () => {
    const same = Array.from({ length: 6 }, (_, i) => ({
      name: `J${i}`,
      color: '#e2483d',
    }));

    const colors = toPlayers(same).map(p => p.color);

    expect(new Set(colors).size).toBe(colors.length);
  });

  it('laisse tranquilles des joueurs déjà corrects', () => {
    const clean = [
      { name: 'Quentin', color: '#e2483d' },
      { name: 'Bastien', color: '#3d7fc4' },
    ];

    expect(toPlayers(clean)).toEqual(clean);
  });
});
