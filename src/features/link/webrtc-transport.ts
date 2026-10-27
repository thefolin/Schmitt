import { decode, encode, fromSdp, toSdp, type PairingKind } from './pairing-code';
import type { LinkStatus, Transport } from './transport';

/**
 * LE TRANSPORT RETENU PAR QUENTIN (27/10/2026) : WEBRTC, APPAIRÉ PAR QR CODE.
 *
 * Pourquoi lui : c'est le seul qui marche dans TOUTES les combinaisons
 * demandées — APK ↔ navigateur, navigateur ↔ navigateur — sans serveur et
 * sans internet. Une page web ne sait pas écouter sur le réseau, et le site
 * publié en HTTPS n'a pas le droit d'ouvrir une connexion non chiffrée vers
 * une adresse locale. WebRTC contourne les deux : chaque côté se présente à
 * l'autre (par le QR), puis ils se parlent directement, chiffré.
 *
 * Le déroulé, en deux scans :
 *   1. L'appareil qui ouvre la partie (`host`) affiche son offre en QR.
 *   2. L'autre (`join`) la scanne et affiche sa réponse en QR.
 *   3. Le premier scanne la réponse (`accept`). La voie s'ouvre.
 *
 * AUCUN SERVEUR STUN NI TURN : les adresses échangées sont celles du WiFi.
 * C'est exactement la contrainte de l'épique — « LAN local, pas internet ».
 */

/** Combien attendre que le navigateur ait listé ses adresses. */
const GATHERING_TIMEOUT_MS = 4000;

/** Le nom de la voie de données. Les deux côtés doivent le partager. */
const CHANNEL_LABEL = 'schmitt';

/**
 * Ce que rend `WebRtcTransport.host` : le transport, le texte à afficher en
 * QR, et de quoi accepter la réponse une fois scannée.
 */
export interface HostPairing {
  transport: WebRtcTransport;
  code: string;
  /** Rend `false` si le texte scanné n'est pas une réponse valide. */
  accept(answer: string): Promise<boolean>;
}

export class WebRtcTransport implements Transport {
  private channel: RTCDataChannel | null = null;
  private current: LinkStatus = 'connecting';
  private readonly messageListeners = new Set<(raw: string) => void>();
  private readonly statusListeners = new Set<(status: LinkStatus) => void>();

  private constructor(private readonly peer: RTCPeerConnection) {
    // LES COUPURES COURTES SE RÉPARENT SEULES : WebRTC vérifie la voie en
    // continu, et passe de `disconnected` à `connected` quand le WiFi
    // revient. On le laisse faire et on ne signale que la perte et le retour.
    // Une coupure longue (`failed`), elle, demande un nouvel appairage :
    // renégocier passerait par la voie même qui vient de tomber.
    peer.addEventListener('connectionstatechange', () => {
      const state = peer.connectionState;

      if (state === 'disconnected' || state === 'failed') this.setStatus('lost');
      if (state === 'connected' && this.channel?.readyState === 'open') this.setStatus('linked');
    });
  }

  /** Ouvre une partie : rend l'offre à afficher en QR. */
  public static async host(): Promise<HostPairing | null> {
    const peer = new RTCPeerConnection({ iceServers: [] });
    const transport = new WebRtcTransport(peer);

    // L'OFFRE DOIT DÉCLARER LA VOIE AVANT d'être créée, sinon elle ne
    // contient aucune section de données et l'autre côté n'aurait rien à
    // ouvrir.
    transport.adopt(peer.createDataChannel(CHANNEL_LABEL, { ordered: true }));

    await peer.setLocalDescription(await peer.createOffer());
    const code = await transport.describe('offer');

    if (code === null) {
      peer.close();
      return null;
    }

    return {
      transport,
      code,
      accept: async (answer: string) => {
        const parsed = decode(answer);
        if (parsed === null || parsed.kind !== 'answer') return false;

        try {
          await peer.setRemoteDescription({ type: 'answer', sdp: toSdp(parsed) });
          return true;
        } catch {
          return false;
        }
      },
    };
  }

  /**
   * Rejoint une partie à partir de l'offre scannée : rend la réponse à
   * afficher en QR, ou `null` si le texte scanné n'est pas une offre.
   */
  public static async join(offer: string): Promise<{ transport: WebRtcTransport; code: string } | null> {
    const parsed = decode(offer);
    if (parsed === null || parsed.kind !== 'offer') return null;

    const peer = new RTCPeerConnection({ iceServers: [] });
    const transport = new WebRtcTransport(peer);

    peer.addEventListener('datachannel', (event) => transport.adopt(event.channel));

    try {
      await peer.setRemoteDescription({ type: 'offer', sdp: toSdp(parsed) });
      await peer.setLocalDescription(await peer.createAnswer());
    } catch {
      peer.close();
      return null;
    }

    const code = await transport.describe('answer');

    if (code === null) {
      peer.close();
      return null;
    }

    return { transport, code };
  }

  public send(raw: string): void {
    // Hors voie ouverte, le message est perdu — comme sur la paire en
    // mémoire. La reprise est l'affaire de la liaison, pas du transport.
    if (this.channel?.readyState === 'open') this.channel.send(raw);
  }

  public onMessage(listener: (raw: string) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onStatus(listener: (status: LinkStatus) => void): () => void {
    this.statusListeners.add(listener);

    // UN ABONNÉ TARDIF APPREND OÙ L'ON EN EST. La voie a pu s'ouvrir avant
    // qu'on branche la liaison : sans ce rappel, elle croirait attendre
    // encore.
    if (this.current !== 'connecting') listener(this.current);

    return () => this.statusListeners.delete(listener);
  }

  public close(): void {
    this.channel?.close();
    this.peer.close();
  }

  private adopt(channel: RTCDataChannel): void {
    this.channel = channel;

    channel.addEventListener('open', () => this.setStatus('linked'));
    channel.addEventListener('close', () => this.setStatus('lost'));
    channel.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return;
      for (const listener of [...this.messageListeners]) listener(event.data);
    });
  }

  private setStatus(status: LinkStatus): void {
    if (status === this.current) return;

    this.current = status;
    for (const listener of [...this.statusListeners]) listener(status);
  }

  /**
   * Attend que le navigateur ait fini de lister ses adresses, puis rend le
   * texte du QR.
   *
   * PAS D'ÉCHANGE AU FIL DE L'EAU : un QR ne s'envoie qu'une fois. Il faut
   * donc toutes les adresses AVANT de l'afficher. Le délai est un filet : un
   * appareil qui tarde à lister ses interfaces garde ce qu'il a déjà.
   */
  private async describe(kind: PairingKind): Promise<string | null> {
    await new Promise<void>((resolve) => {
      if (this.peer.iceGatheringState === 'complete') return resolve();

      const timer = setTimeout(resolve, GATHERING_TIMEOUT_MS);
      this.peer.addEventListener('icegatheringstatechange', () => {
        if (this.peer.iceGatheringState !== 'complete') return;
        clearTimeout(timer);
        resolve();
      });
    });

    const sdp = this.peer.localDescription?.sdp;
    if (!sdp) return null;

    const code = fromSdp(kind, sdp);

    return code === null ? null : encode(code);
  }
}
