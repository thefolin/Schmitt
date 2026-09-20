import { describe, it, expect } from 'vitest';
import {
  readCinemaMode,
  writeCinemaMode,
  toggleCinemaMode,
  rollSpan,
  CINEMA_KEY,
  CINEMA_DEFAULT,
  CINEMA_SPAN_TILES,
} from '@/features/board/scene3d/cinema-mode';

/**
 * EPIC-8 #53 — le joueur choisit son mode, et le choix lui reste.
 *
 * Le réglage vit dans le stockage du navigateur, qui est le seul endroit où
 * une préférence survit à la fermeture de l'application. C'est aussi le seul
 * endroit qui peut ÉCHOUER pour des raisons qui n'ont rien à voir avec le
 * jeu : navigation privée, données bloquées, quota plein. Ces cas-là sont la
 * moitié des tests, parce qu'ils sont la moitié du risque.
 */

/** Un stockage en mémoire, qui se comporte comme celui du navigateur. */
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
      throw new Error('stockage bloqué');
    },
    setItem: () => {
      throw new Error('stockage bloqué');
    },
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

describe('EPIC-8 #53 — le mode par défaut', () => {
  it('démarre en mode plateau', () => {
    // Un joueur qui n'a rien demandé ne doit pas voir son plateau disparaître
    // au premier lancer.
    expect(CINEMA_DEFAULT).toBe(false);
    expect(readCinemaMode(fakeStorage())).toBe(false);
  });

  it('garde le défaut quand rien n\'a jamais été rangé', () => {
    expect(readCinemaMode(fakeStorage({}))).toBe(CINEMA_DEFAULT);
  });
});

describe('EPIC-8 #53 — le choix survit à la partie', () => {
  it('relit ce qui a été rangé', () => {
    const store = fakeStorage();

    writeCinemaMode(true, store);

    expect(readCinemaMode(store)).toBe(true);
  });

  it('relit aussi un retour au mode plateau', () => {
    const store = fakeStorage({ [CINEMA_KEY]: 'true' });

    writeCinemaMode(false, store);

    expect(readCinemaMode(store)).toBe(false);
  });

  it('bascule d\'un mode à l\'autre', () => {
    const store = fakeStorage();

    expect(toggleCinemaMode(store)).toBe(true);
    expect(readCinemaMode(store)).toBe(true);

    expect(toggleCinemaMode(store)).toBe(false);
    expect(readCinemaMode(store)).toBe(false);
  });
});

describe('EPIC-8 #53 — un stockage qui refuse ne casse pas le jeu', () => {
  it('lit le défaut plutôt que de jeter', () => {
    // C'EST LE POINT : en navigation privée, `getItem` JETTE. Une exception
    // ici empêcherait la scène de démarrer — pour un réglage d'affichage.
    expect(() => readCinemaMode(hostileStorage())).not.toThrow();
    expect(readCinemaMode(hostileStorage())).toBe(CINEMA_DEFAULT);
  });

  it('accepte le changement même s\'il ne peut pas le mémoriser', () => {
    // Le mode s'applique pour la partie en cours et sera oublié ensuite.
    // Refuser le changement reviendrait à punir le joueur pour un réglage de
    // son navigateur.
    expect(() => writeCinemaMode(true, hostileStorage())).not.toThrow();
    expect(writeCinemaMode(true, hostileStorage())).toBe(true);
  });

  it('ne jette pas non plus en basculant', () => {
    expect(() => toggleCinemaMode(hostileStorage())).not.toThrow();
  });
});

describe('EPIC-8 #53 — une valeur abîmée ne vaut pas « oui »', () => {
  it('traite un contenu inattendu comme un refus', () => {
    // Le stockage est partagé avec le reste du site et survit aux versions :
    // une valeur écrite par un autre code, ou par une version antérieure, ne
    // doit pas allumer le mode cinéma par accident.
    for (const junk of ['1', 'oui', 'TRUE', '{}', '']) {
      expect(readCinemaMode(fakeStorage({ [CINEMA_KEY]: junk }))).toBe(false);
    }
  });
});

describe('EPIC-8 #54 — le cadre du lancer dit le mode', () => {
  const TILE = 120;
  const BOARD = 11;

  it('resserre le cadre en mode cinéma', () => {
    expect(rollSpan(true, TILE, BOARD)).toBe(CINEMA_SPAN_TILES * TILE);
  });

  it('garde le cadre du plateau sinon', () => {
    expect(rollSpan(false, TILE, BOARD)).toBe(BOARD * TILE);
  });

  it('donne bien un cadre PLUS SERRÉ, ce qui est tout le mode', () => {
    // C'EST LA LIVRAISON de la vue cinéma : le dé occupe l'écran au lieu
    // d'être un objet parmi les cases. Si ce cadre cessait d'être plus
    // serré, le mode n'aurait plus aucun effet visible.
    expect(rollSpan(true, TILE, BOARD)).toBeLessThan(rollSpan(false, TILE, BOARD));
  });
});
