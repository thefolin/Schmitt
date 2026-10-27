import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RelayTransport } from '@/features/link/relay-transport';
import type { LinkStatus } from '@/features/link/transport';

/**
 * LE TRANSPORT PAR LE SERVEUR DU WIFI, côté navigateur (Quentin,
 * 27/10/2026 : un code temporaire, tout par le WiFi).
 *
 * `EventSource` n'existe pas dans jsdom : un faux le remplace, piloté par le
 * test comme le serveur le piloterait.
 */

class FakeSource extends EventTarget {
  public static last: FakeSource | null = null;
  public closed = false;
  public constructor(public readonly url: string) { super(); FakeSource.last = this; }
  public close() { this.closed = true; }
  public emit(type: string, data: unknown) {
    this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }));
  }
  public fail() { this.dispatchEvent(new Event('error')); }
}

let posted: { url: string; body?: unknown }[];
let replies: Record<string, { status: number; json?: unknown }>;

beforeEach(() => {
  posted = [];
  replies = {};
  vi.stubGlobal('EventSource', FakeSource);
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') posted.push({ url, body: init.body });
    const reply = Object.entries(replies).find(([suffix]) => url.includes(suffix))?.[1];
    if (!reply) throw new Error('réseau injoignable');
    return { status: reply.status, ok: reply.status < 300, json: async () => reply.json } as Response;
  }));
});

afterEach(() => vi.unstubAllGlobals());

async function hosted() {
  replies['/rooms'] = { status: 200, json: { pin: '0427', token: 'jeton+plateau' } };
  const result = (await RelayTransport.host('/__pair'))!;
  const seen: LinkStatus[] = [];
  result.transport.onStatus((s) => seen.push(s));
  return { ...result, source: FakeSource.last!, seen };
}

describe('Le relais est-il là ?', () => {
  it('oui quand il répond', async () => {
    replies['/ping'] = { status: 204 };
    expect(await RelayTransport.available('/__pair')).toBe(true);
  });

  it('non sur GitHub Pages, où rien ne répond', async () => {
    expect(await RelayTransport.available('/__pair')).toBe(false);
  });

  it('non quand la page répond autre chose', async () => {
    replies['/ping'] = { status: 404 };
    expect(await RelayTransport.available('/__pair')).toBe(false);
  });
});

describe('Le code', () => {
  it('le plateau reçoit le code à afficher, et écoute sa partie', async () => {
    const { pin, source } = await hosted();

    expect(pin).toBe('0427');
    expect(source.url).toBe('/__pair/rooms/0427/events?token=jeton%2Bplateau');
  });

  it('refuse un code qui n\'a pas 4 chiffres, sans rien demander au serveur', async () => {
    expect(await RelayTransport.join('42')).toBeNull();
    expect(await RelayTransport.join('12a4')).toBeNull();
    expect(posted).toEqual([]);
  });

  it('rend null pour un code faux, expiré ou déjà pris', async () => {
    replies['/rooms/9999/join'] = { status: 404 };
    expect(await RelayTransport.join('9999', '/__pair')).toBeNull();
  });

  it('rejoint avec un bon code', async () => {
    replies['/rooms/0427/join'] = { status: 200, json: { token: 'jeton-appareil' } };

    expect(await RelayTransport.join('0427', '/__pair')).not.toBeNull();
    expect(FakeSource.last!.url).toContain('/rooms/0427/events?token=jeton-appareil');
  });
});

describe('L\'état de la liaison', () => {
  it('attend tant que l\'autre appareil n\'a pas tapé le code', async () => {
    const { source, seen } = await hosted();

    source.emit('peer', false);
    source.fail();

    expect(seen).toEqual([]);
  });

  it('se dit reliée quand l\'autre arrive, perdue quand il part, reliée à son retour', async () => {
    const { source, seen } = await hosted();

    source.emit('peer', true);
    source.emit('peer', false);
    source.emit('peer', true);

    expect(seen).toEqual(['linked', 'lost', 'linked']);
  });

  it('signale la perte quand le flux tombe, une fois reliée', async () => {
    const { source, seen } = await hosted();
    source.emit('peer', true);

    source.fail();

    expect(seen).toEqual(['linked', 'lost']);
  });

  it('prévient un abonné arrivé après la liaison', async () => {
    const { transport, source } = await hosted();
    source.emit('peer', true);

    const late: LinkStatus[] = [];
    transport.onStatus((s) => late.push(s));

    expect(late).toEqual(['linked']);
  });
});

describe('Les messages', () => {
  it('arrivent tels quels, retours à la ligne compris', async () => {
    const { transport, source } = await hosted();
    const got: string[] = [];
    transport.onMessage((m) => got.push(m));

    source.emit('message', '{"a":1}\nsuite');

    expect(got).toEqual(['{"a":1}\nsuite']);
  });

  it('partent même si l\'autre est absent : le relais les garde', async () => {
    const { transport } = await hosted();
    replies['/send'] = { status: 204 };

    transport.send('face 5');
    await Promise.resolve();

    expect(posted.at(-1)).toEqual({ url: '/__pair/rooms/0427/send?token=jeton%2Bplateau', body: 'face 5' });
  });

  it('un envoi raté ne fait pas tomber la partie', async () => {
    const { transport } = await hosted();

    expect(() => transport.send('perdu')).not.toThrow();
    await Promise.resolve();
  });
});
