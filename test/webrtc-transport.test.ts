import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebRtcTransport } from '@/features/link/webrtc-transport';
import { decode } from '@/features/link/pairing-code';
import type { LinkStatus } from '@/features/link/transport';

/**
 * LE TRANSPORT WEBRTC, SANS RÉSEAU.
 *
 * jsdom n'a pas WebRTC, et l'établissement réel d'une liaison ne se prouve
 * que sur deux vrais appareils. Ce fichier garde donc ce qui ne dépend pas
 * du réseau : ce que l'appairage REFUSE, et comment l'état de la liaison
 * suit la voie de données. Le faux `RTCPeerConnection` ne simule que ça.
 */

const SDP = (setup: string) =>
  [
    'v=0', 'o=- 1 2 IN IP4 127.0.0.1', 's=-', 't=0 0',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0',
    'a=candidate:1 1 udp 2122260223 192.168.1.20 54321 typ host',
    'a=ice-ufrag:abcd', 'a=ice-pwd:abcdefghijklmnopqrstuv',
    `a=fingerprint:sha-256 ${Array(32).fill('AB').join(':')}`,
    `a=setup:${setup}`, 'a=mid:0', '',
  ].join('\r\n');

class FakeChannel extends EventTarget {
  public readyState: RTCDataChannelState = 'connecting';
  public sent: string[] = [];
  public send(data: string) { this.sent.push(data); }
  public close() { this.readyState = 'closed'; }
  public open() { this.readyState = 'open'; this.dispatchEvent(new Event('open')); }
}

class FakePeer extends EventTarget {
  public static last: FakePeer | null = null;
  public localDescription: RTCSessionDescriptionInit | null = null;
  public remoteDescription: RTCSessionDescriptionInit | null = null;
  public iceGatheringState: RTCIceGatheringState = 'complete';
  public connectionState: RTCPeerConnectionState = 'new';
  public channel: FakeChannel | null = null;

  public constructor() { super(); FakePeer.last = this; }
  public createDataChannel() { this.channel = new FakeChannel(); return this.channel; }
  public async createOffer() { return { type: 'offer' as const, sdp: SDP('actpass') }; }
  public async createAnswer() { return { type: 'answer' as const, sdp: SDP('active') }; }
  public async setLocalDescription(d: RTCSessionDescriptionInit) { this.localDescription = d; }
  public async setRemoteDescription(d: RTCSessionDescriptionInit) { this.remoteDescription = d; }
  public close() { this.connectionState = 'closed'; }
  public become(state: RTCPeerConnectionState) {
    this.connectionState = state;
    this.dispatchEvent(new Event('connectionstatechange'));
  }
}

beforeEach(() => vi.stubGlobal('RTCPeerConnection', FakePeer));
afterEach(() => vi.unstubAllGlobals());

/** Une offre et une réponse valides, telles que les QR les portent. */
async function codes() {
  const host = (await WebRtcTransport.host())!;
  const guest = (await WebRtcTransport.join(host.code))!;

  return { host, guest };
}

describe('L\'appairage ne se trompe pas de QR', () => {
  it('affiche une offre', async () => {
    const host = (await WebRtcTransport.host())!;

    expect(decode(host.code)!.kind).toBe('offer');
  });

  it('répond à une offre par une réponse', async () => {
    const { guest } = await codes();

    expect(decode(guest.code)!.kind).toBe('answer');
  });

  it('refuse de rejoindre en scannant une RÉPONSE', async () => {
    // Le cas du joueur qui scanne le mauvais écran.
    const { guest } = await codes();

    expect(await WebRtcTransport.join(guest.code)).toBeNull();
  });

  it('refuse de rejoindre sur un QR étranger', async () => {
    expect(await WebRtcTransport.join('https://example.com')).toBeNull();
  });

  it('refuse d\'accepter sa PROPRE offre, rescannée par erreur', async () => {
    const host = (await WebRtcTransport.host())!;
    const peer = FakePeer.last!;

    expect(await host.accept(host.code)).toBe(false);
    expect(peer.remoteDescription).toBeNull();
  });

  it('accepte une vraie réponse', async () => {
    const host = (await WebRtcTransport.host())!;
    const peer = FakePeer.last!;
    const guest = (await WebRtcTransport.join(host.code))!;

    expect(await host.accept(guest.code)).toBe(true);
    expect(peer.remoteDescription?.type).toBe('answer');
  });
});

describe('L\'état de la liaison suit la voie', () => {
  async function opened() {
    const host = (await WebRtcTransport.host())!;
    const peer = FakePeer.last!;
    const seen: LinkStatus[] = [];
    host.transport.onStatus((s) => seen.push(s));

    return { host, peer, channel: peer.channel!, seen };
  }

  it('se dit reliée quand la voie s\'ouvre', async () => {
    const { channel, seen } = await opened();

    channel.open();

    expect(seen).toEqual(['linked']);
  });

  it('prévient un abonné arrivé APRÈS l\'ouverture', async () => {
    // La liaison peut se brancher une fois la voie déjà ouverte : sans ce
    // rappel elle croirait attendre encore, et refuserait chaque lancer.
    const { host, channel } = await opened();
    channel.open();

    const late: LinkStatus[] = [];
    host.transport.onStatus((s) => late.push(s));

    expect(late).toEqual(['linked']);
  });

  it('signale une coupure courte, puis son retour', async () => {
    const { peer, channel, seen } = await opened();
    channel.open();

    peer.become('disconnected');
    peer.become('connected');

    expect(seen).toEqual(['linked', 'lost', 'linked']);
  });

  it('n\'envoie rien tant que la voie n\'est pas ouverte', async () => {
    const { host, channel } = await opened();

    host.transport.send('trop tôt');
    channel.open();
    host.transport.send('à temps');

    expect(channel.sent).toEqual(['à temps']);
  });
});
