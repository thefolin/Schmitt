import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showPairingScreen, type PairingDeps } from '@/features/link/pairing-screen';
import type { LinkStatus, Transport } from '@/features/link/transport';

/**
 * L'ÉCRAN D'APPAIRAGE (épique 8, lot D3).
 *
 * Caméra et WebRTC sont simulés : on suit le parcours du joueur, de « quel
 * rôle ? » à la liaison ouverte, et l'on vérifie qu'abandonner ne laisse
 * rien derrière.
 */

// De vrais codes, au format de `pairing-code.ts`, pour que le tri du scanner joue.
const PRINT = 'q'.repeat(43);
const OFFER = `S1|o|abcd|abcdefghijklmnopqrstuv|${PRINT}|192.168.1.20:54321`;
const ANSWER = `S1|a|wxyz|abcdefghijklmnopqrstuv|${PRINT}|192.168.1.21:54322`;

class FakeTransport implements Transport {
  public closed = false;
  private listeners = new Set<(s: LinkStatus) => void>();
  public send() {}
  public onMessage() { return () => {}; }
  public onStatus(l: (s: LinkStatus) => void) { this.listeners.add(l); return () => this.listeners.delete(l); }
  public close() { this.closed = true; }
  public open() { for (const l of this.listeners) l('linked'); }
}

/** Un scanner piloté : le test décide de ce que la caméra « voit ». */
function fakeScanner() {
  const state = {
    stopped: 0,
    accept: null as ((text: string) => boolean) | null,
    resolve: (_: string | null) => {},
  };
  const scan: PairingDeps['scan'] = (_video, accept) => {
    state.accept = accept;
    const result = new Promise<string | null>((r) => (state.resolve = r));
    return { result, stop: () => { state.stopped++; state.resolve(null); } };
  };
  /** La caméra voit `texts` ; seul le premier accepté est rendu. */
  const sees = async (...texts: string[]) => {
    const found = texts.find((t) => state.accept!(t));
    if (found) state.resolve(found);
    await flush();
  };
  return { state, scan, sees };
}

const flush = () => vi.advanceTimersByTimeAsync(0);
const click = async (id: string) => { document.getElementById(id)!.click(); await flush(); };
const step = () => document.getElementById('link-step')!.textContent;
// `hidden` NE SUFFIT PAS sous `.setup-screen`, qui pose `display: flex` : c'est
// le défaut vu deux fois sur l'APK. Un élément n'est caché que si son
// `display` le dit aussi — jsdom ne calcule pas la feuille, on lit donc le style.
const visible = (id: string) => {
  const element = document.getElementById(id)!;
  return element.style.display !== 'none';
};
const qrShown = () => visible('link-qr');
const cameraShown = () => visible('link-camera');

let transport: FakeTransport;
let scanner: ReturnType<typeof fakeScanner>;
let accepted: string[];
let deps: PairingDeps;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
  transport = new FakeTransport();
  scanner = fakeScanner();
  accepted = [];
  deps = {
    host: async () => ({ transport, code: OFFER, accept: async (a) => { accepted.push(a); return true; } }),
    join: async () => ({ transport, code: ANSWER }),
    scan: scanner.scan,
    joinBase: () => 'https://192.168.1.15:3001/index-3d.html',
    // SANS RELAIS par défaut : ces tests-là suivent le parcours par QR, celui
    // d'une page servie par GitHub Pages. Le parcours par code a les siens.
    relay: {
      available: async () => false,
      host: async () => null,
      join: async () => null,
    },
  };
});

afterEach(() => vi.useRealTimers());

