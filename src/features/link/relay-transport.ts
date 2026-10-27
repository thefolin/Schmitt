import type { LinkStatus, Transport } from './transport';

/**
 * LE TRANSPORT PAR LE SERVEUR DU WIFI, AVEC UN CODE À 4 CHIFFRES.
 *
 * Quentin (27/10/2026) : la caméra du Mac lisait mal le QR du téléphone,
 * il veut « un code temporaire pour rentrer sur la partie », et que tout
 * passe par le WiFi.
 *
 * Les deux appareils parlent au serveur qui sert DÉJÀ le jeu (le relais de
 * `server/pair-relay.ts`). Rien d'autre à installer, aucune caméra, et
 * aucune dépendance aux adresses « .local » qui fragilisaient WebRTC.
 *
 * Réception par un flux SSE (`EventSource`) : le navigateur le rouvre de
 * lui-même après une coupure, et le serveur redit alors si l'autre est là.
 * C'est la reconnexion automatique de SCH-30, sans une ligne pour elle.
 */

/** Où vit le relais : sous la base du site, comme la page. */
export const RELAY_BASE = `${import.meta.env.BASE_URL}__pair`.replace(/\/{2,}/g, '/');

/** Au-delà, on considère qu'il n'y a pas de relais (page servie par GitHub Pages). */
const PROBE_TIMEOUT_MS = 1500;

export class RelayTransport implements Transport {
  private source: EventSource | null = null;
  private current: LinkStatus = 'connecting';
  /** La liaison a-t-elle déjà été établie ? Avant, une absence n'est pas une perte. */
  private everLinked = false;
  private readonly messageListeners = new Set<(raw: string) => void>();
  private readonly statusListeners = new Set<(status: LinkStatus) => void>();

  private constructor(
    private readonly base: string,
    private readonly pin: string,
    private readonly token: string
  ) {
    this.open();
  }

  /** Le relais répond-il ? Sans lui, l'écran d'appairage garde les QR. */
  public static async available(base: string = RELAY_BASE): Promise<boolean> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), PROBE_TIMEOUT_MS);

    try {
      return (await fetch(`${base}/ping`, { signal: abort.signal, cache: 'no-store' })).status === 204;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Ouvre une partie : rend le code à afficher. */
  public static async host(base: string = RELAY_BASE): Promise<{ transport: RelayTransport; pin: string } | null> {
    const created = await postJson<{ pin: string; token: string }>(`${base}/rooms`);
    if (!created) return null;

    return { transport: new RelayTransport(base, created.pin, created.token), pin: created.pin };
  }

  /** Rejoint la partie du code tapé. `null` si le code est faux, expiré ou déjà pris. */
  public static async join(pin: string, base: string = RELAY_BASE): Promise<RelayTransport | null> {
    if (!/^\d{4}$/.test(pin)) return null;

    const joined = await postJson<{ token: string }>(`${base}/rooms/${pin}/join`);

    return joined ? new RelayTransport(base, pin, joined.token) : null;
  }

  public send(raw: string): void {
    // ENVOYÉ MÊME SI L'AUTRE EST ABSENT : le relais le garde pour lui. Un
    // téléphone en veille retrouve ainsi le dernier lancer à son retour.
    void fetch(`${this.base}/rooms/${this.pin}/send?token=${encodeURIComponent(this.token)}`, {
      method: 'POST',
      body: raw,
      headers: { 'Content-Type': 'text/plain' },
    }).catch(() => undefined);
  }

  public onMessage(listener: (raw: string) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onStatus(listener: (status: LinkStatus) => void): () => void {
    this.statusListeners.add(listener);
    // Contrat de `Transport` : un abonné tardif apprend où l'on en est.
    if (this.current !== 'connecting') listener(this.current);
    return () => this.statusListeners.delete(listener);
  }

  public close(): void {
    this.source?.close();
    this.source = null;
  }

  private open(): void {
    const source = new EventSource(`${this.base}/rooms/${this.pin}/events?token=${encodeURIComponent(this.token)}`);
    this.source = source;

    source.addEventListener('peer', (event) => {
      const up = JSON.parse((event as MessageEvent<string>).data) === true;

      if (up) {
        this.everLinked = true;
        this.setStatus('linked');
      } else if (this.everLinked) {
        this.setStatus('lost');
      }
    });

    source.addEventListener('message', (event) => {
      const text = JSON.parse((event as MessageEvent<string>).data);
      if (typeof text !== 'string') return;
      for (const listener of [...this.messageListeners]) listener(text);
    });

    // LE FLUX TOMBE (WiFi coupé, serveur relancé) : le navigateur le rouvre
    // seul, et le serveur redira si l'autre est là. On signale la perte en
    // attendant — sauf avant la première liaison, où rien n'est encore perdu.
    source.addEventListener('error', () => {
      if (this.everLinked) this.setStatus('lost');
    });
  }

  private setStatus(status: LinkStatus): void {
    if (status === this.current) return;

    this.current = status;
    for (const listener of [...this.statusListeners]) listener(status);
  }
}

/** Un POST sans corps qui rend du JSON, ou `null` à la moindre erreur. */
async function postJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { method: 'POST', cache: 'no-store' });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}
