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