describe('Le plateau : affiche, puis scanne la réponse', () => {
  it('va jusqu\'à la liaison et rend le rôle de maître', async () => {
    const pairing = showPairingScreen(document.body, deps);
    await click('link-as-master');

    expect(qrShown()).toBe(true);
    expect(document.querySelector('#link-qr svg')).not.toBeNull();

    await click('link-scan-answer');
    expect(cameraShown()).toBe(true);
    expect(qrShown()).toBe(false);

    await scanner.sees(ANSWER);
    transport.open();

    expect(accepted).toEqual([ANSWER]);
    expect(await pairing).toEqual({ role: 'master', transport });
    expect(document.getElementById('link-screen')).toBeNull();
  });

  it('ne prend pas sa propre offre pour une réponse', async () => {
    // Le plateau peut se voir en reflet, ou voir un autre plateau.
    void showPairingScreen(document.body, deps);
    await click('link-as-master');
    await click('link-scan-answer');

    await scanner.sees(OFFER, 'https://menu.example');

    expect(accepted).toEqual([]);
    expect(cameraShown()).toBe(true);
  });
});

describe('La manette : scanne, puis affiche sa réponse', () => {
  it('va jusqu\'à la liaison et rend le rôle d\'esclave', async () => {
    const pairing = showPairingScreen(document.body, deps);
    await click('link-as-slave');
    expect(cameraShown()).toBe(true);

    await scanner.sees(ANSWER, OFFER);
    expect(qrShown()).toBe(true);
    expect(step()).toMatch(/Montrez ce code au plateau/);

    transport.open();

    expect(await pairing).toEqual({ role: 'slave', transport });
  });

  it('ne retient qu\'une offre, pas la réponse d\'une autre manette', async () => {
    void showPairingScreen(document.body, deps);
    await click('link-as-slave');

    await scanner.sees(ANSWER);

    expect(cameraShown()).toBe(true);
    expect(qrShown()).toBe(false);
  });
});

describe('Abandonner ne laisse rien derrière', () => {
  it('rend la caméra et ferme la voie à moitié ouverte', async () => {
    const pairing = showPairingScreen(document.body, deps);
    await click('link-as-master');
    await click('link-scan-answer');

    await click('link-cancel');

    expect(await pairing).toBeNull();
    expect(scanner.state.stopped).toBeGreaterThan(0);
    expect(transport.closed).toBe(true);
    expect(document.getElementById('link-screen')).toBeNull();
  });
});

describe('Un échec se dit, et se rattrape', () => {
  it('signale une liaison qui ne s\'ouvre pas, au lieu de rester figé', async () => {
    // Deux appareils sur deux WiFi différents : les QR passent, la voie non.
    void showPairingScreen(document.body, deps);
    await click('link-as-slave');
    await scanner.sees(OFFER);

    await vi.advanceTimersByTimeAsync(15000);

    expect(step()).toMatch(/même WiFi/);
    expect(transport.closed).toBe(true);
    expect(document.getElementById('link-retry')).not.toBeNull();
  });

  it('signale une réponse refusée', async () => {
    deps.host = async () => ({ transport, code: OFFER, accept: async () => false });
    void showPairingScreen(document.body, deps);
    await click('link-as-master');
    await click('link-scan-answer');

    await scanner.sees(ANSWER);

    expect(document.getElementById('link-retry')).not.toBeNull();
  });

  it('« Recommencer » ramène au choix du rôle', async () => {
    void showPairingScreen(document.body, deps);
    await click('link-as-slave');
    await scanner.sees(OFFER);
    await vi.advanceTimersByTimeAsync(15000);

    await click('link-retry');

    expect(document.getElementById('link-as-master')).not.toBeNull();
  });
});

