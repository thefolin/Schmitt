import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

/**
 * LE RELAIS DU WIFI : DEUX APPAREILS SE TROUVENT PAR UN CODE À 4 CHIFFRES.
 *
 * Quentin (27/10/2026) : l'appairage par QR « n'est pas assez stable » —
 * la caméra du Mac lisait mal le QR du téléphone. Il veut un code
 * temporaire, et que tout passe par le WiFi, sans internet.
 *
 * UN NAVIGATEUR NE PEUT PAS ÊTRE SERVEUR : il faut un programme sur le WiFi
 * pour que deux pages se trouvent. Ce programme existe déjà — c'est celui
 * qui SERT LE JEU (le Mac, `npm run dev:https`). Le relais vit donc dans ce
 * même serveur, sans rien installer de plus.
 *
 * Il relaie TOUTE la partie, pas seulement l'appairage : une liaison directe
 * (WebRTC) dépend de la résolution des adresses « .local », que certains
 * Android font mal. Passer par le serveur qu'on joint déjà pour charger la
 * page ne laisse rien au hasard.
 *
 * Le relais ne comprend rien de ce qu'il transporte : du texte d'un côté à
 * l'autre. Le protocole du jeu vit dans `src/features/link/`.
 */

/** Un code non utilisé expire : il ne doit pas traîner sur l'écran d'un autre. */
export const WAITING_TTL_MS = 2 * 60 * 1000;

/** Une partie dont les deux appareils sont partis est oubliée après ce délai. */
export const IDLE_TTL_MS = 10 * 60 * 1000;

/** Messages gardés pour un appareil momentanément déconnecté. */
const QUEUE_LIMIT = 200;

export type Side = 'host' | 'guest';

/** Ce qu'un appareil reçoit : l'autre arrive ou part, ou un message. */
export type RelayEvent = { type: 'peer'; up: boolean } | { type: 'message'; text: string };

type Sink = (event: RelayEvent) => void;

interface Room {
  pin: string;
  tokens: Record<Side, string | null>;
  sinks: Record<Side, Sink | null>;
  queues: Record<Side, string[]>;
  createdAt: number;
  /** Dernier instant où au moins un appareil était branché. */
  seenAt: number;
}

const other = (side: Side): Side => (side === 'host' ? 'guest' : 'host');

/**
 * Les parties en cours d'appairage ou de jeu, en mémoire.
 *
 * Pas de base de données : l'épique le demande, et une partie ne survit
 * pas à l'arrêt du serveur qui sert aussi la page.
 */
export class Rooms {
  private readonly rooms = new Map<string, Room>();

  public constructor(
    private readonly now: () => number = Date.now,
    private readonly random: () => number = Math.random
  ) {}

  /** Ouvre une partie : rend le code à afficher, et le jeton du plateau. */
  public create(): { pin: string; token: string } {
    this.sweep();

    // 4 CHIFFRES, sans collision avec un code encore affiché ailleurs.
    let pin: string;
    do {
      pin = String(Math.floor(this.random() * 10000)).padStart(4, '0');
    } while (this.rooms.has(pin));

    const token = this.token();
    const at = this.now();
    this.rooms.set(pin, {
      pin,
      tokens: { host: token, guest: null },
      sinks: { host: null, guest: null },
      queues: { host: [], guest: [] },
      createdAt: at,
      seenAt: at,
    });

    return { pin, token };
  }

  /**
   * Rejoint la partie du code. `null` si le code n'existe pas, a expiré, ou
   * a déjà servi : un code se tape UNE fois, un second appareil ne peut pas
   * s'immiscer dans une partie déjà reliée.
   */
  public join(pin: string): { token: string } | null {
    this.sweep();

    const room = this.rooms.get(pin);
    if (!room || room.tokens.guest !== null) return null;

    room.tokens.guest = this.token();
    return { token: room.tokens.guest };
  }

  /** Quel côté porte ce jeton, ou `null` s'il ne correspond à rien. */
  public side(pin: string, token: string): Side | null {
    const room = this.rooms.get(pin);
    if (!room) return null;
    if (room.tokens.host === token) return 'host';
    if (room.tokens.guest === token) return 'guest';
    return null;
  }

  /**
   * Branche un appareil sur sa partie. Il apprend aussitôt si l'autre est
   * là, reçoit ce qui l'attendait, et l'autre apprend qu'il est arrivé.
   * Rend de quoi le débrancher.
   */
  public attach(pin: string, side: Side, sink: Sink): () => void {
    const room = this.rooms.get(pin);
    if (!room) return () => {};

    room.sinks[side] = sink;
    room.seenAt = this.now();

    sink({ type: 'peer', up: room.sinks[other(side)] !== null });
    for (const text of room.queues[side].splice(0)) sink({ type: 'message', text });
    room.sinks[other(side)]?.({ type: 'peer', up: true });

    return () => {
      // Un appareil qui se rebranche a remplacé son ancien flux : le
      // débranchement de l'ancien ne doit pas couper le nouveau.
      if (room.sinks[side] !== sink) return;

      room.sinks[side] = null;
      room.seenAt = this.now();
      room.sinks[other(side)]?.({ type: 'peer', up: false });
    };
  }

