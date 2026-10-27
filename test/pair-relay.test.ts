// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Rooms, relayMiddleware, WAITING_TTL_MS, IDLE_TTL_MS, type RelayEvent } from '../server/pair-relay';

/**
 * LE RELAIS DU WIFI (Quentin, 27/10/2026 : un code temporaire, et « que
 * cela passe par le wifi »).
 */

/** Un appareil branché, qui note ce qu'il reçoit. */
function device(rooms: Rooms, pin: string, side: 'host' | 'guest') {
  const got: RelayEvent[] = [];
  const detach = rooms.attach(pin, side, (e) => got.push(e));
  return { got, detach, messages: () => got.filter((e) => e.type === 'message').map((e) => (e as { text: string }).text) };
}

describe('Le code à 4 chiffres', () => {
  it('a quatre chiffres, zéros compris', () => {
    const rooms = new Rooms(Date.now, () => 0.0042);

    expect(rooms.create().pin).toBe('0042');
  });

  it('n\'est jamais celui d\'une partie encore ouverte', () => {
    // Le hasard tire deux fois 1234 : le second doit en prendre un autre.
    // Six tirages à 0.1234 : le code du premier, les quatre de son jeton,
    // puis le premier essai du second code — qui tombe donc sur 1234.
    let calls = 0;
    const rooms = new Rooms(Date.now, () => (++calls <= 6 ? 0.1234 : 0.5678));

    const first = rooms.create().pin;
    const second = rooms.create().pin;

    expect(first).toBe('1234');
    expect(second).not.toBe('1234');
  });

  it('ne sert qu\'une fois : un second appareil ne s\'immisce pas', () => {
    const rooms = new Rooms();
    const { pin } = rooms.create();

    expect(rooms.join(pin)).not.toBeNull();
    expect(rooms.join(pin)).toBeNull();
  });

  it('refuse un code qui n\'existe pas', () => {
    expect(new Rooms().join('9999')).toBeNull();
  });

  it('expire au bout de deux minutes s\'il n\'a pas servi', () => {
    let now = 0;
    const rooms = new Rooms(() => now);
    const { pin } = rooms.create();

    now = WAITING_TTL_MS + 1;

    expect(rooms.join(pin)).toBeNull();
  });

  it('n\'expire pas pendant la partie, même longue', () => {
    let now = 0;
    const rooms = new Rooms(() => now);
    const { pin, token } = rooms.create();
    rooms.join(pin);
    device(rooms, pin, 'host');

    now = WAITING_TTL_MS + IDLE_TTL_MS * 5;
    rooms.sweep();

    expect(rooms.side(pin, token)).toBe('host');
  });
});

describe('Les messages passent d\'un appareil à l\'autre', () => {
  function paired() {
    const rooms = new Rooms();
    const { pin } = rooms.create();
    rooms.join(pin);
    return { rooms, pin };
  }

  it('dans les deux sens', () => {
    const { rooms, pin } = paired();
    const host = device(rooms, pin, 'host');
    const guest = device(rooms, pin, 'guest');

    rooms.send(pin, 'guest', 'lance');
    rooms.send(pin, 'host', 'face 4');

    expect(host.messages()).toEqual(['lance']);
    expect(guest.messages()).toEqual(['face 4']);
  });

  it('chacun sait quand l\'autre arrive et part', () => {
    const { rooms, pin } = paired();
    const host = device(rooms, pin, 'host');
    expect(host.got).toEqual([{ type: 'peer', up: false }]);

    const guest = device(rooms, pin, 'guest');
    expect(guest.got[0]).toEqual({ type: 'peer', up: true });
    expect(host.got.at(-1)).toEqual({ type: 'peer', up: true });

    guest.detach();
    expect(host.got.at(-1)).toEqual({ type: 'peer', up: false });
  });

  it('garde les messages d\'un téléphone en veille, et les lui rend', () => {
    const { rooms, pin } = paired();
    device(rooms, pin, 'host');

    rooms.send(pin, 'host', 'face 2');
    rooms.send(pin, 'host', 'face 6');
    const guest = device(rooms, pin, 'guest');

    expect(guest.messages()).toEqual(['face 2', 'face 6']);
  });

  it('un rebranchement ne se fait pas couper par l\'ancien flux', () => {
    // Le navigateur rouvre son flux avant que l'ancien ne soit fermé.
    const { rooms, pin } = paired();
    const host = device(rooms, pin, 'host');
    const oldGuest = device(rooms, pin, 'guest');
    const newGuest = device(rooms, pin, 'guest');

    oldGuest.detach();
    rooms.send(pin, 'host', 'toujours là ?');

    expect(newGuest.messages()).toEqual(['toujours là ?']);
    expect(host.got.at(-1)).toEqual({ type: 'peer', up: true });
  });
});

describe('Par le vrai serveur HTTP', () => {
  let server: Server;
  let base: string;

  let streams: AbortController;

  afterEach(async () => {
    streams.abort();
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  });

  async function start() {
    streams = new AbortController();
    server = createServer(relayMiddleware(new Rooms()) as never);
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/__pair`;
  }

  /** Lit un flux SSE jusqu'à `count` événements. */
  async function readEvents(url: string, count: number, abort: AbortController) {
    const response = await fetch(url, { signal: abort.signal });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const events: { event: string; data: unknown }[] = [];
    let buffer = '';

    while (events.length < count) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let end: number;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const event = block.match(/^event: (.*)$/m)?.[1];
        const data = block.match(/^data: (.*)$/m)?.[1];
        if (event && data !== undefined) events.push({ event, data: JSON.parse(data) });
      }
    }

    return events;
  }

  it('relie deux appareils par le code, et transporte un message', async () => {
    await start();
    expect((await fetch(`${base}/ping`)).status).toBe(204);

    const { pin, token: hostToken } = await (await fetch(`${base}/rooms`, { method: 'POST' })).json();
    const { token: guestToken } = await (await fetch(`${base}/rooms/${pin}/join`, { method: 'POST' })).json();

    // Le plateau écoute : seul, puis l'autre arrive, puis un message.
    const hostEvents = readEvents(`${base}/rooms/${pin}/events?token=${hostToken}`, 3, streams);
    await new Promise((r) => setTimeout(r, 50));
    void readEvents(`${base}/rooms/${pin}/events?token=${guestToken}`, 99, streams).catch(() => {});
    await new Promise((r) => setTimeout(r, 50));

    // Un retour à la ligne dans le texte : le flux SSE ne doit pas le couper.
    const sent = await fetch(`${base}/rooms/${pin}/send?token=${guestToken}`, { method: 'POST', body: 'ligne 1\nligne 2' });

    expect(sent.status).toBe(204);
    expect(await hostEvents).toEqual([
      { event: 'peer', data: false },
      { event: 'peer', data: true },
      { event: 'message', data: 'ligne 1\nligne 2' },
    ]);
  });

  it('refuse un jeton qui ne correspond pas', async () => {
    await start();
    const { pin } = await (await fetch(`${base}/rooms`, { method: 'POST' })).json();

    expect((await fetch(`${base}/rooms/${pin}/send?token=faux`, { method: 'POST', body: 'x' })).status).toBe(404);
  });

  it('refuse un code inconnu', async () => {
    await start();

    expect((await fetch(`${base}/rooms/0000/join`, { method: 'POST' })).status).toBe(404);
  });
});