describe('L\'appareil photo du téléphone suffit', () => {
  // Quentin (27/10/2026) : scanné à l'appareil photo, le QR « ne redirige
  // pas vers l'application ou le web ».
  it('le QR du plateau porte un LIEN vers le jeu, que l\'appareil photo ouvre', async () => {
    void showPairingScreen(document.body, deps);
    await click('link-as-master');

    const text = document.getElementById('link-qr')!.dataset.text!;
    expect(text.startsWith('https://192.168.1.15:3001/index-3d.html#join=')).toBe(true);
  });

  it('garde le code brut quand la page n\'est joignable que d\'elle-même (APK)', async () => {
    deps.joinBase = () => 'https://localhost/index.html';
    void showPairingScreen(document.body, deps);
    await click('link-as-master');

    expect(document.getElementById('link-qr')!.dataset.text).toBe(OFFER);
  });

  it('ouverte par ce lien, la page passe droit à la réponse, sans caméra', async () => {
    const pairing = showPairingScreen(document.body, deps, OFFER);
    await flush();

    expect(document.getElementById('link-as-master')).toBeNull();
    expect(cameraShown()).toBe(false);
    expect(document.getElementById('link-qr')!.dataset.text).toBe(ANSWER);

    transport.open();
    expect(await pairing).toEqual({ role: 'slave', transport });
  });
});

describe('Le code à 4 chiffres, par le serveur du WiFi', () => {
  // Quentin (27/10/2026) : la caméra du Mac lisait mal le QR ; il veut « un
  // code temporaire pour rentrer sur la partie », par le WiFi.
  let joined: string[];

  beforeEach(() => {
    joined = [];
    deps.relay = {
      available: async () => true,
      host: async () => ({ transport, pin: '0427' }),
      join: async (pin) => {
        joined.push(pin);
        return pin === '0427' ? transport : null;
      },
    };
  });

  const type = async (code: string) => {
    (document.getElementById('link-code') as HTMLInputElement).value = code;
    await click('link-join');
  };

  it('le plateau affiche le code, sans caméra ni QR', async () => {
    void showPairingScreen(document.body, deps);
    await click('link-as-master');

    expect(document.getElementById('link-pin')!.textContent).toBe('0427');
    expect(visible('link-pin')).toBe(true);
    expect(cameraShown()).toBe(false);
    expect(qrShown()).toBe(false);
  });

  it('l\'autre appareil tape le code et la liaison s\'ouvre', async () => {
    const pairing = showPairingScreen(document.body, deps);
    await click('link-as-slave');
    expect(visible('link-code-form')).toBe(true);

    await type('0427');
    transport.open();

    expect(joined).toEqual(['0427']);
    expect(await pairing).toEqual({ role: 'slave', transport });
  });

  it('le plateau se relie quand l\'autre a tapé le code', async () => {
    const pairing = showPairingScreen(document.body, deps);
    await click('link-as-master');

    transport.open();

    expect(await pairing).toEqual({ role: 'master', transport });
  });

  it('un code faux reste sur la saisie et dit quoi vérifier', async () => {
    void showPairingScreen(document.body, deps);
    await click('link-as-slave');

    await type('1111');

    expect(visible('link-code-form')).toBe(true);
    expect(document.getElementById('link-code-error')!.textContent).toMatch(/inconnu ou expiré/);
  });

  it('le plateau attend un humain : pas d\'échec au bout de 15 s', async () => {
    void showPairingScreen(document.body, deps);
    await click('link-as-master');

    await vi.advanceTimersByTimeAsync(60000);

    expect(document.getElementById('link-pin')!.textContent).toBe('0427');
    expect(document.getElementById('link-retry')).toBeNull();
  });

  it('mais dit que le code a expiré au bout de deux minutes', async () => {
    void showPairingScreen(document.body, deps);
    await click('link-as-master');

    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

    expect(step()).toMatch(/expiré/);
    expect(transport.closed).toBe(true);
  });

  it('les QR codes restent à portée d\'un bouton', async () => {
    void showPairingScreen(document.body, deps);
    await click('link-as-master');

    await click('link-use-qr');

    expect(transport.closed).toBe(true);
    expect(document.querySelector('#link-qr svg')).not.toBeNull();
  });

  it('sans relais (GitHub Pages), on passe directement aux QR', async () => {
    deps.relay.available = async () => false;
    void showPairingScreen(document.body, deps);
    await click('link-as-master');

    expect(visible('link-pin')).toBe(false);
    expect(document.querySelector('#link-qr svg')).not.toBeNull();
  });
});
