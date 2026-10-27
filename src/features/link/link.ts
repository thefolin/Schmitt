import { parse, seal, type Announcement, type Command, type Role } from './protocol';
import { StateHistory } from './history';
import type { LinkStatus, Transport } from './transport';

/** Une annonce, avant que la liaison ne lui donne son numéro. */
type Unnumbered<T> = T extends { version: number } ? Omit<T, 'version'> : never;

/**
 * LA LIAISON ENTRE DEUX APPAREILS, VUE D'UN SEUL CÔTÉ.
 *
 * Le même objet sert au maître et à l'esclave : seul `role` change. C'est ce
 * qui permet l'échange des rôles en pleine partie que demande Quentin — un
 * appareil ne se reconstruit pas, il change de casquette.
 *
 * SANS TRANSPORT, LA LIAISON EST SEULE (`alone`) et ne fait rien d'autre que
 * se souvenir. Le jeu tourne alors exactement comme aujourd'hui : c'est le
 * repli mono-appareil exigé par l'épique.
 */
export class Link {
  private current: LinkStatus;
  private readonly unsubscribe: (() => void)[] = [];
  private readonly announcementListeners = new Set<(announcement: Announcement) => void>();
  private readonly commandListeners = new Set<(command: Command) => void>();
  private readonly statusListeners = new Set<(status: LinkStatus) => void>();

  /** Côté esclave : la dernière version reçue, pour demander la suite. */
  private lastSeen = 0;

  public constructor(
    public readonly role: Role,
    private readonly transport: Transport | null,
    private readonly history: StateHistory = new StateHistory()
  ) {
    this.current = transport === null ? 'alone' : 'connecting';

    if (transport === null) return;

    this.unsubscribe.push(
      transport.onMessage((raw) => this.receive(raw)),
      transport.onStatus((status) => this.changeStatus(status))
    );
  }

  public status(): LinkStatus {
    return this.current;
  }

  /**
   * MAÎTRE : enregistre l'état de la partie et le diffuse.
   *
   * Il est ENREGISTRÉ MÊME SANS LIAISON : un esclave qui arrive en cours de
   * partie doit trouver un état à reprendre, pas un plateau vide.
   */
  public publish(state: unknown): number {
    const version = this.history.record(state);

    this.emit({ kind: 'state', version, state });

    return version;
  }

  /** MAÎTRE : annonce un dé tiré ou une notification, sous la version courante. */
  public announce(announcement: Unnumbered<Announcement>): void {
    this.emit({ ...announcement, version: this.history.currentVersion() } as Announcement);
  }

  /**
   * ESCLAVE : demande au maître. Rend `false` si personne n'écoute — à
   * l'appelant de jouer alors en local, plutôt que d'attendre un dé qui ne
   * viendra jamais.
   */
  public request(command: Command): boolean {
    if (this.transport === null || this.current !== 'linked') return false;

    this.transport.send(JSON.stringify(seal(this.role, command)));

    return true;
  }

  public onAnnouncement(listener: (announcement: Announcement) => void): () => void {
    this.announcementListeners.add(listener);
    return () => this.announcementListeners.delete(listener);
  }

  public onCommand(listener: (command: Command) => void): () => void {
    this.commandListeners.add(listener);
    return () => this.commandListeners.delete(listener);
  }

  public onStatus(listener: (status: LinkStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  public close(): void {
    for (const off of this.unsubscribe) off();
    this.transport?.close();
    this.changeStatus('alone');
  }

  private emit(announcement: Announcement): void {
    if (this.role !== 'master') return;
    if (this.transport === null || this.current !== 'linked') return;

    this.transport.send(JSON.stringify(seal('master', announcement)));
  }

  private changeStatus(status: LinkStatus): void {
    if (status === this.current) return;

    this.current = status;
    for (const listener of [...this.statusListeners]) listener(status);

    // LA REPRISE EST À LA CHARGE DE L'ESCLAVE : lui seul sait ce qu'il a
    // manqué. Il le dit au maître dès que la liaison revient, et le maître
    // lui renvoie l'état s'il est en retard. Sans ce message, un téléphone
    // revenu après une coupure afficherait une partie figurée au mauvais tour.
    if (status === 'linked' && this.role === 'slave') {
      this.request({ kind: 'resync', since: this.lastSeen });
    }
  }

  private receive(raw: string): void {
    const envelope = parse(raw);
    if (envelope === null) return;

    // UN MESSAGE DE MÊME RÔLE NE NOUS EST PAS DESTINÉ. Deux maîtres sur le
    // même réseau ne doivent pas se commander l'un l'autre.
    if (envelope.from === this.role) return;

    if (this.role === 'master') {
      this.receiveCommand(envelope.body as Command);
    } else {
      this.receiveAnnouncement(envelope.body as Announcement);
    }
  }

  private receiveCommand(command: Command): void {
    if (command.kind === 'resync') {
      const catchUp = this.history.catchUp(command.since);
      if (catchUp !== null) this.emit(catchUp);
      return;
    }

    for (const listener of [...this.commandListeners]) listener(command);
  }

  private receiveAnnouncement(announcement: Announcement): void {
    if (typeof announcement.version !== 'number') return;

    // UNE ANNONCE PLUS VIEILLE QUE CE QU'ON A DÉJÀ VU EST IGNORÉE. Sans ça,
    // un paquet retardé ramènerait l'esclave un tour en arrière.
    if (announcement.version < this.lastSeen) return;

    this.lastSeen = announcement.version;
    for (const listener of [...this.announcementListeners]) listener(announcement);
  }
}