  /**
   * Transmet un message à l'autre côté, ou le garde s'il est momentanément
   * absent — un téléphone qui passe en veille ne perd pas le dernier lancer.
   */
  public send(pin: string, side: Side, text: string): boolean {
    const room = this.rooms.get(pin);
    if (!room) return false;

    const target = other(side);
    const sink = room.sinks[target];

    if (sink) {
      sink({ type: 'message', text });
    } else {
      const queue = room.queues[target];
      queue.push(text);
      if (queue.length > QUEUE_LIMIT) queue.shift();
    }

    return true;
  }

  /** Oublie les codes jamais utilisés et les parties abandonnées. */
  public sweep(): void {
    const at = this.now();

    for (const [pin, room] of this.rooms) {
      const waiting = room.tokens.guest === null;
      const anyone = room.sinks.host !== null || room.sinks.guest !== null;

      if (waiting && at - room.createdAt > WAITING_TTL_MS) this.rooms.delete(pin);
      else if (!waiting && !anyone && at - room.seenAt > IDLE_TTL_MS) this.rooms.delete(pin);
    }
  }

  private token(): string {
    return Array.from({ length: 4 }, () => Math.floor(this.random() * 2 ** 32).toString(36)).join('');
  }
}

/** Le préfixe des routes du relais, sous la base du site. */
export const RELAY_PATH = '/__pair';

/** Battement envoyé sur chaque flux : un proxy ou le WiFi ne le coupe pas pour inactivité. */
const HEARTBEAT_MS = 15000;

/** Un message ne dépasse pas cette taille : le relais ne sert pas à autre chose. */
const BODY_LIMIT = 64 * 1024;

type Next = () => void;

/**
 * Les routes du relais, à brancher sur le serveur qui sert le jeu.
 *
 *   GET  /__pair/ping                    — le relais est-il là ?
 *   POST /__pair/rooms                   — ouvrir : { pin, token }
 *   POST /__pair/rooms/:pin/join         — rejoindre : { token }
 *   GET  /__pair/rooms/:pin/events?token — flux des événements (SSE)
 *   POST /__pair/rooms/:pin/send?token   — envoyer un message (texte brut)
 */
export function relayMiddleware(rooms: Rooms = new Rooms()) {
  return (req: IncomingMessage, res: ServerResponse, next: Next): void => {
    const url = new URL(req.url ?? '/', 'http://relais');
    const at = url.pathname.indexOf(RELAY_PATH);
    if (at < 0) return next();

    const parts = url.pathname.slice(at + RELAY_PATH.length).split('/').filter(Boolean);
    const token = url.searchParams.get('token') ?? '';

    const json = (status: number, body?: unknown): void => {
      res.statusCode = status;
      res.setHeader('Cache-Control', 'no-store');

      if (body === undefined) {
        res.end();
        return;
      }

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    };

    if (req.method === 'GET' && parts[0] === 'ping' && parts.length === 1) return json(204);

    if (req.method === 'POST' && parts[0] === 'rooms' && parts.length === 1) {
      return json(200, rooms.create());
    }

    if (parts[0] !== 'rooms' || parts.length !== 3) return json(404);
    const [, pin, action] = parts;

    if (req.method === 'POST' && action === 'join') {
      const joined = rooms.join(pin);
      return joined ? json(200, joined) : json(404);
    }

    const side = rooms.side(pin, token);
    if (side === null) return json(404);

    if (req.method === 'GET' && action === 'events') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Connection', 'keep-alive');
      res.write(': relais\n\n');

      // `data` tient sur UNE ligne : le texte est sérialisé en JSON, ce qui
      // échappe tout retour à la ligne qu'il contiendrait.
      const detach = rooms.attach(pin, side, (event) => {
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.type === 'peer' ? event.up : event.text)}\n\n`);
      });
      const beat = setInterval(() => res.write(': battement\n\n'), HEARTBEAT_MS);

      req.on('close', () => {
        clearInterval(beat);
        detach();
      });
      return;
    }

    if (req.method === 'POST' && action === 'send') {
      let body = '';
      let tooBig = false;

      req.setEncoding('utf8');
      req.on('data', (chunk: string) => {
        body += chunk;
        if (body.length > BODY_LIMIT) tooBig = true;
      });
      req.on('end', () => {
        if (tooBig) return json(413);
        json(rooms.send(pin, side, body) ? 204 : 404);
      });
      return;
    }

    json(404);
  };
}

/**
 * Le relais, branché sur le serveur de développement ET sur `vite preview`
 * (le jeu construit, servi sur le WiFi). Sur GitHub Pages, il n'existe pas :
 * la page le détecte et garde l'appairage par QR.
 */
export function pairRelayPlugin(): Plugin {
  const rooms = new Rooms();

  return {
    name: 'schmitt-pair-relay',
    configureServer(server) {
      server.middlewares.use(relayMiddleware(rooms));
    },
    configurePreviewServer(server) {
      server.middlewares.use(relayMiddleware(rooms));
    },
  };
}
