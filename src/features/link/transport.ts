/**
 * CE QU'UN TRANSPORT DOIT SAVOIR FAIRE, ET RIEN DE PLUS.
 *
 * Le choix du vrai transport attend Quentin (WebRTC par QR code, serveur
 * natif dans l'APK, ou relais sur un PC). Tout ce qui est au-dessus — la
 * liaison, l'autorité du dé, la mémoire — ne doit pas en dépendre : on le
 * branche sur cette interface, et le transport retenu viendra s'y loger.
 *
 * Il ne transporte que du TEXTE. Le JSON, la version, les rôles relèvent de
 * `protocol.ts` : un transport qui les connaîtrait devrait être réécrit à
 * chaque évolution du protocole.
 */

/**
 * Où en est la liaison.
 *
 * `alone` n'est pas une panne : c'est le jeu tel qu'il tourne aujourd'hui,
 * sur un seul appareil. L'épique en fait un critère : « pas de dégradation
 * si les appareils ne trouvent pas de connexion ».
 */
export type LinkStatus = 'alone' | 'connecting' | 'linked' | 'lost';

export interface Transport {
  send(raw: string): void;
  /** S'abonne aux messages reçus. Rend de quoi se désabonner. */
  onMessage(listener: (raw: string) => void): () => void;
  /**
   * S'abonne aux changements d'état. Rend de quoi se désabonner.
   *
   * UN ABONNÉ TARDIF APPREND AUSSITÔT OÙ L'ON EN EST, dès que ce n'est plus
   * `connecting`. C'est le cas ordinaire, pas un détail : l'écran
   * d'appairage ne rend la voie qu'une fois OUVERTE, et la liaison se branche
   * après. Sans ce rappel elle attendrait une ouverture déjà passée, et
   * refuserait chaque lancer.
   */
  onStatus(listener: (status: LinkStatus) => void): () => void;
  close(): void;
}

/**
 * Deux transports branchés l'un sur l'autre, dans la même page.
 *
 * Il sert aux tests, et à rien d'autre : il permet de vérifier la liaison,
 * la reprise et le passage de main sans réseau, donc sans dépendre de
 * l'option que Quentin retiendra.
 *
 * `cut()` simule la coupure du WiFi, `restore()` son retour.
 */
export function pairedInMemory(): {
  a: Transport;
  b: Transport;
  cut(): void;
  restore(): void;
} {
  let up = true;

  interface End {
    messageListeners: Set<(raw: string) => void>;
    statusListeners: Set<(status: LinkStatus) => void>;
    link(other: End): void;
    emitStatus(status: LinkStatus): void;
    transport: Transport;
  }

  const end = (): End => {
    const messageListeners = new Set<(raw: string) => void>();
    const statusListeners = new Set<(status: LinkStatus) => void>();
    let peer: End | null = null;
    let closed = false;
    let current: LinkStatus = 'connecting';

    const self: End = {
      messageListeners,
      statusListeners,
      link(other: End) {
        peer = other;
      },
      emitStatus(status: LinkStatus) {
        current = status;
        for (const listener of [...statusListeners]) listener(status);
      },
      transport: {
        send(raw: string) {
          // UN MESSAGE ENVOYÉ PENDANT LA COUPURE EST PERDU, comme sur un vrai
          // réseau. C'est la mémoire de la liaison qui rattrape, pas le
          // transport : le tester ici garde la reprise honnête.
          if (!up || closed || peer === null) return;
          for (const listener of [...peer.messageListeners]) listener(raw);
        },
        onMessage(listener: (raw: string) => void) {
          messageListeners.add(listener);
          return () => messageListeners.delete(listener);
        },
        onStatus(listener: (status: LinkStatus) => void) {
          statusListeners.add(listener);
          if (current !== 'connecting') listener(current);
          return () => statusListeners.delete(listener);
        },
        close() {
          closed = true;
        },
      } satisfies Transport,
    };

    return self;
  };

  const left = end();
  const right = end();
  left.link(right);
  right.link(left);

  return {
    a: left.transport,
    b: right.transport,
    cut() {
      up = false;
      left.emitStatus('lost');
      right.emitStatus('lost');
    },
    restore() {
      up = true;
      left.emitStatus('linked');
      right.emitStatus('linked');
    },
  };
}
