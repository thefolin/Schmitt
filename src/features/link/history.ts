import type { Announcement } from './protocol';

/**
 * LA MÉMOIRE COURTE DE LA LIAISON.
 *
 * POURQUOI ELLE EXISTE (Quentin, 27/10/2026) : « besoin de pouvoir revenir
 * ou changer d'esclave/maître en plein game ». Ce n'est donc pas un simple
 * rattrapage de reconnexion : c'est ce qui permet à un appareil de PRENDRE
 * LA SUITE d'un autre. Le téléphone qui n'a plus de batterie passe la main
 * à la TV, et la partie continue.
 *
 * Elle garde les états entiers, pas les deltas : pour reprendre un rôle, il
 * faut un point de départ complet, et dix états d'un plateau de 23 cases
 * tiennent dans quelques kilo-octets. Rejouer une chaîne de deltas depuis le
 * début serait plus fragile pour un gain nul à cette échelle.
 */

/** Combien d'états on garde. Dix, comme le demande SCH-31. */
export const HISTORY_DEPTH = 10;

/** Un état daté par son numéro de version. */
export interface Snapshot {
  version: number;
  state: unknown;
}

export class StateHistory {
  private snapshots: Snapshot[] = [];
  private nextVersion = 1;

  public constructor(private readonly depth: number = HISTORY_DEPTH) {}

  /**
   * Enregistre un nouvel état et rend son numéro de version.
   *
   * Les versions ne reculent jamais et ne se réutilisent pas, même après
   * oubli des plus anciennes : c'est ce qui rend `since` comparable d'un
   * appareil à l'autre sans horloge commune.
   */
  public record(state: unknown): number {
    const version = this.nextVersion++;

    this.snapshots.push({ version, state });

    // On oublie par le début : les plus anciens états ne servent plus à
    // personne, et la partie peut durer une soirée entière.
    while (this.snapshots.length > this.depth) this.snapshots.shift();

    return version;
  }

  /** La version la plus récente, ou 0 si rien n'a encore été enregistré. */
  public currentVersion(): number {
    return this.snapshots[this.snapshots.length - 1]?.version ?? 0;
  }

  /** L'état le plus récent, ou `null` si la mémoire est vide. */
  public latest(): Snapshot | null {
    return this.snapshots[this.snapshots.length - 1] ?? null;
  }

  /** Un état précis, s'il n'a pas encore été oublié. */
  public at(version: number): Snapshot | null {
    return this.snapshots.find((snapshot) => snapshot.version === version) ?? null;
  }

  /**
   * Ce qu'il faut envoyer à un appareil qui dit avoir vu `since`.
   *
   * Rend `null` quand il est déjà à jour — ne rien envoyer est la bonne
   * réponse, et la plus économe pour la batterie du téléphone (c'est un
   * risque que l'épique identifie).
   *
   * Sinon rend l'état ENTIER plutôt qu'une suite de deltas : l'appareil peut
   * être parti depuis trop longtemps, ou n'avoir jamais rien vu (`since` à
   * 0), ou reprendre le rôle d'un autre. L'état complet couvre ces trois cas
   * d'un seul coup, là où les deltas en manqueraient deux.
   */
  public catchUp(since: number): Announcement | null {
    const latest = this.latest();

    if (latest === null) return null;
    if (since >= latest.version) return null;

    return { kind: 'state', version: latest.version, state: latest.state };
  }
}
